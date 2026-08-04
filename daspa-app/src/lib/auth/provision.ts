import "server-only";

import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { InvitationDoc, Role, UserDoc } from "@/lib/types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type ProvisionResult =
  | {
      status: "ok";
      googleSub: string;
      role: Role;
      teacherId: string | null;
      claimStale: boolean;
    }
  | { status: "unverified" }
  | { status: "no-google-identity" }
  | { status: "unknown"; email: string };

/**
 * Identifiant Google (`sub`) derriere un jeton Firebase.
 *
 * C'est la clef de tous les documents : l'extension et l'add-on ne connaissent
 * que cette valeur, ils n'ont jamais d'uid Firebase Auth.
 */
export function googleSubOf(decoded: DecodedIdToken): string | null {
  const identities = decoded.firebase?.identities as
    | Record<string, string[] | undefined>
    | undefined;
  return identities?.["google.com"]?.[0] ?? null;
}

/**
 * Resout le compte Google d'un utilisateur qui vient de se connecter.
 *
 * Il n'y a pas de restriction de domaine codee en dur : on reconnait un compte
 * soit parce qu'il a deja un document `users`, soit parce qu'un prof (ou
 * l'admin) l'a inscrit par email au prealable. Tout le reste est refuse.
 * Cela laisse la porte ouverte a un prof hors @cnddinant.be sans rien changer.
 */
export async function provisionUser(
  decoded: DecodedIdToken,
): Promise<ProvisionResult> {
  const email = decoded.email ? normalizeEmail(decoded.email) : null;
  if (!email || decoded.email_verified === false) {
    return { status: "unverified" };
  }

  const googleSub = googleSubOf(decoded);
  if (!googleSub) return { status: "no-google-identity" };

  const resolved = await resolveAccount({
    googleSub,
    email,
    displayName: decoded.name ?? null,
    photoURL: decoded.picture ?? null,
    firebaseUid: decoded.uid,
  });

  if (resolved.status !== "ok") return resolved;

  // Le custom claim est ce que lisent les regles Firestore. S'il vient de
  // changer, le jeton que le client detient est perime : il doit le rafraichir
  // avant qu'on en fasse un cookie de session, sinon il naviguerait avec un
  // token sans role et toutes ses lectures seraient refusees.
  const claimStale =
    decoded.role !== resolved.role || decoded.gsub !== googleSub;
  if (claimStale) {
    await adminAuth().setCustomUserClaims(decoded.uid, {
      role: resolved.role,
      gsub: googleSub,
    });
  }

  return { ...resolved, claimStale };
}

interface AccountInput {
  googleSub: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  /** Renseigne uniquement quand la personne passe par l'app web. */
  firebaseUid: string | null;
}

type ResolveResult =
  | {
      status: "ok";
      googleSub: string;
      role: Role;
      teacherId: string | null;
      claimStale: boolean;
    }
  | { status: "unknown"; email: string };

/**
 * Cree ou met a jour le document `users`, a partir d'une identite Google.
 *
 * Partage entre l'app web et /api/ingest : un eleve doit pouvoir exister sans
 * jamais avoir ouvert l'app web, son premier evenement depuis l'extension
 * suffit a l'inscrire — a condition qu'un prof ait deja inscrit son adresse.
 */
export async function resolveAccount(
  input: AccountInput,
): Promise<ResolveResult> {
  const db = adminDb();
  const now = Date.now();
  const userRef = db.collection("users").doc(input.googleSub);
  const snapshot = await userRef.get();

  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
  const isBootstrapAdmin = adminEmail.length > 0 && input.email === adminEmail;

  if (snapshot.exists) {
    const existing = snapshot.data() as UserDoc;
    // L'admin d'amorcage le reste meme si son document dit autre chose :
    // c'est le filet de securite qui evite de se verrouiller dehors.
    const role: Role = isBootstrapAdmin ? "admin" : existing.role;
    const teacherId = role === "student" ? (existing.teacherId ?? null) : null;

    await userRef.update({
      role,
      email: input.email,
      displayName: input.displayName ?? existing.displayName ?? input.email,
      photoURL: input.photoURL ?? existing.photoURL ?? null,
      firebaseUid: input.firebaseUid ?? existing.firebaseUid ?? null,
      lastSeenAt: now,
    });

    return { status: "ok", googleSub: input.googleSub, role, teacherId, claimStale: false };
  }

  if (isBootstrapAdmin) {
    await userRef.set(buildUserDoc(input, "admin", null, null, now));
    return {
      status: "ok",
      googleSub: input.googleSub,
      role: "admin",
      teacherId: null,
      claimStale: false,
    };
  }

  const invitationRef = db.collection("invitations").doc(input.email);
  const invitation = await invitationRef.get();
  if (!invitation.exists) {
    return { status: "unknown", email: input.email };
  }

  const data = invitation.data() as InvitationDoc;
  const role = data.role;
  const teacherId = role === "student" ? (data.teacherId ?? null) : null;

  await db.runTransaction(async (tx) => {
    tx.set(
      userRef,
      buildUserDoc(
        {
          ...input,
          displayName: input.displayName ?? data.displayName,
        },
        role,
        teacherId,
        // La classe vient de l'invitation : Google ne la connait pas, et elle ne
        // doit plus bouger ensuite.
        role === "student" ? (data.schoolClass ?? null) : null,
        now,
      ),
    );
    tx.update(invitationRef, { claimedAt: now, claimedBy: input.googleSub });
  });

  return { status: "ok", googleSub: input.googleSub, role, teacherId, claimStale: false };
}

function buildUserDoc(
  input: AccountInput,
  role: Role,
  teacherId: string | null,
  schoolClass: string | null,
  now: number,
): UserDoc {
  return {
    uid: input.googleSub,
    firebaseUid: input.firebaseUid,
    role,
    email: input.email,
    displayName: input.displayName ?? input.email,
    photoURL: input.photoURL,
    teacherId,
    schoolClass,
    createdAt: now,
    lastSeenAt: now,
  };
}
