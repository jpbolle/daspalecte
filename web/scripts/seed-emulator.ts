/**
 * Remplit l'emulateur Firestore avec une classe fictive, pour developper et
 * relire les ecrans prof/eleve avec des donnees realistes.
 *
 *   npm run seed
 *
 * Refuse de s'executer ailleurs que sur l'emulateur.
 */
import { randomUUID } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ingestBatch } from "../src/lib/ingest/write";
import { parseIngestBody } from "../src/lib/ingest/schema";
import type { UserDoc } from "../src/lib/types";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    "Refus : FIRESTORE_EMULATOR_HOST n'est pas defini. Ce script n'ecrit que sur l'emulateur.",
  );
  process.exit(1);
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "essai-27712";
const app = initializeApp({ projectId: PROJECT_ID }, `seed-${Date.now()}`);
const db = getFirestore(app);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "jeanphilippe.bolle@cnddinant.be";
const PROF = "sub-demo-prof";
const DAY = 86_400_000;

const STUDENTS = [
  { uid: "sub-demo-amira", name: "Amira Haddad", lang: "ar" },
  { uid: "sub-demo-dilan", name: "Dilan Yildiz", lang: "tr" },
  { uid: "sub-demo-olena", name: "Olena Kovalenko", lang: "uk" },
  { uid: "sub-demo-rahim", name: "Rahim Noori", lang: "fa" },
];

const TEXTS = [
  { url: "https://fr.wikipedia.org/wiki/Belgique", title: "Belgique — Wikipédia" },
  { url: "https://www.1jour1actu.com/monde/les-abeilles", title: "Les abeilles" },
  { url: "https://docs.google.com/document/d/demo", title: "Le loup et l'agneau" },
];

const WORDS = [
  ["frontière", "border"],
  ["fleuve", "river"],
  ["habitant", "inhabitant"],
  ["ruche", "hive"],
  ["butiner", "to forage"],
  ["pollen", "pollen"],
  ["agneau", "lamb"],
  ["ruisseau", "stream"],
  ["troubler", "to disturb"],
  ["châtiment", "punishment"],
];

const EXERCISES = [
  "matching",
  "listening_matching",
  "tags",
  "reading",
  "family",
  "cloze",
  "sentence",
] as const;

async function main() {
  await wipe();

  await putUser({
    uid: "sub-demo-admin",
    role: "admin",
    email: ADMIN_EMAIL,
    displayName: "Jean-Philippe Bolle",
    teacherId: null,
  });
  await putUser({
    uid: PROF,
    role: "teacher",
    email: "prof.demo@cnddinant.be",
    displayName: "Claire Dubois",
    teacherId: null,
  });

  await db.collection("invitations").doc("nouvel.eleve@cnddinant.be").set({
    email: "nouvel.eleve@cnddinant.be",
    role: "student",
    teacherId: PROF,
    invitedBy: PROF,
    displayName: "Nouvel Élève",
    createdAt: Date.now() - 2 * DAY,
    claimedAt: null,
    claimedBy: null,
  });

  for (const [index, student] of STUDENTS.entries()) {
    await putUser({
      uid: student.uid,
      role: "student",
      email: `${student.name.split(" ")[0].toLowerCase()}@cnddinant.be`,
      displayName: student.name,
      teacherId: PROF,
    });

    // Le dernier eleve n'a encore rien fait : il sert d'etat vide.
    if (index === STUDENTS.length - 1) continue;

    const sessionCount = 2 + index;
    for (let s = 0; s < sessionCount; s += 1) {
      await seedSession(student, s, index);
    }
  }

  console.log(
    `Classe de demonstration prete : ${STUDENTS.length} eleves, 1 prof, 1 admin.`,
  );
}

async function seedSession(
  student: (typeof STUDENTS)[number],
  index: number,
  offset: number,
) {
  const text = TEXTS[(index + offset) % TEXTS.length];
  const startedAt = Date.now() - (index + 1) * DAY - offset * 3 * 3_600_000;
  const events: Record<string, unknown>[] = [];

  const wordCount = 3 + ((index + offset) % 5);
  for (let w = 0; w < wordCount; w += 1) {
    const [word, translation] = WORDS[(index * 3 + w) % WORDS.length];
    events.push({
      id: randomUUID(),
      type: "word",
      at: startedAt + w * 45_000,
      payload: { word, translation, nativeLanguage: student.lang },
    });
  }

  events.push({
    id: randomUUID(),
    type: "comprehension",
    at: startedAt + 6 * 60_000,
    payload: { textLength: 780 },
  });

  const exerciseCount = 3 + ((index + offset) % 4);
  for (let e = 0; e < exerciseCount; e += 1) {
    const total = 10;
    const score = 5 + ((index + offset + e) % 6);
    events.push({
      id: randomUUID(),
      type: "exercise",
      at: startedAt + (10 + e * 3) * 60_000,
      payload: {
        exerciseType: EXERCISES[e % EXERCISES.length],
        score,
        total,
        attempts: 1 + (e % 3),
        words: WORDS.slice(0, 4).map(([word]) => word),
      },
    });
  }

  // Une session sur deux se termine par un test de lecture.
  if (index % 2 === 0) {
    const mcqScore = 5 + ((index + offset) % 6);
    const matchingScore = 2 + ((index + offset) % 4);
    const percentage = Math.round(((mcqScore + matchingScore) / 15) * 100);
    events.push({
      id: randomUUID(),
      type: "reading_test",
      at: startedAt + 35 * 60_000,
      payload: {
        mcqScore,
        mcqTotal: 10,
        matchingScore,
        matchingTotal: 5,
        percentage,
        pageUrl: text.url,
        pageTitle: text.title,
      },
    });
  }

  const parsed = parseIngestBody({
    source: text.url.includes("docs.google.com") ? "addon" : "extension",
    session: {
      id: randomUUID(),
      startedAt,
      context: {
        url: text.url,
        title: text.title,
        hostApp: text.url.includes("docs.google.com") ? "docs" : "web",
      },
    },
    events,
  });

  if (!parsed.ok) throw new Error(`corps invalide : ${parsed.error}`);
  await ingestBatch(db, { studentId: student.uid, teacherId: PROF }, parsed.body);
}

async function putUser(
  user: Pick<UserDoc, "uid" | "role" | "email" | "displayName" | "teacherId">,
) {
  const now = Date.now();
  await db.collection("users").doc(user.uid).set({
    ...user,
    firebaseUid: null,
    photoURL: null,
    createdAt: now - 30 * DAY,
    lastSeenAt: now - Math.floor(Math.random() * 5) * DAY,
  });
}

async function wipe() {
  for (const name of [
    "users",
    "invitations",
    "sessions",
    "readingTests",
    "exerciseResults",
  ]) {
    const snapshot = await db.collection(name).get();
    for (const document of snapshot.docs) {
      for (const sub of await document.ref.listCollections()) {
        const nested = await sub.get();
        await Promise.all(nested.docs.map((entry) => entry.ref.delete()));
      }
      await document.ref.delete();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
