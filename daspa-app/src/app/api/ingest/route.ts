import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { resolveAccount } from "@/lib/auth/provision";
import { verifyGoogleAccessToken } from "@/lib/auth/verify-google-token";
import { parseIngestBody } from "@/lib/ingest/schema";
import { ingestBatch } from "@/lib/ingest/write";

export const runtime = "nodejs";

/**
 * Point d'entree unique des resultats produits par l'extension Chrome et par
 * le module complementaire Apps Script. Ni l'un ni l'autre ne peut embarquer le
 * SDK Firebase (MV3 interdit le code distant, Apps Script n'a pas de bundler) :
 * ils envoient un access token Google et du JSON, rien d'autre.
 */
export async function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));

  const verification = await verifyGoogleAccessToken(
    request.headers.get("authorization"),
  );
  if (!verification.ok) {
    return NextResponse.json(
      { error: `token_${verification.reason}` },
      { status: 401, headers: cors },
    );
  }

  const parsed = parseIngestBody(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: 400, headers: cors },
    );
  }

  // Un eleve peut n'avoir jamais ouvert l'app web : son premier evenement
  // suffit a creer son compte, pourvu qu'un prof ait inscrit son adresse.
  const account = await resolveAccount({
    googleSub: verification.user.sub,
    email: verification.user.email,
    displayName: null,
    photoURL: null,
    firebaseUid: null,
  });

  if (account.status === "unknown") {
    return NextResponse.json(
      { error: "unknown_account", email: account.email },
      { status: 403, headers: cors },
    );
  }

  // Un prof qui essaie l'extension produit des evenements sans interet ici.
  // On repond 200 pour que sa file d'attente se vide au lieu de rejouer.
  if (account.role !== "student") {
    return NextResponse.json(
      { ok: true, accepted: 0, ignored: "not_a_student" },
      { headers: cors },
    );
  }

  const accepted = await ingestBatch(
    adminDb(),
    { studentId: account.googleSub, teacherId: account.teacherId },
    parsed.body,
  );

  return NextResponse.json({ ok: true, accepted }, { headers: cors });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = (process.env.ALLOWED_INGEST_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "3600",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
