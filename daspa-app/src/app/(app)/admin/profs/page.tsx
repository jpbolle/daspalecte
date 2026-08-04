import {
  listAllStudents,
  listPendingInvitations,
  listTeachers,
} from "@/lib/data/people";
import { InviteForm } from "@/components/invite-form";
import { PendingInvitations } from "@/components/pending-invitations";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/panel";
import { formatSince, plural } from "@/lib/format";

export const metadata = { title: "Professeurs — Daspalecte" };

// Le garde-fou de role et le titre de section vivent dans admin/layout.tsx.
export default async function TeachersAdmin() {
  const [teachers, invitations, students] = await Promise.all([
    listTeachers(),
    listPendingInvitations(null, "teacher"),
    listAllStudents(),
  ]);

  const studentsPerTeacher = new Map<string, number>();
  for (const student of students) {
    if (!student.teacherId) continue;
    studentsPerTeacher.set(
      student.teacherId,
      (studentsPerTeacher.get(student.teacherId) ?? 0) + 1,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl">Professeurs</h2>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Chaque professeur inscrit ensuite ses propres élèves et ne voit que
          ceux-là.
        </p>
      </div>

      <Panel>
        <PanelHeader title="Inscrire un professeur" />
        <div className="px-5 py-4">
          <InviteForm role="teacher" label="Inscrire" />
        </div>
      </Panel>

      {invitations.length > 0 ? (
        <Panel>
          <PanelHeader title="En attente de première connexion" />
          <PendingInvitations invitations={invitations} />
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Comptes actifs" />
        {teachers.length === 0 ? (
          <EmptyState title="Aucun professeur connecté">
            Les adresses inscrites apparaissent ici dès leur première connexion.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {teachers.map((teacher) => (
              <li
                key={teacher.uid}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
              >
                <Avatar name={teacher.displayName} src={teacher.photoURL} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {teacher.displayName}
                  </p>
                  <p className="truncate text-[0.8125rem] text-ink-muted">
                    {teacher.email}
                  </p>
                </div>
                {teacher.role === "admin" ? (
                  <span className="rounded-sm border border-accent/45 bg-accent/10 px-2 py-0.5 text-[0.75rem] font-medium text-accent-ink">
                    administrateur
                  </span>
                ) : null}
                <span className="text-[0.8125rem] tabular-nums text-ink-secondary">
                  {plural(
                    studentsPerTeacher.get(teacher.uid) ?? 0,
                    "élève",
                    "élèves",
                  )}
                </span>
                <span className="text-[0.8125rem] text-ink-muted">
                  vu {formatSince(teacher.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
