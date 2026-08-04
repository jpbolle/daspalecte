import type { EventType, ExerciseType } from "@/lib/types";

/** Contrat partage avec analytics.js (extension) et Code.gs (add-on). */
export interface IngestBody {
  source: "extension" | "addon";
  session: {
    id: string;
    startedAt: number;
    context: {
      url: string | null;
      title: string | null;
      hostApp: string;
    };
  };
  events: IngestEvent[];
}

export interface IngestEvent {
  /** Genere par le client : sert d'identifiant de document, donc de garde-fou
   *  contre les doublons quand la file d'attente rejoue un lot. */
  id: string;
  type: EventType;
  at: number;
  payload: Record<string, unknown>;
}

/** Au-dela, le lot est refuse : un batch Firestore plafonne a 500 ecritures. */
export const MAX_EVENTS_PER_BATCH = 100;

const EVENT_TYPES: EventType[] = [
  "word",
  "comprehension",
  "exercise",
  "reading_test",
  "capture",
  "ai_call",
];

const EXERCISE_TYPES: ExerciseType[] = [
  "matching",
  "listening_matching",
  "tags",
  "reading",
  "family",
  "cloze",
  "sentence",
];

export type ParseResult =
  | { ok: true; body: IngestBody }
  | { ok: false; error: string };

export function parseIngestBody(raw: unknown): ParseResult {
  if (!isRecord(raw)) return fail("invalid_body");

  const source = raw.source === "addon" ? "addon" : "extension";

  if (!isRecord(raw.session)) return fail("missing_session");
  const sessionId = str(raw.session.id);
  if (!sessionId || sessionId.length > 128) return fail("invalid_session_id");

  const context = isRecord(raw.session.context) ? raw.session.context : {};

  if (!Array.isArray(raw.events)) return fail("missing_events");
  if (raw.events.length === 0) return fail("empty_events");
  if (raw.events.length > MAX_EVENTS_PER_BATCH) return fail("too_many_events");

  const events: IngestEvent[] = [];
  for (const candidate of raw.events) {
    if (!isRecord(candidate)) return fail("invalid_event");
    const id = str(candidate.id);
    const type = candidate.type as EventType;
    if (!id || id.length > 128) return fail("invalid_event_id");
    if (!EVENT_TYPES.includes(type)) return fail("invalid_event_type");

    events.push({
      id,
      type,
      at: clampTime(candidate.at),
      payload: isRecord(candidate.payload) ? candidate.payload : {},
    });
  }

  return {
    ok: true,
    body: {
      source,
      session: {
        id: sessionId,
        startedAt: clampTime(raw.session.startedAt),
        context: {
          url: truncate(str(context.url), 2000),
          title: truncate(str(context.title), 300),
          hostApp: str(context.hostApp) ?? "web",
        },
      },
      events,
    },
  };
}

export function isExerciseType(value: unknown): value is ExerciseType {
  return EXERCISE_TYPES.includes(value as ExerciseType);
}

/**
 * Normalise un mot pour en faire un identifiant de document : minuscules, sans
 * accent, sans ponctuation. « Élève », « eleve » et « élève. » se rangent au
 * meme endroit plutot que de creer trois entrees de vocabulaire.
 */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function truncate(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max);
}

/** Une horloge cliente peut etre fausse ; on refuse le futur et l'antiquite. */
function clampTime(value: unknown): number {
  const now = Date.now();
  const parsed = typeof value === "number" && Number.isFinite(value) ? value : now;
  const oneYearAgo = now - 365 * 86_400_000;
  if (parsed > now || parsed < oneYearAgo) return now;
  return Math.round(parsed);
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}
