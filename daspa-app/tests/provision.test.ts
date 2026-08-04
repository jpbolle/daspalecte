import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, getApps, type App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { resolveAccount } from "@/lib/auth/provision";

// Pose avant le premier appel a adminDb() — c'est lui qui initialise l'app Admin,
// et il lit le projet dans l'environnement. Les modules importes ci-dessus ne
// font que definir des fonctions, ils ne touchent pas encore a Firestore.
process.env.FIREBASE_PROJECT_ID = "daspalecte-provision-test";
process.env.ADMIN_EMAIL = "admin.test@cnddinant.be";

const TEACHER = "sub-prof-provision";

let db: Firestore;

before(() => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    "FIRESTORE_EMULATOR_HOST doit pointer sur l'emulateur",
  );
  db = adminDb();
});

beforeEach(async () => {
  for (const name of ["users", "invitations"]) {
    const snapshot = await db.collection(name).get();
    await Promise.all(snapshot.docs.map((document) => document.ref.delete()));
  }
});

after(async () => {
  await Promise.all(getApps().map((app: App) => deleteApp(app)));
});

async function invite(
  email: string,
  fields: Record<string, unknown> = {},
): Promise<void> {
  await db.collection("invitations").doc(email).set({
    email,
    role: "student",
    teacherId: TEACHER,
    invitedBy: TEACHER,
    displayName: "Amina Diallo",
    firstName: "Amina",
    lastName: "Diallo",
    schoolClass: "3B",
    createdAt: Date.now(),
    claimedAt: null,
    claimedBy: null,
    ...fields,
  });
}

const identity = (email: string) => ({
  googleSub: "sub-nouvel-eleve",
  email,
  displayName: null,
  photoURL: null,
  firebaseUid: "firebase-nouvel-eleve",
});

describe("resolveAccount", () => {
  it("recopie la classe de l'invitation sur le compte", async () => {
    await invite("amina@cnddinant.be");

    const result = await resolveAccount(identity("amina@cnddinant.be"));
    assert.equal(result.status, "ok");

    const user = (
      await db.collection("users").doc("sub-nouvel-eleve").get()
    ).data();
    assert.equal(user?.schoolClass, "3B");
    assert.equal(user?.teacherId, TEACHER);
    assert.equal(user?.role, "student");
    // Faute de nom Google, celui saisi par le prof sert de repli.
    assert.equal(user?.displayName, "Amina Diallo");
  });

  it("laisse la classe vide quand le prof ne l'a pas saisie", async () => {
    await invite("amina@cnddinant.be", { schoolClass: null });

    await resolveAccount(identity("amina@cnddinant.be"));

    const user = (
      await db.collection("users").doc("sub-nouvel-eleve").get()
    ).data();
    assert.equal(user?.schoolClass, null);
  });

  it("tolere une invitation anterieure a l'ajout du champ", async () => {
    // Invitations creees avant la migration : le champ est absent, pas null.
    await db.collection("invitations").doc("ancienne@cnddinant.be").set({
      email: "ancienne@cnddinant.be",
      role: "student",
      teacherId: TEACHER,
      invitedBy: TEACHER,
      displayName: "Ancien Compte",
      createdAt: Date.now(),
      claimedAt: null,
      claimedBy: null,
    });

    const result = await resolveAccount(identity("ancienne@cnddinant.be"));
    assert.equal(result.status, "ok");

    const user = (
      await db.collection("users").doc("sub-nouvel-eleve").get()
    ).data();
    assert.equal(user?.schoolClass, null, "jamais undefined en base");
  });

  it("n'attribue pas de classe a un professeur", async () => {
    await invite("prof@cnddinant.be", {
      role: "teacher",
      teacherId: null,
      schoolClass: "3B",
    });

    const result = await resolveAccount(identity("prof@cnddinant.be"));
    assert.equal(result.status, "ok");

    const user = (
      await db.collection("users").doc("sub-nouvel-eleve").get()
    ).data();
    assert.equal(user?.role, "teacher");
    assert.equal(user?.schoolClass, null);
    assert.equal(user?.teacherId, null);
  });

  it("refuse un compte sans invitation", async () => {
    const result = await resolveAccount(identity("inconnu@cnddinant.be"));
    assert.deepEqual(result, {
      status: "unknown",
      email: "inconnu@cnddinant.be",
    });
  });

  it("cree l'admin d'amorcage sans invitation ni classe", async () => {
    const result = await resolveAccount(identity("admin.test@cnddinant.be"));
    assert.equal(result.status, "ok");
    assert.equal(result.status === "ok" && result.role, "admin");

    const user = (
      await db.collection("users").doc("sub-nouvel-eleve").get()
    ).data();
    assert.equal(user?.schoolClass, null);
  });

  it("marque l'invitation comme consommee", async () => {
    await invite("amina@cnddinant.be");
    await resolveAccount(identity("amina@cnddinant.be"));

    const invitation = (
      await db.collection("invitations").doc("amina@cnddinant.be").get()
    ).data();
    assert.ok(invitation?.claimedAt);
    assert.equal(invitation?.claimedBy, "sub-nouvel-eleve");
  });
});
