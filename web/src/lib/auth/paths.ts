import type { Role } from "@/lib/types";

/** Chemin d'atterrissage apres connexion, selon le role. */
export function homePathFor(role: Role): string {
  return role === "student" ? "/moi" : "/prof";
}
