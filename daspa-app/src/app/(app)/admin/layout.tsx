import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { MainNav, type NavItem } from "@/components/main-nav";

/**
 * Zone Administration : tout ce qui couvre l'ecole entiere.
 *
 * Separee de « Mes eleves » a dessein — l'administrateur est aussi professeur
 * de francais, et sa classe ne doit pas se confondre avec l'ecole (voir
 * `lib/data/people.ts`). Le garde-fou de role vit ici, une seule fois, pour
 * toutes les sous-pages.
 */
const SUB_NAV: NavItem[] = [
  { href: "/admin", label: "Vue d’ensemble", exact: true },
  { href: "/admin/eleves", label: "Élèves" },
  { href: "/admin/profs", label: "Professeurs" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/prof");

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div>
          <h1 className="text-2xl">Administration</h1>
          <p className="mt-1.5 text-sm text-ink-secondary">
            L’école entière : professeurs, élèves et consommation de l’IA.
          </p>
        </div>
        <div className="border-b border-line pb-2">
          <MainNav items={SUB_NAV} label="Administration" />
        </div>
      </header>

      {children}
    </div>
  );
}
