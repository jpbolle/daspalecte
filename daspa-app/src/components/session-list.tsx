import { ScoreBar } from "@/components/ui/stat-row";
import { formatDateTime, plural } from "@/lib/format";
import type { SessionDetail } from "@/lib/data/activity";
import type { ExerciseType } from "@/lib/types";

/** Memes libelles que les titres d'exercices de l'extension (content.js). */
const EXERCISE_LABELS: Record<ExerciseType, string> = {
  matching: "Associations",
  listening_matching: "Écoute et associe",
  tags: "Étiquettes",
  reading: "Lecture",
  family: "Famille de mots",
  cloze: "Défi",
  sentence: "Phrase avec le vocabulaire",
};

const HOST_LABELS: Record<string, string> = {
  web: "page web",
  docs: "Google Docs",
  slides: "Google Slides",
  sheets: "Google Sheets",
};

export function SessionList({ sessions }: { sessions: SessionDetail[] }) {
  return (
    <ul className="divide-y divide-line">
      {sessions.map((detail) => (
        <li key={detail.session.id}>
          <SessionRow detail={detail} />
        </li>
      ))}
    </ul>
  );
}

function SessionRow({ detail }: { detail: SessionDetail }) {
  const { session, words, exercises, readingTests, comprehensions } = detail;
  const test = readingTests[0] ?? null;
  const duration = Math.max(
    1,
    Math.round((session.lastActivityAt - session.startedAt) / 60_000),
  );

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors duration-150 hover:bg-element [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className="size-3 shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none"
        >
          <path
            d="M4 2l4 4-4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="min-w-48 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {session.context.title ?? "Document sans titre"}
          </p>
          <p className="truncate text-[0.8125rem] text-ink-muted">
            {formatDateTime(session.startedAt)} · {duration}&nbsp;min ·{" "}
            {HOST_LABELS[session.context.hostApp] ?? session.context.hostApp}
          </p>
        </div>

        <p className="text-[0.8125rem] text-ink-secondary">
          {summarize(words.length, exercises.length, comprehensions)}
        </p>

        {test ? (
          <span className="shrink-0">
            <ScoreBar percentage={test.percentage} label="Test de lecture" />
          </span>
        ) : null}
      </summary>

      <div className="space-y-5 border-t border-line bg-bg px-5 py-5">
        <Section title="Mots étudiés" count={words.length}>
          {words.length === 0 ? (
            <Nothing>Aucun mot cherché pendant cette session.</Nothing>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {words.map((event) => (
                <li
                  key={event.id}
                  className="rounded-sm border border-line bg-card px-2.5 py-1 text-[0.8125rem]"
                >
                  <span className="font-medium text-ink">
                    {String(event.payload.word ?? "")}
                  </span>
                  <span className="text-ink-muted">
                    {" · "}
                    {String(event.payload.translation ?? "—")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Exercices" count={exercises.length}>
          {exercises.length === 0 ? (
            <Nothing>Aucun exercice terminé pendant cette session.</Nothing>
          ) : (
            // Grille plutot que flex : les scores doivent s'aligner d'une
            // ligne a l'autre pour etre lisibles en diagonale.
            <ul className="grid grid-cols-[1fr_auto_7.5rem] items-baseline gap-x-6 gap-y-1.5 text-sm">
              {exercises.map((result) => (
                <li key={result.id} className="contents">
                  <span className="text-ink">
                    {EXERCISE_LABELS[result.exerciseType]}
                  </span>
                  <span className="text-right tabular-nums text-ink-secondary">
                    {result.score}/{result.total}
                  </span>
                  <span className="text-[0.8125rem] text-ink-muted">
                    {result.attempts === 1
                      ? "du premier coup"
                      : plural(result.attempts, "essai", "essais")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {test ? (
          <Section title="Test de lecture" count={null}>
            <p className="text-sm text-ink-secondary">
              Questions&nbsp;: {test.mcqScore}/{test.mcqTotal} · Appariement&nbsp;:{" "}
              {test.matchingScore}/{test.matchingTotal} · Total&nbsp;:{" "}
              <strong className="font-semibold text-ink">
                {test.percentage}&nbsp;%
              </strong>
            </p>
          </Section>
        ) : null}

        {session.context.url ? (
          <p className="text-[0.8125rem]">
            <a
              href={session.context.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary underline underline-offset-4 transition-colors duration-150 hover:text-primary-hover"
            >
              Ouvrir le document travaillé
            </a>
          </p>
        ) : null}
      </div>
    </details>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[0.8125rem] font-semibold text-ink-secondary">
        {title}
        {count !== null && count > 0 ? (
          <span className="ml-1.5 font-normal text-ink-muted">({count})</span>
        ) : null}
      </h3>
      {children}
    </section>
  );
}

function Nothing({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

function summarize(words: number, exercises: number, comprehensions: number) {
  const parts: string[] = [];
  if (words) parts.push(plural(words, "mot", "mots"));
  if (exercises) parts.push(plural(exercises, "exercice", "exercices"));
  if (comprehensions) parts.push(plural(comprehensions, "aide", "aides"));
  return parts.length ? parts.join(" · ") : "rien d’enregistré";
}
