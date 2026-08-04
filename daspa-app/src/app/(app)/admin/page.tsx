import {
  listAllStudents,
  listTeachers,
  indexByUid,
} from "@/lib/data/people";
import {
  loadAiUsage,
  loadClassActivity,
  NO_TEACHER_KEY,
} from "@/lib/data/activity";
import { AiUsageTable, type UsageRow } from "@/components/ai-usage-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { StatRow } from "@/components/ui/stat-row";
import { formatCost, labelForAction } from "@/lib/ai-cost";
import { formatDate, formatNumber } from "@/lib/format";

export const metadata = { title: "Administration — Daspalecte" };

export default async function AdminOverview() {
  const [students, teachers] = await Promise.all([
    listAllStudents(),
    listTeachers(),
  ]);

  const [{ stats }, usage] = await Promise.all([
    loadClassActivity(
      null,
      students.map((student) => student.uid),
    ),
    loadAiUsage(null),
  ]);

  const teachersByUid = indexByUid(teachers);

  const byAction: UsageRow[] = [...usage.byAction.entries()]
    .map(([action, totals]) => ({
      key: action,
      label: labelForAction(action),
      usage: totals,
    }))
    .sort((a, b) => b.usage.costUsd - a.usage.costUsd);

  const byTeacher: UsageRow[] = [...usage.byTeacher.entries()]
    .map(([uid, totals]) => {
      const teacher = teachersByUid.get(uid);
      return {
        key: uid,
        label:
          uid === NO_TEACHER_KEY
            ? "Sans professeur rattaché"
            : (teacher?.displayName ?? "Compte inconnu"),
        hint: teacher?.email,
        usage: totals,
      };
    })
    .sort((a, b) => b.usage.costUsd - a.usage.costUsd);

  return (
    <div className="space-y-8">
      <StatRow
        stats={[
          { label: "Élèves", value: students.length },
          { label: "Professeurs", value: teachers.length },
          { label: "Sessions de travail", value: stats.sessions },
          { label: "Mots travaillés", value: stats.words },
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
        <PanelHeader
          title="Consommation de l’IA"
          description={
            usage.firstCallAt === null
              ? "Aucun appel enregistré pour l’instant."
              : `Depuis le ${formatDate(usage.firstCallAt)}, d’après les tokens renvoyés par l’API.`
          }
        />
        <div className="px-5 py-4">
          <StatRow
            stats={[
              { label: "Coût total", value: formatCost(usage.total.costUsd) },
              { label: "Appels à Claude", value: formatNumber(usage.total.calls) },
              {
                label: "Tokens en entrée",
                value: formatNumber(usage.total.inputTokens),
              },
              {
                label: "Tokens en sortie",
                value: formatNumber(usage.total.outputTokens),
              },
            ]}
          />
          <p className="mt-4 text-pretty text-[0.8125rem] text-ink-muted">
            Estimation : les tokens sont réels, le tarif est celui de Claude
            Sonnet 4.5 (3 $ par million en entrée, 15 $ en sortie). Ce total ne
            couvre <strong className="font-semibold">que</strong> les appels
            d’élèves connectés à leur compte — les appels du module Google Docs
            et ceux passés sans compte n’y figurent pas.
            {usage.unknownModelCalls > 0
              ? ` ${formatNumber(usage.unknownModelCalls)} appel(s) sans modèle identifié ont été facturés au tarif par défaut.`
              : null}
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Coût par type d’appel"
          description="Où part la dépense : génération d’exercices, tests de lecture, captures d’écran…"
        />
        <AiUsageTable
          rows={byAction}
          emptyTitle="Rien à répartir"
          emptyText="Les appels apparaîtront ici dès qu’un élève utilisera une fonction propulsée par Claude."
        />
      </Panel>

      <Panel>
        <PanelHeader
          title="Coût par professeur"
          description="Somme des appels des élèves que chaque professeur a inscrits."
        />
        <AiUsageTable
          rows={byTeacher}
          emptyTitle="Rien à répartir"
          emptyText="Chaque appel est rattaché au professeur de l’élève ; la répartition apparaîtra dès les premières activités."
        />
      </Panel>
    </div>
  );
}
