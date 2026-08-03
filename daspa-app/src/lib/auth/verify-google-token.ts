import "server-only";

/**
 * Verification d'un access token Google presente par un client qui ne peut pas
 * embarquer le SDK Firebase : l'extension Chrome (chrome.identity.getAuthToken)
 * et le module complementaire Apps Script (ScriptApp.getOAuthToken()).
 *
 * Regle d'architecture : on verifie l'audience contre une LISTE de clients
 * autorises, jamais contre un client ID en dur. Un nouveau client se branche en
 * ajoutant une entree a ALLOWED_AUDIENCES, sans toucher au code.
 */

const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

export interface VerifiedGoogleUser {
  sub: string;
  email: string;
  audience: string;
}

export type VerifyResult =
  | { ok: true; user: VerifiedGoogleUser }
  | { ok: false; reason: "missing" | "invalid" | "audience" | "unverified" };

interface TokenInfo {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  expires_in?: string;
  exp?: string;
}

/** Petit cache memoire : un client envoie ses evenements par lots rapproches. */
const cache = new Map<string, { user: VerifiedGoogleUser; expiresAt: number }>();
const MAX_CACHE_MS = 5 * 60 * 1000;

export function allowedAudiences(): string[] {
  return (process.env.ALLOWED_AUDIENCES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function verifyGoogleAccessToken(
  authorization: string | null,
): Promise<VerifyResult> {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, reason: "missing" };

  const cached = cache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, user: cached.user };
  }

  const response = await fetch(
    `${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return { ok: false, reason: "invalid" };

  const info = (await response.json()) as TokenInfo;
  if (!info.sub || !info.email) return { ok: false, reason: "invalid" };
  if (info.email_verified === "false" || info.email_verified === false) {
    return { ok: false, reason: "unverified" };
  }

  const allowed = allowedAudiences();
  if (!info.aud || !allowed.includes(info.aud)) {
    return { ok: false, reason: "audience" };
  }

  const user: VerifiedGoogleUser = {
    sub: info.sub,
    email: info.email.toLowerCase(),
    audience: info.aud,
  };

  const ttl = Math.min(
    MAX_CACHE_MS,
    Math.max(0, Number(info.expires_in ?? 0) * 1000),
  );
  if (ttl > 0) {
    cache.set(token, { user, expiresAt: Date.now() + ttl });
    if (cache.size > 500) pruneCache();
  }

  return { ok: true, user };
}

function pruneCache() {
  const now = Date.now();
  for (const [token, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(token);
  }
}
