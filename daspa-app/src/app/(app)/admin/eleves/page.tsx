import Link from "next/link";
import { indexByUid, listAllStudents, listTeachers } from "@/lib/data/people";
import {
  emptyUsage,
  loadAiUsage,
  loadClassActivity,
} from "@/lib/data/activity";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/panel";
import { formatCost } from "@/lib/ai-cost";
import { formatNumber, formatSince } from "@/lib/format";

export const metadata = { title: "Élèves de l’école — Daspalecte" };

/**
 * Tous les eleves de l'ecole avec leur degre d'utilisation.
 *
 * Une table plutot que les cartes de `/prof` : a l'echelle de l'ecole on
 * compare des lignes entre elles, et le classement par activite decroissante
 * est l'information utile (qui se sert vraiment de l'outil, qui pas du tout).
 */
export default async function AdminStudents() {
  const [students, teachers] = await Promise.all([
    listAllStudents(),
    listTeachers(),
  ]);

  const [{ byStudent }, usage] = await Promise.all([
    loadClassActivity(
      null,
      students.map((student) => student.uid),
    ),
    loadAiUsage(null),
  ]);

  const teachersByUid = indexByUid(teachers);

  const rows = students
    .map((student) => ({
      student,
      stats: byStudent.get(student.uid)!,
      usage: usage.byStudent.get(student.uid) ?? emptyUsage(),
      teacher: student.teacherId
        ? teachersByUid.get(student.teacherId)
        : undefined,
    }))
    .sort(
      (a, b) =>
        (b.stats.lastActivityAt ?? 0) - (a.stats.lastActivityAt ?? 0) ||
        a.student.displayName.localeCompare(b.student.displayName, "fr"),
    );

  const inactive = rows.filter((row) => row.stats.sessions === 0).length;

  return (
    <Panel>
      <PanelHeader
        title={`${students.length} élève${students.length > 1 ? "s" : ""} inscrits`}
        description={
          inactive === 0
            ? "Classés du plus récemment actif au moins récent."
            : `Classés du plus récemment actif au moins récent — ${inactive} ne s’est jamais servi de l’outil.`
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="Aucun élève dans l’école">
          Les élèves apparaissent ici dès qu’un professeur inscrit leur adresse
          depuis sa page « Mes élèves ».
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[0.8125rem] text-ink-secondary">
                <th scope="col" className="px-5 py-2 font-medium">
                  Élève
                </th>
                <th scope="col" className="px-5 py-2 font-medium">
                  Classe
                </th>
                <th scope="col" className="px-5 py-2 font-medium">
                  Professeur
                </th>
                <th scope="col" className="px-5 py-2 font-medium">
                  Dernière activité
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  Sessions
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  Mots
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  Exercices
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  Appels IA
                </th>
                <th scope="col" className="px-5 py-2 text-right font-medium">
                  Coût
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ student, stats, usage: calls, teacher }) => (
                <tr key={student.uid}>
                  <th scope="row" className="px-5 py-2.5 text-left font-normal">
                    <Link
                      href={`/prof/eleves/${student.uid}`}
                      className="flex items-center gap-2.5 text-ink transition-colors duration-150 hover:text-primary"
                    >
                      <Avatar
                        name={student.displayName}
                        src={student.photoURL}
                        className="size-7 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {student.displayName}
                        </span>
                        <span className="block truncate text-[0.8125rem] text-ink-muted">
                          {student.email}
                        </span>
                      </span>
                    </Link>
                  </th>
                  <td className="px-5 py-2.5 text-ink-secondary">
                    {student.schoolClass ?? (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-ink-secondary">
                    {teacher?.displayName ?? "—"}
                  </td>
                  <td className="px-5 py-2.5 text-ink-secondary">
                    {stats.lastActivityAt === null
                      ? "jamais"
                      : formatSince(stats.lastActivityAt)}
                  </td>
                  <Figure value={stats.sessions} />
                  <Figure value={stats.words} />
                  <Figure value={stats.exercises} />
                  <Figure value={calls.calls} />
                  <td className="px-5 py-2.5 text-right font-medium tabular-nums text-ink">
                    {formatCost(calls.costUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Figure({ value }: { value: number }) {
  return (
    <td className="px-5 py-2.5 text-right tabular-nums text-ink-secondary">
      {value === 0 ? (
        <span className="text-ink-muted">—</span>
      ) : (
        formatNumber(value)
      )}
    </td>
  );
}
