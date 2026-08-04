"use client";

import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth, googleProvider } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

export type SignInResult =
  | { status: "ok"; role: Role }
  | { status: "unknown-account"; email: string }
  | { status: "email-unverified" }
  | { status: "redirecting" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function signInWithGoogle(): Promise<SignInResult> {
  const auth = getClientAuth();
  try {
    const credential = await signInWithPopup(auth, googleProvider());
    return openServerSession(credential.user);
  } catch (error) {
    // Cas frequent sous App Hosting : Google a authentifie, mais IndexedDB /
    // la persistance rate pendant la fermeture de la fenetre (« Database is
    // closing/hidden »). Si currentUser est deja la, on continue.
    const recovered = await recoverAuthenticatedUser(auth.currentUser);
    if (recovered) return openServerSession(recovered);

    const code = (error as { code?: string }).code ?? "";
    const message = (error as { message?: string }).message ?? "";

    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { status: "cancelled" };
    }

    console.warn("[AUTH] la connexion par fenetre a echoue :", code || message, error);

    // Repli redirection uniquement si la fenetre n'a pas pu s'ouvrir.
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-environment"
    ) {
      try {
        sessionStorage.setItem(REDIRECT_FLAG, "1");
        await signInWithRedirect(auth, googleProvider());
        return { status: "redirecting" };
      } catch (fallback) {
        sessionStorage.removeItem(REDIRECT_FLAG);
        const fallbackCode = (fallback as { code?: string }).code ?? "";
        console.warn("[AUTH] la redirection a echoue aussi :", fallbackCode, fallback);
        return { status: "error", message: fallbackCode || code };
      }
    }

    if (isPersistenceRace(message)) {
      return { status: "error", message: "auth-persistence-race" };
    }

    return { status: "error", message: code || "sign_in_failed" };
  }
}

/** Marque qu'une redirection est en cours, pour reconnaitre un retour vide. */
const REDIRECT_FLAG = "daspalecte-redirect-en-cours";

/**
 * A appeler au chargement de la page de connexion, pour le retour de
 * redirection. Renvoie null quand il n'y a rien a reprendre.
 *
 * `onResumed` est appele des qu'un retour de redirection est effectivement
 * trouve : c'est seulement a ce moment-la que la page doit afficher un etat
 * d'attente, sinon le bouton s'affiche en « Connexion… » a chaque ouverture.
 */
export async function completeRedirectSignIn(
  onResumed?: () => void,
): Promise<SignInResult | null> {
  const auth = getClientAuth();
  try {
    const credential = await getRedirectResult(auth);
    if (!credential) {
      // On etait parti en redirection et on revient les mains vides : le
      // navigateur a bloque le stockage inter-sites dont ce flux depend. Sans
      // ce cas, l'eleve retombait sur l'ecran de connexion sans un mot.
      if (sessionStorage.getItem(REDIRECT_FLAG)) {
        sessionStorage.removeItem(REDIRECT_FLAG);
        console.warn(
          "[AUTH] retour de redirection sans resultat (stockage inter-sites bloque)",
        );
        return { status: "error", message: "redirect-sans-resultat" };
      }
      return null;
    }
    sessionStorage.removeItem(REDIRECT_FLAG);
    onResumed?.();
    return openServerSession(credential.user);
  } catch (error) {
    const code = (error as { code?: string }).code ?? "";
    console.warn("[AUTH] reprise de redirection impossible :", code, error);

    // Cette fonction s'execute a CHAQUE ouverture de la page de connexion.
    // N'alarmer l'eleve que si une connexion etait effectivement en cours :
    // sinon il voit « la connexion a echoue » avant meme d'avoir clique.
    const enCours = sessionStorage.getItem(REDIRECT_FLAG);
    sessionStorage.removeItem(REDIRECT_FLAG);
    if (!enCours) return null;

    return { status: "error", message: code || "sign_in_failed" };
  }
}

/**
 * Echange le jeton contre un cookie de session.
 *
 * Au tout premier login le serveur pose le role en custom claim : le jeton
 * qu'on vient d'obtenir ne le porte donc pas encore et le serveur repond 409.
 * On force un rafraichissement, on attend un peu (propagation), et on retente.
 */
async function openServerSession(user: User): Promise<SignInResult> {
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      // Laisse a Firebase le temps de propager setCustomUserClaims.
      await wait(250 * attempt);
    }

    const idToken = await user.getIdToken(attempt > 0);
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });

    if (response.ok) {
      const { role } = (await response.json()) as { role: Role };
      return { status: "ok", role };
    }

    if (response.status === 409) continue;

    const body = await response.json().catch(() => ({}));
    await signOut(getClientAuth());

    if (body.error === "unknown_account") {
      return { status: "unknown-account", email: body.email ?? user.email ?? "" };
    }
    if (body.error === "email_unverified") {
      return { status: "email-unverified" };
    }
    return { status: "error", message: body.error ?? "session_failed" };
  }

  await signOut(getClientAuth());
  return { status: "error", message: "token_stale" };
}

export async function signOutEverywhere(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
  await signOut(getClientAuth());
}

function isPersistenceRace(message: string): boolean {
  return /database is closing|closing\/hidden|connection is closing/i.test(
    message,
  );
}

/** Attend un court instant, puis relit currentUser (parfois pose juste apres l'erreur). */
async function recoverAuthenticatedUser(
  immediate: User | null,
): Promise<User | null> {
  if (immediate) return immediate;
  await wait(400);
  return getClientAuth().currentUser;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
