import { NextResponse } from "next/server";

/**
 * En-tetes de reponse.
 *
 * `headers()` de next.config n'est pas honore par l'adaptateur Next.js d'App
 * Hosting (verifie : les en-tetes n'apparaissaient pas dans la reponse). Le
 * middleware, lui, s'execute bien dans le chemin de la requete.
 *
 * `Cross-Origin-Opener-Policy: same-origin-allow-popups` est le point
 * important : sans lui, le lien entre la fenetre de connexion Google et la page
 * est coupe, et signInWithPopup echoue sans code d'erreur exploitable.
 */
export function middleware() {
  const response = NextResponse.next();
  response.headers.set(
    "Cross-Origin-Opener-Policy",
    "same-origin-allow-popups",
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export const config = {
  // Inutile sur les fichiers statiques : ils ne servent pas de contexte de
  // navigation et le middleware coute une invocation.
  // Exclure aussi `/__/auth/*` : c'est le proxy Firebase (rewrites) — ne pas
  // y injecter nos en-tetes COOP, le handler Firebase a les siens.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|__/auth).*)"],
};
