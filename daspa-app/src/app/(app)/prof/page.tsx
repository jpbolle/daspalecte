import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listPendingInvitations, listStudents } from "@/lib/data/people";
import { loadClassActivity } from "@/lib/data/activity";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { InviteForm } from "@/components/invite-form";
import { PendingInvitations } from "@/components/pending-invitations";
import { StudentCard } from "@/components/student-card";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/panel";
import { StatRow } from "@/components/ui/stat-row";
import { plural } from "@/lib/format";

export const metadata = { title: "Mes élèves — Daspalecte" };

export default async function TeacherHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "student") redirect("/moi");

  const [students, invitations] = await Promise.all([
    listStudents(user),
    listPendingInvitations(user, "student"),
  ]);
  const { stats, byStudent } = await loadClassActivity(
    user,
    students.map((student) => student.uid),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl">Mes élèves</h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {students.length === 0
            ? "Aucun élève inscrit pour l’instant."
            : `${plural(stats.activeThisWeek, "élève actif", "élèves actifs")} cette semaine sur ${students.length}.`}
        </p>
      </header>

      {students.length > 0 ? (
        <StatRow
          stats={[
            { label: "Élèves", value: stats.students },
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
      ) : null}

      {students.length === 0 ? (
        <Panel>
          <EmptyState title="La classe est encore vide">
            Inscris une première adresse ci-dessous. Dès que l’élève se connecte
            avec l’extension ou le module Google Docs, ses sessions de travail
            apparaissent ici.
          </EmptyState>
        </Panel>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
          {students.map((student) => (
            <li key={student.uid}>
              <StudentCard
                student={student}
                stats={byStudent.get(student.uid)!}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4">
        <CollapsiblePanel
          summary="Inscrire un élève"
          description="L’élève se connecte ensuite avec son compte Google scolaire ; ses résultats arrivent automatiquement, même s’il n’ouvre jamais cette page."
          defaultOpen={students.length === 0}
        >
          <InviteForm role="student" label="Inscrire" />
        </CollapsiblePanel>

        {invitations.length > 0 ? (
          <Panel>
            <PanelHeader
              title="En attente de première connexion"
              description="Ces adresses sont inscrites mais ne se sont pas encore connectées."
            />
            <PendingInvitations invitations={invitations} />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
