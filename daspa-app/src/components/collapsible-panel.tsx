import type { ReactNode } from "react";

/**
 * Section repliee par defaut, pour les actions qu'on ne fait qu'occasionnellement
 * (inscrire un eleve). Le <details> natif evite un modal, un etat React et un
 * piege d'accessibilite.
 */
export function CollapsiblePanel({
  summary,
  description,
  children,
  defaultOpen = false,
}: {
  summary: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-line bg-card shadow-card"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-4 text-sm font-medium text-ink transition-colors duration-150 hover:text-primary [&::-webkit-details-marker]:hidden">
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
        {summary}
      </summary>
      <div className="border-t border-line px-5 py-4">
        {description ? (
          <p className="mb-4 text-sm text-ink-secondary">{description}</p>
        ) : null}
        {children}
      </div>
    </details>
  );
}
