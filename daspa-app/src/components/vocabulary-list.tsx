"use client";

import { useMemo, useState } from "react";
import { formatSince, plural } from "@/lib/format";
import type { VocabularyDoc } from "@/lib/types";

/**
 * Liste des mots travailles, avec un filtre. Le filtre est insensible aux
 * accents : un eleve FLE tape « eleve » pour retrouver « élève ».
 */
export function VocabularyList({ words }: { words: VocabularyDoc[] }) {
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const needle = fold(filter);
    if (!needle) return words;
    return words.filter(
      (entry) =>
        fold(entry.word).includes(needle) ||
        fold(entry.translation).includes(needle),
    );
  }, [words, filter]);

  return (
    <>
      <div className="border-b border-line px-5 py-3">
        <label htmlFor="vocab-filter" className="sr-only">
          Chercher un mot
        </label>
        <input
          id="vocab-filter"
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Chercher un mot…"
          className="h-9 w-full max-w-72 rounded-sm border border-line bg-card px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-150 hover:border-line-strong focus:border-primary focus:outline-none"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">
          Aucun mot ne correspond à « {filter} ».
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {visible.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-2.5"
              >
                <span className="min-w-32 font-medium text-ink">
                  {entry.word}
                </span>
                <span className="min-w-32 flex-1 text-sm text-accent-ink">
                  {entry.translation || "—"}
                </span>
                <span className="text-[0.8125rem] text-ink-muted">
                  {entry.timesTranslated > 1
                    ? `${plural(entry.timesTranslated, "fois", "fois")} · `
                    : ""}
                  {formatSince(entry.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-2.5 text-[0.8125rem] text-ink-muted">
            {plural(visible.length, "mot affiché", "mots affichés")}
            {visible.length !== words.length ? ` sur ${words.length}` : ""}
          </p>
        </>
      )}
    </>
  );
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
