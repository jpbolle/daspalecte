/**
 * Modele de donnees Daspalecte.
 *
 * Regle transversale : `studentId` et `teacherId` sont denormalises sur tous
 * les documents lisibles par un prof. Sans cela, chaque regle de securite
 * devrait faire un get() vers la session ou l'utilisateur parent, ce qui coute
 * une lecture par document et sature la limite de 20 get() par requete.
 */

export type Role = "admin" | "teacher" | "student";

export interface UserDoc {
  /**
   * Identifiant Google (`sub` du jeton OpenID) — c'est la clef du document.
   *
   * Ni l'email (il change : changement d'ecole, faute de frappe corrigee), ni
   * l'uid Firebase Auth : l'extension et l'add-on n'obtiennent qu'un access
   * token Google, sans jamais passer par Firebase Auth. Le `sub` est le seul
   * identifiant que les trois clients partagent.
   */
  uid: string;
  /** uid Firebase Auth, connu seulement si la personne a ouvert l'app web. */
  firebaseUid: string | null;
  role: Role;
  email: string;
  displayName: string;
  photoURL: string | null;
  /** Pour un eleve : `uid` (sub Google) du prof qui l'a inscrit. */
  teacherId: string | null;
  createdAt: number;
  lastSeenAt: number;
}

export interface InvitationDoc {
  /** Email normalise (minuscules, espaces retires) — sert aussi d'ID du document. */
  email: string;
  role: Exclude<Role, "admin">;
  /** Pour un eleve invite : uid du prof auquel il sera rattache. */
  teacherId: string | null;
  /** uid de celui qui a cree l'invitation (un prof ou l'admin). */
  invitedBy: string;
  displayName: string | null;
  createdAt: number;
  claimedAt: number | null;
  claimedBy: string | null;
}

/** Une session = une page web ou un document travaille. */
export interface SessionDoc {
  id: string;
  studentId: string;
  teacherId: string | null;
  source: "extension" | "addon";
  context: {
    url: string | null;
    title: string | null;
    /** 'web' pour l'extension ; 'docs' | 'slides' | 'sheets' pour l'add-on. */
    hostApp: string;
  };
  startedAt: number;
  lastActivityAt: number;
  counters: SessionCounters;
}

export interface SessionCounters {
  words: number;
  exercises: number;
  readingTests: number;
  comprehensions: number;
  captures: number;
}

export type EventType =
  | "word"
  | "comprehension"
  | "exercise"
  | "reading_test"
  | "capture";

export interface EventDoc {
  id: string;
  type: EventType;
  at: number;
  studentId: string;
  teacherId: string | null;
  payload: Record<string, unknown>;
}

export interface WordPayload {
  word: string;
  translation: string;
  nativeLanguage: string;
}

/** Les 7 exercices, memes identifiants que content.js:1732-1741. */
export type ExerciseType =
  | "matching"
  | "listening_matching"
  | "tags"
  | "reading"
  | "family"
  | "cloze"
  | "sentence";

export interface ExerciseResultDoc {
  id: string;
  studentId: string;
  teacherId: string | null;
  sessionId: string;
  at: number;
  exerciseType: ExerciseType;
  score: number;
  total: number;
  /** Nombre d'essais avant la reussite (1 = reussi du premier coup). */
  attempts: number;
  words: string[];
}

export interface ReadingTestDoc {
  id: string;
  studentId: string;
  teacherId: string | null;
  sessionId: string;
  at: number;
  mcqScore: number;
  mcqTotal: number;
  matchingScore: number;
  matchingTotal: number;
  percentage: number;
  pageUrl: string | null;
  pageTitle: string | null;
}

/** Mot travaille, agrege sur toutes les sessions de l'eleve. */
export interface VocabularyDoc {
  /** Mot normalise — sert aussi d'ID du document. */
  id: string;
  word: string;
  translation: string;
  nativeLanguage: string;
  teacherId: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  timesTranslated: number;
}
