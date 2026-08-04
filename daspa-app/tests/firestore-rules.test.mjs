import { after, before, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

/**
 * Les regles sont testees sur l'emulateur : `firebase emulators:start --only firestore`
 * doit tourner (le JDK est requis).
 *
 * Rappel du modele : l'identifiant partout est le `sub` Google, transporte dans
 * le custom claim `gsub`. request.auth.uid (uid Firebase Auth) n'est jamais
 * compare a quoi que ce soit.
 */

const PROF = "sub-prof-1";
const AUTRE_PROF = "sub-prof-2";
const ELEVE = "sub-eleve-1";
const AUTRE_ELEVE = "sub-eleve-2";

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "daspalecte-rules-test",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync(
        new URL("../../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "users", ELEVE), {
      uid: ELEVE,
      role: "student",
      email: "eleve1@cnddinant.be",
      displayName: "Eleve Un",
      teacherId: PROF,
      lastSeenAt: Date.now(),
    });
    await setDoc(doc(db, "users", AUTRE_ELEVE), {
      uid: AUTRE_ELEVE,
      role: "student",
      email: "eleve2@cnddinant.be",
      displayName: "Eleve Deux",
      teacherId: AUTRE_PROF,
      lastSeenAt: Date.now(),
    });
    await setDoc(doc(db, "users", PROF), {
      uid: PROF,
      role: "teacher",
      email: "prof1@cnddinant.be",
      displayName: "Prof Un",
      teacherId: null,
    });

    await setDoc(doc(db, "users", ELEVE, "vocabulary", "chat"), {
      id: "chat",
      word: "chat",
      translation: "cat",
      teacherId: PROF,
    });

    await setDoc(doc(db, "sessions", "session-1"), {
      id: "session-1",
      studentId: ELEVE,
      teacherId: PROF,
      lastActivityAt: Date.now(),
    });
    await setDoc(doc(db, "sessions", "session-1", "events", "event-1"), {
      id: "event-1",
      type: "word",
      studentId: ELEVE,
      teacherId: PROF,
      at: Date.now(),
    });
    await setDoc(doc(db, "readingTests", "test-1"), {
      id: "test-1",
      studentId: ELEVE,
      teacherId: PROF,
      at: Date.now(),
      percentage: 80,
    });

    await setDoc(doc(db, "aiCalls", "appel-1"), {
      id: "appel-1",
      studentId: ELEVE,
      teacherId: PROF,
      sessionId: "session-1",
      at: Date.now(),
      action: "generate_exercises",
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 1200,
      outputTokens: 800,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      source: "extension",
    });

    await setDoc(doc(db, "invitations", "nouveau@cnddinant.be"), {
      email: "nouveau@cnddinant.be",
      role: "student",
      teacherId: PROF,
      invitedBy: PROF,
      claimedAt: null,
    });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

const asStudent = (gsub) =>
  testEnv
    .authenticatedContext(`firebase-${gsub}`, { role: "student", gsub })
    .firestore();

const asTeacher = (gsub) =>
  testEnv
    .authenticatedContext(`firebase-${gsub}`, { role: "teacher", gsub })
    .firestore();

const asAdmin = () =>
  testEnv
    .authenticatedContext("firebase-admin", { role: "admin", gsub: "sub-admin" })
    .firestore();

describe("users", () => {
  it("un eleve lit sa propre fiche", async () => {
    await assertSucceeds(getDoc(doc(asStudent(ELEVE), "users", ELEVE)));
  });

  it("un eleve ne lit pas la fiche d'un autre eleve", async () => {
    await assertFails(getDoc(doc(asStudent(ELEVE), "users", AUTRE_ELEVE)));
  });

  it("un prof lit la fiche de son eleve", async () => {
    await assertSucceeds(getDoc(doc(asTeacher(PROF), "users", ELEVE)));
  });

  it("un prof ne lit pas l'eleve d'un collegue", async () => {
    await assertFails(getDoc(doc(asTeacher(AUTRE_PROF), "users", ELEVE)));
  });

  it("un prof liste ses eleves", async () => {
    await assertSucceeds(
      getDocs(
        query(collection(asTeacher(PROF), "users"), where("teacherId", "==", PROF)),
      ),
    );
  });

  it("un prof ne liste pas tous les utilisateurs", async () => {
    await assertFails(getDocs(collection(asTeacher(PROF), "users")));
  });

  it("l'admin lit n'importe quelle fiche", async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), "users", AUTRE_ELEVE)));
  });

  it("un jeton sans claim gsub n'a acces a rien", async () => {
    const db = testEnv
      .authenticatedContext("firebase-x", { role: "student" })
      .firestore();
    await assertFails(getDoc(doc(db, "users", ELEVE)));
  });

  it("un visiteur non connecte n'a acces a rien", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "users", ELEVE)));
  });
});

describe("vocabulaire", () => {
  it("l'eleve lit ses mots", async () => {
    await assertSucceeds(
      getDoc(doc(asStudent(ELEVE), "users", ELEVE, "vocabulary", "chat")),
    );
  });

  it("son prof lit ses mots", async () => {
    await assertSucceeds(
      getDoc(doc(asTeacher(PROF), "users", ELEVE, "vocabulary", "chat")),
    );
  });

  it("un autre eleve ne lit pas ses mots", async () => {
    await assertFails(
      getDoc(doc(asStudent(AUTRE_ELEVE), "users", ELEVE, "vocabulary", "chat")),
    );
  });
});

describe("sessions et resultats", () => {
  it("l'eleve lit sa session", async () => {
    await assertSucceeds(getDoc(doc(asStudent(ELEVE), "sessions", "session-1")));
  });

  it("l'eleve lit les evenements de sa session", async () => {
    await assertSucceeds(
      getDoc(doc(asStudent(ELEVE), "sessions", "session-1", "events", "event-1")),
    );
  });

  it("un autre eleve ne lit pas cette session", async () => {
    await assertFails(
      getDoc(doc(asStudent(AUTRE_ELEVE), "sessions", "session-1")),
    );
  });

  it("le prof liste les sessions de sa classe", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(asTeacher(PROF), "sessions"),
          where("teacherId", "==", PROF),
        ),
      ),
    );
  });

  it("un prof ne liste pas les sessions d'un collegue", async () => {
    await assertFails(
      getDocs(
        query(
          collection(asTeacher(AUTRE_PROF), "sessions"),
          where("teacherId", "==", PROF),
        ),
      ),
    );
  });

  it("le prof lit les tests de lecture de son eleve", async () => {
    await assertSucceeds(
      getDoc(doc(asTeacher(PROF), "readingTests", "test-1")),
    );
  });
});

describe("appels a Claude", () => {
  it("l'admin lit n'importe quel appel", async () => {
    await assertSucceeds(getDoc(doc(asAdmin(), "aiCalls", "appel-1")));
  });

  it("le prof de l'eleve lit l'appel", async () => {
    await assertSucceeds(getDoc(doc(asTeacher(PROF), "aiCalls", "appel-1")));
  });

  it("l'eleve concerne lit son propre appel", async () => {
    await assertSucceeds(getDoc(doc(asStudent(ELEVE), "aiCalls", "appel-1")));
  });

  it("un collegue ne lit pas les appels des eleves d'un autre prof", async () => {
    await assertFails(
      getDoc(doc(asTeacher(AUTRE_PROF), "aiCalls", "appel-1")),
    );
  });

  it("un autre eleve ne lit pas cet appel", async () => {
    await assertFails(
      getDoc(doc(asStudent(AUTRE_ELEVE), "aiCalls", "appel-1")),
    );
  });

  it("l'admin liste toute la consommation de l'ecole", async () => {
    await assertSucceeds(getDocs(collection(asAdmin(), "aiCalls")));
  });

  it("un prof liste la consommation de sa seule classe", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(asTeacher(PROF), "aiCalls"),
          where("teacherId", "==", PROF),
        ),
      ),
    );
  });

  it("un prof ne liste pas la consommation d'un collegue", async () => {
    await assertFails(
      getDocs(
        query(
          collection(asTeacher(AUTRE_PROF), "aiCalls"),
          where("teacherId", "==", PROF),
        ),
      ),
    );
  });
});

describe("invitations", () => {
  it("le prof qui a invite peut relire son invitation", async () => {
    await assertSucceeds(
      getDoc(doc(asTeacher(PROF), "invitations", "nouveau@cnddinant.be")),
    );
  });

  it("un eleve ne lit pas les invitations", async () => {
    await assertFails(
      getDoc(doc(asStudent(ELEVE), "invitations", "nouveau@cnddinant.be")),
    );
  });
});

describe("ecritures", () => {
  it("aucun client ne peut ecrire, meme sur ses propres donnees", async () => {
    await assertFails(
      setDoc(doc(asStudent(ELEVE), "users", ELEVE), { role: "admin" }),
    );
    await assertFails(
      setDoc(doc(asTeacher(PROF), "sessions", "session-2"), {
        studentId: ELEVE,
        teacherId: PROF,
      }),
    );
    await assertFails(
      setDoc(doc(asAdmin(), "readingTests", "test-2"), { percentage: 100 }),
    );
  });
});
