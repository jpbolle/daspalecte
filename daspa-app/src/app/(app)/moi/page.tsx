import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listReadingTests,
  listVocabulary,
  loadStudentStats,
} from "@/lib/data/activity";
import { VocabularyList } from "@/components/vocabulary-list";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/panel";
import { ScoreBar, StatRow } from "@/components/ui/stat-row";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Mes résultats — Daspalecte" };

export default async function StudentHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/prof");

  const [stats, tests, vocabulary] = await Promise.all([
    loadStudentStats(user.uid),
    listReadingTests(user.uid),
    listVocabulary(user.uid),
  ]);

  const recent = [...tests].reverse();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl">Mes résultats</h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Tes tests de lecture et les mots que tu as travaillés.
        </p>
      </header>

      <StatRow
        stats={[
          { label: "Mots appris", value: stats.words },
          { label: "Exercices faits", value: stats.exercises },
          {
            label: "Tests de lecture",
            value: stats.readingTests,
            hint:
              stats.readingAverage === null
                ? undefined
                : `moyenne ${stats.readingAverage} %`,
          },
        ]}
      />

      <Panel>
        <PanelHeader title="Mes tests de lecture" />
        {recent.length === 0 ? (
          <EmptyState title="Pas encore de test">
            Passe un test de lecture depuis l’extension Daspalecte ou depuis un
            document Google, et ton score apparaîtra ici.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((test) => (
              <li
                key={test.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5"
              >
                <div className="min-w-48 flex-1">
                  <p className="truncate text-sm text-ink">
                    {test.pageTitle ?? "Texte sans titre"}
                  </p>
                  <p className="text-[0.8125rem] text-ink-muted">
                    {formatDate(test.at)} · questions {test.mcqScore}/
                    {test.mcqTotal} · mots {test.matchingScore}/
                    {test.matchingTotal}
                  </p>
                </div>
                <ScoreBar percentage={test.percentage} label="Score du test" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Mes mots"
          description={
            vocabulary.length > 0
              ? "Tous les mots que tu as cherchés, du plus récent au plus ancien."
              : undefined
          }
        />
        {vocabulary.length === 0 ? (
          <EmptyState title="Pas encore de mot">
            Chaque mot que tu traduis pendant une lecture vient se ranger ici
            avec sa traduction.
          </EmptyState>
        ) : (
          <VocabularyList words={vocabulary} />
        )}
      </Panel>
    </div>
  );
}
