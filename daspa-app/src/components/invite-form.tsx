"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MESSAGES: Record<string, string> = {
  invalid_email: "Cette adresse ne ressemble pas à une adresse email.",
  already_registered: "Ce compte est déjà inscrit.",
  already_invited: "Cette adresse a déjà été inscrite et attend sa connexion.",
  admin_only: "Seul l’administrateur peut inscrire un professeur.",
  forbidden: "Tu n’as pas le droit de faire cette inscription.",
};

export function InviteForm({
  role,
  label,
}: {
  role: "student" | "teacher";
  label: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [schoolClass, setSchoolClass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Un professeur n'appartient pas a une classe : le champ ne s'affiche pas.
  const withClass = role === "student";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, firstName, lastName, schoolClass }),
    });

    if (response.ok) {
      setDone(email.trim().toLowerCase());
      setEmail("");
      setFirstName("");
      setLastName("");
      setSchoolClass("");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(MESSAGES[body.error] ?? "L’inscription a échoué. Réessaie.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div
        className={`grid gap-3 sm:grid-cols-2 ${withClass ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      >
        <Field
          id={`invite-email-${role}`}
          label="Adresse email"
          className={withClass ? "sm:col-span-2 lg:col-span-1" : undefined}
        >
          <input
            id={`invite-email-${role}`}
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prenom.nom@cnddinant.be"
            className={inputClass}
          />
        </Field>

        <Field id={`invite-first-${role}`} label="Prénom">
          <input
            id={`invite-first-${role}`}
            type="text"
            autoComplete="off"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id={`invite-last-${role}`} label="Nom">
          <input
            id={`invite-last-${role}`}
            type="text"
            autoComplete="off"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={inputClass}
          />
        </Field>

        {withClass ? (
          <Field id={`invite-class-${role}`} label="Classe">
            <input
              id={`invite-class-${role}`}
              type="text"
              autoComplete="off"
              value={schoolClass}
              onChange={(event) => setSchoolClass(event.target.value)}
              placeholder="1C"
              className={inputClass}
            />
          </Field>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={email.trim().length === 0}>
          {label}
        </Button>
        <p className="text-[0.8125rem] text-ink-muted">
          Seule l’adresse email est obligatoire.
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-3 text-sm text-success">
          <strong className="font-semibold">{done}</strong> est inscrit. Le
          compte sera actif à sa première connexion.
        </p>
      ) : null}
    </form>
  );
}

const inputClass =
  "h-10 w-full rounded-sm border border-line bg-card px-3 text-sm text-ink " +
  "placeholder:text-ink-muted transition-colors duration-150 " +
  "hover:border-line-strong focus:border-primary focus:outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary " +
  "disabled:bg-element disabled:text-ink-muted";

function Field({
  id,
  label,
  className = "",
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[0.8125rem] font-medium text-ink-secondary"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
