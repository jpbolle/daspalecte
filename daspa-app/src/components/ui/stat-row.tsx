import type { ReactNode } from "react";

export interface Stat {
  label: string;
  value: ReactNode;
  hint?: string;
}

/**
 * Bandeau de chiffres. Volontairement typographique et dense plutot qu'une
 * rangee de grosses cartes a gradient : c'est un cahier de suivi, pas un
 * tableau de bord SaaS.
 */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex flex-wrap items-stretch gap-x-8 gap-y-4 border-y border-line py-4">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-24">
          <dt className="text-[0.8125rem] text-ink-secondary">{stat.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink">
            {stat.value}
            {stat.hint ? (
              <span className="ml-1.5 text-[0.8125rem] font-normal text-ink-muted">
                {stat.hint}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Jauge horizontale pour un pourcentage. Retourne un tiret si rien a montrer. */
export function ScoreBar({
  percentage,
  label,
}: {
  percentage: number | null;
  label: string;
}) {
  if (percentage === null) {
    return <span className="text-sm text-ink-muted">—</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Largeur fixe : en contexte flex, un `w-full` s'ecrase a zero. */}
      <div
        role="img"
        aria-label={`${label} : ${percentage} %`}
        className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-element"
      >
        <div
          className={`h-full rounded-full ${toneOf(percentage)}`}
          style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-ink-secondary">
        {percentage}&nbsp;%
      </span>
    </div>
  );
}

/**
 * Trois paliers seulement, alignes sur ceux du test de lecture de l'extension
 * (content.css : .ct-score-good / -ok / -bad, seuils 70 % et 50 %).
 */
export function toneOf(percentage: number): string {
  if (percentage >= 70) return "bg-success";
  if (percentage >= 50) return "bg-accent";
  return "bg-danger";
}
