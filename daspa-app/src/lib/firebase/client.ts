import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getClientAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(app);
    if (useEmulators) {
      connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    }
  }
  return authInstance;
}

export function getClientDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(app);
    if (useEmulators) {
      connectFirestoreEmulator(dbInstance, "127.0.0.1", 8080);
    }
  }
  return dbInstance;
}

export function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Force le choix du compte : sur un Chromebook partage, un eleve peut
  // arriver avec la session d'un autre deja ouverte.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export { app as firebaseApp };
