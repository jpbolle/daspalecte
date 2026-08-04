import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { costOf } from "@/lib/ai-cost";
import type {
  AiCallDoc,
  EventDoc,
  ExerciseResultDoc,
  ReadingTestDoc,
  SessionDoc,
  VocabularyDoc,
} from "@/lib/types";

/**
 * Lectures de synthese pour les tableaux prof et eleve.
 *
 * On interroge les collections de premier niveau (`sessions`, `readingTests`,
 * `exerciseResults`) plutot que de parcourir les sessions une a une : c'est
 * pour cela que `studentId` et `teacherId` y sont denormalises.
 */

export interface StudentStats {
  sessions: number;
  /** Mots distincts, pas le nombre de traductions. */
  words: number;
  readingTests: number;
  readingAverage: number | null;
  lastReadingPercentage: number | null;
  exercises: number;
  /** Part des points obtenus sur l'ensemble des exercices termines. */
  exerciseAccuracy: number | null;
  lastActivityAt: number | null;
}

export interface ClassStats {
  students: number;
  activeThisWeek: number;
  sessions: number;
  words: number;
  readingTests: number;
  readingAverage: number | null;
}

const WEEK = 7 * 86_400_000;

/**
 * Statistiques d'un groupe d'eleves, en quatre requetes au total.
 *
 * `scope` est l'identifiant du professeur dont on veut les eleves ; `null`
 * couvre l'ecole entiere (zone Administration). La portee est passee
 * explicitement et non deduite du role : l'admin est aussi professeur, et sa
 * page « Mes eleves » doit rester la sienne (voir `data/people.ts`).
 */
export async function loadClassActivity(
  scope: string | null,
  studentIds: string[],
): Promise<{ stats: ClassStats; byStudent: Map<string, StudentStats> }> {
  const byStudent = new Map<string, StudentStats>(
    studentIds.map((id) => [id, emptyStats()]),
  );

  if (studentIds.length === 0) {
    return { stats: emptyClassStats(), byStudent };
  }

  const db = adminDb();

  const [sessions, readingTests, exercises, vocabulary] = await Promise.all([
    scoped(db.collection("sessions"), scope).get(),
    scoped(db.collection("readingTests"), scope).get(),
    scoped(db.collection("exerciseResults"), scope).get(),
    scoped(db.collectionGroup("vocabulary"), scope).get(),
  ]);

  for (const document of sessions.docs) {
    const session = document.data() as SessionDoc;
    const stats = byStudent.get(session.studentId);
    if (!stats) continue;
    stats.sessions += 1;
    stats.lastActivityAt = Math.max(
      stats.lastActivityAt ?? 0,
      session.lastActivityAt ?? 0,
    );
  }

  const percentages = new Map<string, number[]>();
  for (const document of readingTests.docs) {
    const test = document.data() as ReadingTestDoc;
    const stats = byStudent.get(test.studentId);
    if (!stats) continue;
    stats.readingTests += 1;
    const list = percentages.get(test.studentId) ?? [];
    list.push(test.percentage);
    percentages.set(test.studentId, list);
  }

  const points = new Map<string, { score: number; total: number }>();
  for (const document of exercises.docs) {
    const result = document.data() as ExerciseResultDoc;
    const stats = byStudent.get(result.studentId);
    if (!stats) continue;
    stats.exercises += 1;
    const tally = points.get(result.studentId) ?? { score: 0, total: 0 };
    tally.score += result.score;
    tally.total += result.total;
    points.set(result.studentId, tally);
  }

  for (const document of vocabulary.docs) {
    // Chemin : users/{studentId}/vocabulary/{mot}
    const studentId = document.ref.parent.parent?.id;
    const stats = studentId ? byStudent.get(studentId) : undefined;
    if (stats) stats.words += 1;
  }

  for (const [studentId, stats] of byStudent) {
    const list = percentages.get(studentId);
    if (list?.length) {
      stats.readingAverage = Math.round(
        list.reduce((sum, value) => sum + value, 0) / list.length,
      );
      stats.lastReadingPercentage = list[list.length - 1];
    }
    const tally = points.get(studentId);
    if (tally && tally.total > 0) {
      stats.exerciseAccuracy = Math.round((tally.score / tally.total) * 100);
    }
  }

  const allPercentages = [...percentages.values()].flat();
  const now = Date.now();

  return {
    byStudent,
    stats: {
      students: studentIds.length,
      activeThisWeek: [...byStudent.values()].filter(
        (stats) => (stats.lastActivityAt ?? 0) > now - WEEK,
      ).length,
      sessions: sessions.size,
      words: [...byStudent.values()].reduce((sum, s) => sum + s.words, 0),
      readingTests: allPercentages.length,
      readingAverage: allPercentages.length
        ? Math.round(
            allPercentages.reduce((sum, value) => sum + value, 0) /
              allPercentages.length,
          )
        : null,
    },
  };
}

export async function loadStudentStats(
  studentId: string,
): Promise<StudentStats> {
  const db = adminDb();
  const [sessions, readingTests, exercises, vocabulary] = await Promise.all([
    db.collection("sessions").where("studentId", "==", studentId).get(),
    db.collection("readingTests").where("studentId", "==", studentId).get(),
    db.collection("exerciseResults").where("studentId", "==", studentId).get(),
    db.collection("users").doc(studentId).collection("vocabulary").get(),
  ]);

  const stats = emptyStats();
  stats.sessions = sessions.size;
  stats.words = vocabulary.size;
  stats.readingTests = readingTests.size;
  stats.exercises = exercises.size;

  for (const document of sessions.docs) {
    const session = document.data() as SessionDoc;
    stats.lastActivityAt = Math.max(
      stats.lastActivityAt ?? 0,
      session.lastActivityAt ?? 0,
    );
  }

  const percentages = readingTests.docs
    .map((document) => document.data() as ReadingTestDoc)
    .sort((a, b) => a.at - b.at)
    .map((test) => test.percentage);
  if (percentages.length) {
    stats.readingAverage = Math.round(
      percentages.reduce((sum, value) => sum + value, 0) / percentages.length,
    );
    stats.lastReadingPercentage = percentages[percentages.length - 1];
  }

  let score = 0;
  let total = 0;
  for (const document of exercises.docs) {
    const result = document.data() as ExerciseResultDoc;
    score += result.score;
    total += result.total;
  }
  if (total > 0) stats.exerciseAccuracy = Math.round((score / total) * 100);

  return stats;
}

export async function listSessions(studentId: string): Promise<SessionDoc[]> {
  const snapshot = await adminDb()
    .collection("sessions")
    .where("studentId", "==", studentId)
    .get();
  return snapshot.docs
    .map((document) => document.data() as SessionDoc)
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

export interface SessionDetail {
  session: SessionDoc;
  words: EventDoc[];
  exercises: ExerciseResultDoc[];
  readingTests: ReadingTestDoc[];
  comprehensions: number;
  captures: number;
}

/**
 * Toutes les sessions d'un eleve avec leur contenu, en quatre requetes.
 *
 * Les evenements sont recuperes en une seule fois par `collectionGroup` plutot
 * qu'une requete par session : une annee scolaire compte des dizaines de
 * sessions, et l'ecran les affiche toutes.
 */
export async function loadStudentSessions(
  studentId: string,
): Promise<SessionDetail[]> {
  const db = adminDb();
  const [sessions, events, exercises, readingTests] = await Promise.all([
    db.collection("sessions").where("studentId", "==", studentId).get(),
    db.collectionGroup("events").where("studentId", "==", studentId).get(),
    db.collection("exerciseResults").where("studentId", "==", studentId).get(),
    db.collection("readingTests").where("studentId", "==", studentId).get(),
  ]);

  const details = new Map<string, SessionDetail>();
  for (const document of sessions.docs) {
    const session = document.data() as SessionDoc;
    details.set(session.id, {
      session,
      words: [],
      exercises: [],
      readingTests: [],
      comprehensions: 0,
      captures: 0,
    });
  }

  for (const document of events.docs) {
    // Chemin : sessions/{sessionId}/events/{eventId}
    const sessionId = document.ref.parent.parent?.id;
    const detail = sessionId ? details.get(sessionId) : undefined;
    if (!detail) continue;

    const event = document.data() as EventDoc;
    if (event.type === "word") detail.words.push(event);
    else if (event.type === "comprehension") detail.comprehensions += 1;
    else if (event.type === "capture") detail.captures += 1;
  }

  for (const document of exercises.docs) {
    const result = document.data() as ExerciseResultDoc;
    details.get(result.sessionId)?.exercises.push(result);
  }
  for (const document of readingTests.docs) {
    const test = document.data() as ReadingTestDoc;
    details.get(test.sessionId)?.readingTests.push(test);
  }

  for (const detail of details.values()) {
    detail.words.sort((a, b) => a.at - b.at);
    detail.exercises.sort((a, b) => a.at - b.at);
    detail.readingTests.sort((a, b) => a.at - b.at);
  }

  return [...details.values()].sort(
    (a, b) => b.session.lastActivityAt - a.session.lastActivityAt,
  );
}

export async function listVocabulary(
  studentId: string,
): Promise<VocabularyDoc[]> {
  const snapshot = await adminDb()
    .collection("users")
    .doc(studentId)
    .collection("vocabulary")
    .get();
  return snapshot.docs
    .map((document) => document.data() as VocabularyDoc)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function listReadingTests(
  studentId: string,
): Promise<ReadingTestDoc[]> {
  const snapshot = await adminDb()
    .collection("readingTests")
    .where("studentId", "==", studentId)
    .get();
  return snapshot.docs
    .map((document) => document.data() as ReadingTestDoc)
    .sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------
// Consommation Claude
// ---------------------------------------------------------------------------

export interface AiUsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** En dollars, recalcule a chaque lecture depuis `lib/ai-cost.ts`. */
  costUsd: number;
}

export interface AiUsage {
  total: AiUsageTotals;
  /** Par action du backend (`summarize`, `generate_exercises`…). */
  byAction: Map<string, AiUsageTotals>;
  byStudent: Map<string, AiUsageTotals>;
  /** Par professeur ayant inscrit l'eleve — `sans-prof` si le lien manque. */
  byTeacher: Map<string, AiUsageTotals>;
  /** Date du plus ancien appel connu, pour situer la periode couverte. */
  firstCallAt: number | null;
  /** Nombre d'appels dont le modele est inconnu (tarif par defaut applique). */
  unknownModelCalls: number;
}

export const NO_TEACHER_KEY = "sans-prof";

/**
 * Agrege la consommation de tokens. `scope` est l'identifiant du professeur,
 * `null` pour l'ecole entiere.
 *
 * Le cout est calcule appel par appel, avec le modele propre a chaque appel :
 * un total unique multiplie par un seul tarif serait faux des que le backend
 * change de modele en cours d'annee.
 */
export async function loadAiUsage(scope: string | null): Promise<AiUsage> {
  const snapshot = await scoped(adminDb().collection("aiCalls"), scope).get();

  const usage: AiUsage = {
    total: emptyUsage(),
    byAction: new Map(),
    byStudent: new Map(),
    byTeacher: new Map(),
    firstCallAt: null,
    unknownModelCalls: 0,
  };

  for (const document of snapshot.docs) {
    const call = document.data() as AiCallDoc;
    const cost = costOf(call, call.model);

    add(usage.total, call, cost);
    add(bucket(usage.byAction, call.action), call, cost);
    add(bucket(usage.byStudent, call.studentId), call, cost);
    add(bucket(usage.byTeacher, call.teacherId ?? NO_TEACHER_KEY), call, cost);

    if (!call.model) usage.unknownModelCalls += 1;
    if (usage.firstCallAt === null || call.at < usage.firstCallAt) {
      usage.firstCallAt = call.at;
    }
  }

  return usage;
}

function bucket(
  map: Map<string, AiUsageTotals>,
  key: string,
): AiUsageTotals {
  const existing = map.get(key);
  if (existing) return existing;
  const created = emptyUsage();
  map.set(key, created);
  return created;
}

function add(totals: AiUsageTotals, call: AiCallDoc, cost: number): void {
  totals.calls += 1;
  totals.inputTokens += call.inputTokens;
  totals.outputTokens += call.outputTokens;
  totals.cacheReadTokens += call.cacheReadTokens;
  totals.cacheWriteTokens += call.cacheWriteTokens;
  totals.costUsd += cost;
}

export function emptyUsage(): AiUsageTotals {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    costUsd: 0,
  };
}

function scoped<T extends FirebaseFirestore.Query>(
  query: T,
  teacherId: string | null,
): FirebaseFirestore.Query {
  return teacherId ? query.where("teacherId", "==", teacherId) : query;
}

function emptyStats(): StudentStats {
  return {
    sessions: 0,
    words: 0,
    readingTests: 0,
    readingAverage: null,
    lastReadingPercentage: null,
    exercises: 0,
    exerciseAccuracy: null,
    lastActivityAt: null,
  };
}

function emptyClassStats(): ClassStats {
  return {
    students: 0,
    activeThisWeek: 0,
    sessions: 0,
    words: 0,
    readingTests: 0,
    readingAverage: null,
  };
}
