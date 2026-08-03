import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { provisionUser } from "@/lib/auth/provision";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSessionCookie,
} from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Echange un jeton d'identite Firebase contre un cookie de session httpOnly.
 *
 * Au passage, c'est ici que le compte est reconnu (document `users` existant
 * ou invitation en attente) et que son role est pose en custom claim.
 */
export async function POST(request: Request) {
  let idToken: string | undefined;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof idToken !== "string" || idToken.length === 0) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const result = await provisionUser(decoded);

  if (result.status === "unverified") {
    return NextResponse.json({ error: "email_unverified" }, { status: 403 });
  }
  if (result.status === "no-google-identity") {
    // Seule la connexion Google est prise en charge : c'est le `sub` Google
    // qui identifie un compte partout, y compris cote extension.
    return NextResponse.json({ error: "google_required" }, { status: 403 });
  }
  if (result.status === "unknown") {
    return NextResponse.json(
      { error: "unknown_account", email: result.email },
      { status: 403 },
    );
  }

  // Le role vient d'etre pose : le jeton du client ne le porte pas encore.
  // On refuse poliment et il rappelle avec un jeton rafraichi.
  if (result.claimStale) {
    return NextResponse.json({ error: "token_stale", retry: true }, { status: 409 });
  }

  const cookie = await createSessionCookie(idToken);
  const response = NextResponse.json({ role: result.role });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: cookie,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
