import "server-only";

import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * SDK Admin — c'est lui, et lui seul, qui ecrit dans Firestore.
 * Les regles (firestore.rules) ne laissent au client que la lecture.
 *
 * En local : les variables FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
 * suffisent, aucune clef de service n'est necessaire.
 * Sur App Hosting : les credentials par defaut du service sont utilises.
 */
function adminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  return initializeApp(
    usingEmulator
      ? { projectId }
      : { credential: applicationDefault(), projectId },
  );
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}
