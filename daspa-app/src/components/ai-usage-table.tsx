import { formatCost } from "@/lib/ai-cost";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/panel";
import type { AiUsageTotals } from "@/lib/data/activity";

export interface UsageRow {
  key: string;
  label: string;
  /** Deuxieme ligne facultative : email, professeur rattache… */
  hint?: string;
  usage: AiUsageTotals;
}

/**
 * Repartition d'une consommation Claude. Les colonnes de tokens sont separees
 * entree / sortie parce que le tarif de sortie est cinq fois celui d'entree :
 * un total unique cacherait d'ou vient la depense.
 */
export function AiUsageTable({
  rows,
  emptyTitle,
  emptyText,
}: {
  rows: UsageRow[];
  emptyTitle: string;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[0.8125rem] text-ink-secondary">
            <th scope="col" className="px-5 py-2 font-medium">
              Poste
            </th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              Appels
            </th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              Tokens entrée
            </th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              Tokens sortie
            </th>
            <th scope="col" className="px-5 py-2 text-right font-medium">
              Coût estimé
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="px-5 py-2.5 text-left font-normal">
                <span className="font-medium text-ink">{row.label}</span>
                {row.hint ? (
                  <span className="block truncate text-[0.8125rem] text-ink-muted">
                    {row.hint}
                  </span>
                ) : null}
              </th>
              <td className="px-5 py-2.5 text-right tabular-nums text-ink-secondary">
                {formatNumber(row.usage.calls)}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-ink-secondary">
                {formatNumber(row.usage.inputTokens)}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-ink-secondary">
                {formatNumber(row.usage.outputTokens)}
              </td>
              <td className="px-5 py-2.5 text-right font-medium tabular-nums text-ink">
                {formatCost(row.usage.costUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
