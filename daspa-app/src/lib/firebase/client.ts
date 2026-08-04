import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  initializeAuth,
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

/**
 * Auth cote navigateur.
 *
 * Persistance en localStorage (pas IndexedDB) : sous App Hosting, la fenetre
 * Google se ferme juste apres l'auth et IndexedDB rate souvent avec
 * « Database is closing/hidden », ce qui fait echouer signInWithPopup alors
 * que Google a deja authentifie l'utilisateur.
 *
 * `popupRedirectResolver` est OBLIGATOIRE ici : `getAuth()` embarque le
 * resolveur par defaut, `initializeAuth()` non. Sans lui, signInWithPopup ET
 * getRedirectResult echouent tous deux avec `auth/argument-error` — une erreur
 * qui ne dit rien de sa cause.
 */
export function getClientAuth(): Auth {
  if (!authInstance) {
    try {
      authInstance = initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch {
      // HMR / double init : Auth est deja attache a l'app.
      authInstance = getAuth(app);
    }
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
