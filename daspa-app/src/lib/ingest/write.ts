import "server-only";

import { FieldValue, type Firestore, type WriteBatch } from "firebase-admin/firestore";
import { isExerciseType, normalizeWord, type IngestBody, type IngestEvent } from "./schema";
import type { SessionCounters } from "@/lib/types";

export interface IngestTarget {
  studentId: string;
  teacherId: string | null;
}

/**
 * Ecrit un lot d'evenements : le journal de la session, ses compteurs, et les
 * collections de synthese (vocabulaire, tests de lecture, exercices) que
 * lisent directement les tableaux prof et eleve.
 *
 * Renvoie le nombre d'evenements reellement enregistres — un lot rejoue apres
 * une coupure reseau renvoie 0 sans rien reecrire.
 */
export async function ingestBatch(
  db: Firestore,
  target: IngestTarget,
  body: IngestBody,
): Promise<number> {
  const { studentId, teacherId } = target;
  const { session, events, source } = body;

  const sessionRef = db.collection("sessions").doc(session.id);
  const eventsRef = sessionRef.collection("events");

  // Un seul aller-retour de lecture pour tout ce qui doit etre connu avant
  // d'ecrire : la session existe-t-elle deja, quels evenements sont deja
  // enregistres, quels mots sont deja au vocabulaire.
  const eventRefs = events.map((event) => eventsRef.doc(event.id));
  const wordKeys = distinctWordKeys(events);
  const vocabularyRefs = wordKeys.map((key) =>
    db.collection("users").doc(studentId).collection("vocabulary").doc(key),
  );

  const snapshots = await db.getAll(sessionRef, ...eventRefs, ...vocabularyRefs, {
    fieldMask: [],
  });

  const sessionExists = snapshots[0].exists;
  const alreadyStored = new Set(
    snapshots
      .slice(1, 1 + eventRefs.length)
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => snapshot.id),
  );
  const knownWords = new Set(
    snapshots
      .slice(1 + eventRefs.length)
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => snapshot.id),
  );

  // Idempotence : les identifiants d'evenement viennent du client, on peut
  // donc ecarter ce qui est deja enregistre — sinon les compteurs seraient
  // incrementes deux fois par un simple rejeu.
  const fresh = events.filter((event) => !alreadyStored.has(event.id));
  if (fresh.length === 0) return 0;

  const batch = db.batch();
  const counters = emptyCounters();
  let lastActivityAt = session.startedAt;

  for (const event of fresh) {
    lastActivityAt = Math.max(lastActivityAt, event.at);

    batch.set(eventsRef.doc(event.id), {
      id: event.id,
      type: event.type,
      at: event.at,
      studentId,
      teacherId,
      payload: event.payload,
    });

    applyDerivedWrites({
      batch,
      db,
      event,
      studentId,
      teacherId,
      sessionId: session.id,
      source,
      counters,
      knownWords,
    });
  }

  batch.set(
    sessionRef,
    {
      id: session.id,
      studentId,
      teacherId,
      source,
      context: session.context,
      // `startedAt` ne doit pas etre reecrit par les lots suivants de la meme
      // session, sinon la duree affichee au prof serait fausse.
      ...(sessionExists ? {} : { startedAt: session.startedAt }),
      lastActivityAt,
      counters: incrementMap(counters),
    },
    { merge: true },
  );

  batch.update(db.collection("users").doc(studentId), {
    lastSeenAt: Date.now(),
  });

  await batch.commit();
  return fresh.length;
}

interface DerivedContext {
  batch: WriteBatch;
  db: Firestore;
  event: IngestEvent;
  studentId: string;
  teacherId: string | null;
  sessionId: string;
  source: IngestBody["source"];
  counters: SessionCounters;
  /** Mots deja presents au vocabulaire : leur `firstSeenAt` ne bouge plus. */
  knownWords: Set<string>;
}

function applyDerivedWrites(context: DerivedContext) {
  const {
    batch,
    db,
    event,
    studentId,
    teacherId,
    sessionId,
    source,
    counters,
    knownWords,
  } = context;
  const payload = event.payload;

  switch (event.type) {
    case "word": {
      const word = asString(payload.word);
      const key = word ? normalizeWord(word) : null;
      if (!word || !key) return;

      counters.words += 1;
      batch.set(
        db.collection("users").doc(studentId).collection("vocabulary").doc(key),
        {
          id: key,
          word,
          translation: asString(payload.translation) ?? "",
          nativeLanguage: asString(payload.nativeLanguage) ?? "",
          teacherId,
          ...(knownWords.has(key) ? {} : { firstSeenAt: event.at }),
          lastSeenAt: event.at,
          timesTranslated: FieldValue.increment(1),
        },
        { merge: true },
      );
      knownWords.add(key);
      return;
    }

    case "reading_test": {
      counters.readingTests += 1;
      batch.set(db.collection("readingTests").doc(event.id), {
        id: event.id,
        studentId,
        teacherId,
        sessionId,
        at: event.at,
        mcqScore: asNumber(payload.mcqScore),
        mcqTotal: asNumber(payload.mcqTotal),
        matchingScore: asNumber(payload.matchingScore),
        matchingTotal: asNumber(payload.matchingTotal),
        percentage: asNumber(payload.percentage),
        pageUrl: asString(payload.pageUrl),
        pageTitle: asString(payload.pageTitle),
      });
      return;
    }

    case "exercise": {
      counters.exercises += 1;
      const exerciseType = payload.exerciseType;
      if (!isExerciseType(exerciseType)) return;

      batch.set(db.collection("exerciseResults").doc(event.id), {
        id: event.id,
        studentId,
        teacherId,
        sessionId,
        at: event.at,
        exerciseType,
        score: asNumber(payload.score),
        total: asNumber(payload.total),
        attempts: Math.max(1, asNumber(payload.attempts)),
        words: asStringArray(payload.words),
      });
      return;
    }

    case "ai_call": {
      const action = asString(payload.action);
      // Sans action on ne sait pas a quoi rattacher la depense : l'evenement
      // reste au journal de la session, mais n'entre pas dans les couts.
      if (!action) return;

      batch.set(db.collection("aiCalls").doc(event.id), {
        id: event.id,
        studentId,
        teacherId,
        sessionId,
        at: event.at,
        action,
        model: asString(payload.model),
        inputTokens: asNumber(payload.inputTokens),
        outputTokens: asNumber(payload.outputTokens),
        cacheReadTokens: asNumber(payload.cacheReadTokens),
        cacheWriteTokens: asNumber(payload.cacheWriteTokens),
        source,
      });
      return;
    }

    case "comprehension":
      counters.comprehensions += 1;
      return;

    case "capture":
      counters.captures += 1;
      return;
  }
}

function distinctWordKeys(events: IngestEvent[]): string[] {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.type !== "word") continue;
    const word = asString(event.payload.word);
    if (!word) continue;
    const key = normalizeWord(word);
    if (key) keys.add(key);
  }
  return [...keys];
}

function emptyCounters(): SessionCounters {
  return {
    words: 0,
    exercises: 0,
    readingTests: 0,
    comprehensions: 0,
    captures: 0,
  };
}

/** Les compteurs de session s'ajoutent : une session recoit plusieurs lots. */
function incrementMap(counters: SessionCounters) {
  return Object.fromEntries(
    Object.entries(counters).map(([key, value]) => [
      key,
      FieldValue.increment(value),
    ]),
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0
    ? value.slice(0, 500)
    : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .slice(0, 50)
    .map((item) => item.slice(0, 100));
}
