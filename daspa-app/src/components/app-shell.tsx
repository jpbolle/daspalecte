import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth/session";
import { MainNav, type NavItem } from "./main-nav";
import { SignOutButton } from "./sign-out-button";
import { Avatar } from "./ui/avatar";

/**
 * Deux zones pour l'admin, qui est aussi professeur de francais : « Mes élèves »
 * est sa classe (identique a celle d'un collegue), « Administration » couvre
 * l'ecole. Sans cette separation, sa page de classe afficherait tous les eleves
 * de l'ecole des qu'un deuxieme professeur en inscrit.
 */
const NAV: Record<string, NavItem[]> = {
  admin: [
    { href: "/prof", label: "Mes élèves" },
    { href: "/admin", label: "Administration" },
  ],
  teacher: [{ href: "/prof", label: "Mes élèves" }],
  student: [],
};

export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link
            href="/"
            className="shrink-0 font-title text-[1.0625rem] text-primary"
          >
            Daspalecte
          </Link>

          <MainNav items={NAV[user.role] ?? []} />

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-ink-secondary sm:block">
              {user.displayName}
            </span>
            <Avatar
              name={user.displayName}
              src={user.photoURL}
              className="size-8"
            />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </div>

      <footer className="border-t border-line px-4 py-6 text-center text-[0.8125rem] text-ink-muted sm:px-6">
        Daspalecte — aide à la lecture pour les élèves DASPA
      </footer>
    </>
  );
}
