import "server-only";

import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { googleSubOf } from "@/lib/auth/provision";
import type { Role, UserDoc } from "@/lib/types";

export const SESSION_COOKIE = "daspalecte_session";

/** 5 jours — au-dela, l'eleve se reconnecte. Maximum autorise par Firebase : 14 jours. */
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

export interface CurrentUser {
  /** Identifiant Google (`sub`) — la clef partagee par l'app, l'extension et l'add-on. */
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: Role;
}

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(value, false);
    const role = decoded.role as Role | undefined;
    const googleSub =
      (decoded.gsub as string | undefined) ?? googleSubOf(decoded);

    if (role && googleSub) {
      return {
        uid: googleSub,
        email: decoded.email ?? "",
        displayName: (decoded.name as string | undefined) ?? decoded.email ?? "",
        photoURL: (decoded.picture as string | undefined) ?? null,
        role,
      };
    }

    // Cookie cree juste apres setCustomUserClaims : le jeton n'avait pas encore
    // les claims. On lit le role dans Firestore plutot que de renvoyer null
    // (ce qui forcerait une reconnexion).
    if (googleSub) {
      const snapshot = await adminDb().collection("users").doc(googleSub).get();
      if (snapshot.exists) {
        const data = snapshot.data() as UserDoc;
        return {
          uid: googleSub,
          email: data.email || decoded.email || "",
          displayName: data.displayName || decoded.email || "",
          photoURL:
            data.photoURL ?? (decoded.picture as string | undefined) ?? null,
          role: data.role,
        };
      }
    }

    return null;
  } catch {
    // Cookie expire, revoque ou falsifie — on traite comme "pas connecte".
    return null;
  }
}
