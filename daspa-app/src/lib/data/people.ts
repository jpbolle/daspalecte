import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { CurrentUser } from "@/lib/auth/session";
import type { InvitationDoc, UserDoc } from "@/lib/types";

/**
 * Les pages lisent par le SDK Admin, avec le controle d'acces fait ici a partir
 * du role du cookie de session. Les regles Firestore restent la deuxieme
 * barriere, pour tout acces direct depuis le navigateur.
 *
 * Regle de portee : ces fonctions prennent un identifiant de professeur
 * explicite plutot que de deduire la portee du role de l'appelant. L'admin est
 * aussi professeur de francais — il a ses propres eleves — et « mes eleves »
 * doit vouloir dire la meme chose pour lui que pour un collegue. Les vues qui
 * couvrent l'ecole entiere sont donc des fonctions distinctes
 * (`listAllStudents`), appelees seulement par la zone Administration.
 */

/** Les eleves inscrits par ce professeur, et eux seuls. */
export async function listStudentsFor(teacherId: string): Promise<UserDoc[]> {
  const snapshot = await adminDb()
    .collection("users")
    .where("teacherId", "==", teacherId)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as UserDoc)
    .filter((user) => user.role === "student")
    .sort(byName);
}

/** Tous les eleves de l'ecole — reserve a la zone Administration. */
export async function listAllStudents(): Promise<UserDoc[]> {
  const snapshot = await adminDb()
    .collection("users")
    .where("role", "==", "student")
    .get();
  return snapshot.docs.map((doc) => doc.data() as UserDoc).sort(byName);
}

export async function listTeachers(): Promise<UserDoc[]> {
  const snapshot = await adminDb()
    .collection("users")
    .where("role", "in", ["teacher", "admin"])
    .get();
  return snapshot.docs.map((doc) => doc.data() as UserDoc).sort(byName);
}

/**
 * Invitations encore en attente. `invitedBy` a `null` couvre toute l'ecole
 * (Administration) ; sinon on ne renvoie que celles de ce professeur.
 */
export async function listPendingInvitations(
  invitedBy: string | null,
  role: "student" | "teacher",
): Promise<InvitationDoc[]> {
  const invitations = adminDb().collection("invitations");
  const query =
    invitedBy === null
      ? invitations.where("role", "==", role)
      : invitations.where("invitedBy", "==", invitedBy);

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

/** Index uid → personne, pour joindre les agregats aux noms affichables. */
export function indexByUid(people: UserDoc[]): Map<string, UserDoc> {
  return new Map(people.map((person) => [person.uid, person]));
}

function byName(a: UserDoc, b: UserDoc): number {
  return a.displayName.localeCompare(b.displayName, "fr");
}
