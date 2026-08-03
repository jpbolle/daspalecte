import "server-only";

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import type { Role } from "@/lib/types";

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
    const googleSub = decoded.gsub as string | undefined;
    if (!role || !googleSub) return null;

    return {
      uid: googleSub,
      email: decoded.email ?? "",
      displayName: (decoded.name as string | undefined) ?? decoded.email ?? "",
      photoURL: (decoded.picture as string | undefined) ?? null,
      role,
    };
  } catch {
    // Cookie expire, revoque ou falsifie — on traite comme "pas connecte".
    return null;
  }
}
