import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { parseIngestBody, type IngestBody } from "@/lib/ingest/schema";
import { ingestBatch } from "@/lib/ingest/write";

/**
 * Ecritures d'ingestion, testees contre l'emulateur Firestore.
 * Prerequis : `firebase emulators:start --only firestore` (JDK requis) et
 * FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.
 */

const PROJECT_ID = "daspalecte-ingest-test";
const STUDENT = "sub-eleve-ingest";
const TEACHER = "sub-prof-ingest";

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

before(() => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    "FIRESTORE_EMULATOR_HOST doit pointer vers l'emulateur",
  );
  app = initializeApp({ projectId: PROJECT_ID }, `ingest-${Date.now()}`);
  db = getFirestore(app);
});

after(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await clearCollections();
  await db.collection("users").doc(STUDENT).set({
    uid: STUDENT,
    role: "student",
    email: "eleve@cnddinant.be",
    displayName: "Eleve Ingest",
    teacherId: TEACHER,
    createdAt: Date.now(),
    lastSeenAt: 0,
  });
});

const target = { studentId: STUDENT, teacherId: TEACHER };

function body(events: unknown[], sessionId = "session-test"): IngestBody {
  const parsed = parseIngestBody({
    source: "extension",
    session: {
      id: sessionId,
      startedAt: Date.now() - 60_000,
      context: {
        url: "https://fr.wikipedia.org/wiki/Belgique",
        title: "Belgique",
        hostApp: "web",
      },
    },
    events,
  });
  assert.equal(parsed.ok, true, `corps invalide : ${JSON.stringify(parsed)}`);
  return (parsed as { ok: true; body: IngestBody }).body;
}

describe("ingestBatch", () => {
  it("enregistre les evenements, la session et ses compteurs", async () => {
    const accepted = await ingestBatch(
      db,
      target,
      body([
        {
          id: "e1",
          type: "word",
          at: Date.now(),
          payload: { word: "Élève", translation: "student", nativeLanguage: "en" },
        },
        {
          id: "e2",
          type: "comprehension",
          at: Date.now(),
          payload: { textLength: 420 },
        },
      ]),
    );

    assert.equal(accepted, 2);

    const session = await db.collection("sessions").doc("session-test").get();
    assert.equal(session.data()?.studentId, STUDENT);
    assert.equal(session.data()?.teacherId, TEACHER);
    assert.equal(session.data()?.counters.words, 1);
    assert.equal(session.data()?.counters.comprehensions, 1);

    const events = await session.ref.collection("events").get();
    assert.equal(events.size, 2);
    // Denormalisation indispensable : les regles lisent studentId/teacherId
    // sur l'evenement lui-meme, sans get() vers la session.
    assert.equal(events.docs[0].data().studentId, STUDENT);
  });

  it("normalise les mots et cumule les traductions repetees", async () => {
    // Horodatages recents : clampTime() ramene au present tout ce qui a plus
    // d'un an, pour se proteger d'une horloge cliente deraillee.
    const premier = Date.now() - 120_000;
    const second = Date.now() - 60_000;

    await ingestBatch(
      db,
      target,
      body([
        {
          id: "w1",
          type: "word",
          at: premier,
          payload: { word: "Élève", translation: "student" },
        },
      ]),
    );
    await ingestBatch(
      db,
      target,
      body([
        {
          id: "w2",
          type: "word",
          at: second,
          payload: { word: "eleve.", translation: "student" },
        },
      ]),
    );

    const vocabulary = await db
      .collection("users")
      .doc(STUDENT)
      .collection("vocabulary")
      .get();

    assert.equal(vocabulary.size, 1, "« Élève » et « eleve. » sont le meme mot");
    const entry = vocabulary.docs[0].data();
    assert.equal(entry.timesTranslated, 2);
    assert.equal(entry.firstSeenAt, premier, "firstSeenAt ne bouge plus");
    assert.equal(entry.lastSeenAt, second);
  });

  it("ignore un lot rejoue, sans doubler les compteurs", async () => {
    const payload = body([
      {
        id: "dup",
        type: "word",
        at: Date.now(),
        payload: { word: "chat", translation: "cat" },
      },
    ]);

    assert.equal(await ingestBatch(db, target, payload), 1);
    assert.equal(await ingestBatch(db, target, payload), 0);

    const session = await db.collection("sessions").doc("session-test").get();
    assert.equal(session.data()?.counters.words, 1);

    const vocabulary = await db
      .collection("users")
      .doc(STUDENT)
      .collection("vocabulary")
      .doc("chat")
      .get();
    assert.equal(vocabulary.data()?.timesTranslated, 1);
  });

  it("ne reecrit pas startedAt lors des lots suivants", async () => {
    const first = body([
      { id: "a", type: "capture", at: Date.now(), payload: {} },
    ]);
    await ingestBatch(db, target, first);
    const startedAt = (
      await db.collection("sessions").doc("session-test").get()
    ).data()?.startedAt;

    const second = body([
      { id: "b", type: "capture", at: Date.now(), payload: {} },
    ]);
    second.session.startedAt = Date.now();
    await ingestBatch(db, target, second);

    const after = await db.collection("sessions").doc("session-test").get();
    assert.equal(after.data()?.startedAt, startedAt);
    assert.equal(after.data()?.counters.captures, 2);
  });

  it("projette un test de lecture dans readingTests", async () => {
    await ingestBatch(
      db,
      target,
      body([
        {
          id: "rt1",
          type: "reading_test",
          at: Date.now(),
          payload: {
            mcqScore: 7,
            mcqTotal: 10,
            matchingScore: 4,
            matchingTotal: 5,
            percentage: 73,
            pageUrl: "https://exemple.be/texte",
            pageTitle: "Un texte",
          },
        },
      ]),
    );

    const test = await db.collection("readingTests").doc("rt1").get();
    assert.equal(test.data()?.percentage, 73);
    assert.equal(test.data()?.studentId, STUDENT);
    assert.equal(test.data()?.teacherId, TEACHER);
    assert.equal(test.data()?.sessionId, "session-test");
  });

  it("projette un exercice reussi dans exerciseResults", async () => {
    await ingestBatch(
      db,
      target,
      body([
        {
          id: "ex1",
          type: "exercise",
          at: Date.now(),
          payload: {
            exerciseType: "cloze",
            score: 8,
            total: 10,
            attempts: 2,
            words: ["chat", "chien"],
          },
        },
        {
          id: "ex2",
          type: "exercise",
          at: Date.now(),
          payload: { exerciseType: "inconnu", score: 1, total: 1 },
        },
      ]),
    );

    const results = await db.collection("exerciseResults").get();
    assert.equal(results.size, 1, "un type d'exercice inconnu n'est pas projete");
    assert.equal(results.docs[0].data().exerciseType, "cloze");
    assert.equal(results.docs[0].data().attempts, 2);

    // L'evenement brut est conserve dans tous les cas.
    const events = await db
      .collection("sessions")
      .doc("session-test")
      .collection("events")
      .get();
    assert.equal(events.size, 2);
  });

  it("projette un appel a Claude dans aiCalls", async () => {
    await ingestBatch(
      db,
      target,
      body([
        {
          id: "ai1",
          type: "ai_call",
          at: Date.now(),
          payload: {
            action: "generate_exercises",
            model: "claude-sonnet-4-5-20250929",
            inputTokens: 1200,
            outputTokens: 800,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
        },
        // Sans action, la depense n'est rattachable a rien : pas de projection.
        {
          id: "ai2",
          type: "ai_call",
          at: Date.now(),
          payload: { inputTokens: 10, outputTokens: 5 },
        },
      ]),
    );

    const calls = await db.collection("aiCalls").get();
    assert.equal(calls.size, 1, "un appel sans action n'est pas projete");

    const call = calls.docs[0].data();
    assert.equal(call.action, "generate_exercises");
    assert.equal(call.model, "claude-sonnet-4-5-20250929");
    assert.equal(call.inputTokens, 1200);
    assert.equal(call.outputTokens, 800);
    assert.equal(call.studentId, STUDENT);
    assert.equal(call.teacherId, TEACHER);
    assert.equal(call.sessionId, "session-test");
    assert.equal(call.source, "extension");

    // Les deux evenements bruts restent au journal de la session.
    const events = await db
      .collection("sessions")
      .doc("session-test")
      .collection("events")
      .get();
    assert.equal(events.size, 2);
  });

  it("ne compte pas deux fois un appel a Claude rejoue", async () => {
    const payload = body([
      {
        id: "ai-rejoue",
        type: "ai_call",
        at: Date.now(),
        payload: {
          action: "summarize",
          model: "claude-sonnet-4-5-20250929",
          inputTokens: 500,
          outputTokens: 100,
        },
      },
    ]);

    assert.equal(await ingestBatch(db, target, payload), 1);
    assert.equal(await ingestBatch(db, target, payload), 0);

    const calls = await db.collection("aiCalls").get();
    assert.equal(calls.size, 1);
    assert.equal(calls.docs[0].data().inputTokens, 500);
  });

  it("met a jour la derniere activite de l'eleve", async () => {
    await ingestBatch(
      db,
      target,
      body([{ id: "x", type: "capture", at: Date.now(), payload: {} }]),
    );
    const user = await db.collection("users").doc(STUDENT).get();
    assert.ok((user.data()?.lastSeenAt ?? 0) > 0);
  });
});

describe("parseIngestBody", () => {
  it("refuse un lot trop gros", () => {
    const events = Array.from({ length: 101 }, (_, index) => ({
      id: `e${index}`,
      type: "capture",
      at: Date.now(),
      payload: {},
    }));
    const parsed = parseIngestBody({
      source: "extension",
      session: { id: "s", startedAt: Date.now(), context: {} },
      events,
    });
    assert.deepEqual(parsed, { ok: false, error: "too_many_events" });
  });

  it("refuse un type d'evenement inconnu", () => {
    const parsed = parseIngestBody({
      source: "extension",
      session: { id: "s", startedAt: Date.now(), context: {} },
      events: [{ id: "e", type: "piratage", at: Date.now(), payload: {} }],
    });
    assert.deepEqual(parsed, { ok: false, error: "invalid_event_type" });
  });

  it("ramene au present une horloge cliente dans le futur", () => {
    const before = Date.now();
    const parsed = parseIngestBody({
      source: "extension",
      session: { id: "s", startedAt: Date.now(), context: {} },
      events: [
        { id: "e", type: "capture", at: Date.now() + 86_400_000, payload: {} },
      ],
    });
    assert.equal(parsed.ok, true);
    const at = (parsed as { ok: true; body: IngestBody }).body.events[0].at;
    assert.ok(at >= before && at <= Date.now());
  });
});

async function clearCollections() {
  for (const name of [
    "sessions",
    "readingTests",
    "exerciseResults",
    "aiCalls",
    "users",
  ]) {
    const snapshot = await db.collection(name).get();
    await Promise.all(
      snapshot.docs.map(async (document) => {
        const sub = await document.ref.listCollections();
        for (const collection of sub) {
          const nested = await collection.get();
          await Promise.all(nested.docs.map((entry) => entry.ref.delete()));
        }
        await document.ref.delete();
      }),
    );
  }
}

