import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { CurrentUser } from "@/lib/auth/session";
import type { InvitationDoc, UserDoc } from "@/lib/types";

/**
 * Les pages lisent par le SDK Admin, avec le controle d'acces fait ici a partir
 * du role du cookie de session. Les regles Firestore restent la deuxieme
 * barriere, pour tout acces direct depuis le navigateur.
 */

export async function listStudents(viewer: CurrentUser): Promise<UserDoc[]> {
  const users = adminDb().collection("users");
  const query =
    viewer.role === "admin"
      ? users.where("role", "==", "student")
      : users.where("teacherId", "==", viewer.uid);

  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => doc.data() as UserDoc)
    .filter((user) => user.role === "student")
    .sort(byName);
}

export async function listTeachers(): Promise<UserDoc[]> {
  const snapshot = await adminDb()
    .collection("users")
    .where("role", "in", ["teacher", "admin"])
    .get();
  return snapshot.docs.map((doc) => doc.data() as UserDoc).sort(byName);
}

export async function listPendingInvitations(
  viewer: CurrentUser,
  role: "student" | "teacher",
): Promise<InvitationDoc[]> {
  const invitations = adminDb().collection("invitations");
  const query =
    viewer.role === "admin"
      ? invitations.where("role", "==", role)
      : invitations.where("invitedBy", "==", viewer.uid);

  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => doc.data() as InvitationDoc)
    .filter((item) => item.role === role && !item.claimedAt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Un eleve n'est visible que par son prof (ou l'admin). */
export async function getStudentFor(
  viewer: CurrentUser,
  uid: string,
): Promise<UserDoc | null> {
  const snapshot = await adminDb().collection("users").doc(uid).get();
  if (!snapshot.exists) return null;

  const student = snapshot.data() as UserDoc;
  if (student.role !== "student") return null;
  if (viewer.role === "admin") return student;
  if (viewer.role === "teacher" && student.teacherId === viewer.uid) {
    return student;
  }
  return null;
}

function byName(a: UserDoc, b: UserDoc): number {
  return a.displayName.localeCompare(b.displayName, "fr");
}
