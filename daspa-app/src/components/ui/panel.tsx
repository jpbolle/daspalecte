import type { ReactNode } from "react";

/**
 * Surface de contenu. Volontairement sobre : pas de carte imbriquee dans une
 * carte, pas de bordure laterale coloree (retiree de l'extension en v1.10,
 * c'est un anti-pattern).
 */
export function Panel({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag
      className={`rounded-lg border border-line bg-card shadow-card ${className}`}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-ink-secondary">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <p className="font-title text-lg text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-[46ch] text-pretty text-sm text-ink-secondary">
        {children}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-sm bg-element motion-reduce:animate-none ${className}`}
    />
  );
}
