import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/paths";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion — Daspalecte" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <header className="text-center">
          <h1 className="font-title text-[2.5rem] leading-none font-normal text-balance text-primary">
            Daspalecte
          </h1>
          <p className="mx-auto mt-4 max-w-[34ch] text-pretty text-sm leading-relaxed text-ink-secondary">
            Le suivi des lectures, des mots appris et des exercices, pour les
            élèves et leurs professeurs.
          </p>
        </header>

        <div className="mx-auto my-8 h-px w-16 bg-line" />

        <LoginForm />

        <p className="mt-8 text-center text-[0.8125rem] leading-relaxed text-ink-muted">
          Utilise le compte Google de ton école. Si l’adresse n’est pas encore
          inscrite, c’est ton professeur qui l’ajoute.
        </p>
      </div>
    </main>
  );
}
