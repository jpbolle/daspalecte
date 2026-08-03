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
    const code = (error as { code?: string }).code ?? "";

    // L'eleve a ferme la fenetre : ce n'est pas une panne, on n'insiste pas.
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return { status: "cancelled" };
    }

    // Le code brut ne sert qu'au diagnostic : l'ecran, lui, affiche une phrase.
    console.warn("[AUTH] la connexion par fenetre a echoue :", code, error);

    // Repli en redirection UNIQUEMENT si la fenetre n'a pas pu s'ouvrir.
    //
    // On ne generalise surtout pas ce repli : la redirection s'appuie sur du
    // stockage inter-sites entre ce domaine et celui de Firebase Auth, que
    // Chrome bloque. Elle echoue alors en silence — l'eleve se reconnecte,
    // revient, et retombe sur l'ecran de connexion sans la moindre explication.
    // Mieux vaut afficher l'erreur de la fenetre surgissante, qui est
    // exploitable.
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
    return { status: "error", message: code || "sign_in_failed" };
  }
}

/**
 * Echange le jeton contre un cookie de session.
 *
 * Au tout premier login le serveur pose le role en custom claim : le jeton
 * qu'on vient d'obtenir ne le porte donc pas encore et le serveur repond 409.
 * On le rafraichit et on retente une seule fois.
 */
async function openServerSession(user: User): Promise<SignInResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
