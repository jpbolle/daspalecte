import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getStudentFor } from "@/lib/data/people";
import { loadStudentSessions, loadStudentStats } from "@/lib/data/activity";
import { SessionList } from "@/components/session-list";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/panel";
import { StatRow } from "@/components/ui/stat-row";
import { formatSince } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const user = await getCurrentUser();
  if (!user || user.role === "student") return { title: "Daspalecte" };
  const student = await getStudentFor(user, uid);
  return { title: student ? `${student.displayName} — Daspalecte` : "Daspalecte" };
}

export default async function StudentDetail({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "student") redirect("/moi");

  const student = await getStudentFor(user, uid);
  if (!student) notFound();

  const [stats, sessions] = await Promise.all([
    loadStudentStats(uid),
    loadStudentSessions(uid),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/prof"
          className="text-sm text-ink-secondary transition-colors duration-150 hover:text-primary"
        >
          ← Mes élèves
        </Link>

        <div className="mt-4 flex items-center gap-4">
          <Avatar
            name={student.displayName}
            src={student.photoURL}
            className="size-12"
          />
          <div className="min-w-0">
            <h1 className="truncate text-2xl">{student.displayName}</h1>
            <p className="truncate text-sm text-ink-muted">
              {student.email}
              {stats.lastActivityAt
                ? ` · dernière activité ${formatSince(stats.lastActivityAt)}`
                : " · jamais connecté à l’extension"}
            </p>
          </div>
        </div>
      </header>

      <StatRow
        stats={[
          { label: "Sessions", value: stats.sessions },
          { label: "Mots travaillés", value: stats.words },
          {
            label: "Exercices",
            value: stats.exercises,
            hint:
              stats.exerciseAccuracy === null
                ? undefined
                : `${stats.exerciseAccuracy} % de réussite`,
          },
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
          title="Sessions de travail"
          description="Une session par page web ou document travaillé. Déplie une session pour voir les mots cherchés, les exercices et le test de lecture."
        />
        {sessions.length === 0 ? (
          <EmptyState title="Aucune session pour l’instant">
            Les sessions apparaissent dès que cet élève utilise l’extension
            Daspalecte ou le module Google Docs avec son compte scolaire.
          </EmptyState>
        ) : (
          <SessionList sessions={sessions} />
        )}
      </Panel>
    </div>
  );
}
