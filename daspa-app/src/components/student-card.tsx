import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ScoreBar } from "@/components/ui/stat-row";
import { formatSince } from "@/lib/format";
import type { StudentStats } from "@/lib/data/activity";
import type { UserDoc } from "@/lib/types";

export function StudentCard({
  student,
  stats,
}: {
  student: UserDoc;
  stats: StudentStats;
}) {
  const jamaisActif = stats.sessions === 0;

  return (
    <Link
      href={`/prof/eleves/${student.uid}`}
      className="group flex h-full flex-col gap-4 rounded-lg border border-line bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-150 hover:border-primary hover:shadow-lift"
    >
      <div className="flex items-center gap-3">
        <Avatar
          name={student.displayName}
          src={student.photoURL}
          className="size-10"
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-ink group-hover:text-primary">
            {student.displayName}
          </p>
          <p className="truncate text-[0.8125rem] text-ink-muted">
            {jamaisActif
              ? "aucune activité"
              : `vu ${formatSince(stats.lastActivityAt ?? student.lastSeenAt)}`}
          </p>
        </div>
      </div>

      {jamaisActif ? (
        <p className="mt-auto text-pretty text-[0.8125rem] text-ink-secondary">
          L’élève ne s’est pas encore servi de l’extension.
        </p>
      ) : (
        <div className="mt-auto space-y-3">
          <div>
            <p className="mb-1 text-[0.8125rem] text-ink-secondary">
              Moyenne aux tests de lecture
            </p>
            <ScoreBar
              percentage={stats.readingAverage}
              label="Moyenne aux tests de lecture"
            />
          </div>

          <dl className="flex gap-5 text-[0.8125rem] text-ink-secondary">
            <Figure label="sessions" value={stats.sessions} />
            <Figure label="mots" value={stats.words} />
            <Figure label="exercices" value={stats.exercises} />
          </dl>
        </div>
      )}
    </Link>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="font-semibold tabular-nums text-ink">{value}</span>{" "}
        {label}
      </dd>
    </div>
  );
}
