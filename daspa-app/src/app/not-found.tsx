import Link from "next/link";

export const metadata = { title: "Page introuvable — Daspalecte" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <h1 className="font-title text-2xl text-primary">Page introuvable</h1>
        <p className="mt-3 text-pretty text-sm text-ink-secondary">
          Cette page n’existe pas, ou tu n’as pas accès à cet élève.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-primary underline underline-offset-4 transition-colors duration-150 hover:text-primary-hover"
        >
          Revenir à l’accueil
        </Link>
      </div>
    </main>
  );
}
