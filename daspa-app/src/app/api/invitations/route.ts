import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeEmail } from "@/lib/auth/provision";
import type { InvitationDoc, Role } from "@/lib/types";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Inscrit un compte par son adresse email, avant meme sa premiere connexion.
 * Un prof n'inscrit que des eleves, et ils lui sont rattaches ; seul l'admin
 * peut inscrire un prof.
 */
export async function POST(request: Request) {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (current.role === "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: {
    email?: unknown;
    role?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    schoolClass?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const role: Role = body.role === "teacher" ? "teacher" : "student";
  if (role === "teacher" && current.role !== "admin") {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }

  const firstName = trimmed(body.firstName);
  const lastName = trimmed(body.lastName);
  const schoolClass = trimmed(body.schoolClass);

  // Le nom affiche est reconstitue ici plutot que saisi : un seul champ a
  // maintenir, et l'ordre « prenom nom » reste coherent partout.
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || null;

  const db = adminDb();

  // Deja un compte actif avec cet email ? Inviter une deuxieme fois ne
  // servirait a rien : le document `users` prime sur l'invitation au login.
  const existing = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!existing.empty) {
    return NextResponse.json(
      { error: "already_registered" },
      { status: 409 },
    );
  }

  const invitationRef = db.collection("invitations").doc(email);
  const pending = await invitationRef.get();
  if (pending.exists && !(pending.data() as InvitationDoc).claimedAt) {
    return NextResponse.json({ error: "already_invited" }, { status: 409 });
  }

  const invitation: InvitationDoc = {
    email,
    role,
    teacherId: role === "student" ? current.uid : null,
    invitedBy: current.uid,
    displayName,
    firstName,
    lastName,
    // Un professeur n'appartient pas a une classe.
    schoolClass: role === "student" ? schoolClass : null,
    createdAt: Date.now(),
    claimedAt: null,
    claimedBy: null,
  };
  await invitationRef.set(invitation);

  return NextResponse.json({ invitation }, { status: 201 });
}

/** Champ texte facultatif : borne, nettoye, et `null` plutot que chaine vide. */
function trimmed(value: unknown, max = 80): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  return clean.length > 0 ? clean : null;
}

/** Retire une invitation encore en attente. */
export async function DELETE(request: Request) {
  const current = await getCurrentUser();
  if (!current || current.role === "student") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = normalizeEmail(
    new URL(request.url).searchParams.get("email") ?? "",
  );
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const ref = adminDb().collection("invitations").doc(email);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const data = snapshot.data() as InvitationDoc;
  if (data.claimedAt) {
    return NextResponse.json({ error: "already_claimed" }, { status: 409 });
  }
  if (current.role !== "admin" && data.invitedBy !== current.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
