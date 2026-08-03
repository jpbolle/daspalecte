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

    // Certaines erreurs ne se rejouent pas : redemander par redirection
    // enverrait l'eleve faire un aller-retour pour rien.
    if (code === "auth/unauthorized-domain" || code === "auth/user-disabled") {
      return { status: "error", message: code };
    }

    // Pour tout le reste, on bascule en redirection. La fenetre surgissante est
    // fragile — bloquee par strategie sur certains Chromebooks, coupee de la
    // page par les regles COOP — alors que la redirection traverse tout.
    try {
      await signInWithRedirect(auth, googleProvider());
      return { status: "redirecting" };
    } catch (fallback) {
      const fallbackCode = (fallback as { code?: string }).code ?? "";
      console.warn("[AUTH] la redirection a echoue aussi :", fallbackCode, fallback);
      return { status: "error", message: fallbackCode || code || "sign_in_failed" };
    }
  }
}

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
    if (!credential) return null;
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
