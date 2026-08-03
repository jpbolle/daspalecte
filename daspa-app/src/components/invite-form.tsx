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
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, displayName }),
    });

    if (response.ok) {
      setDone(email.trim().toLowerCase());
      setEmail("");
      setDisplayName("");
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      setError(MESSAGES[body.error] ?? "L’inscription a échoué. Réessaie.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <Field
          id={`invite-email-${role}`}
          label="Adresse email"
          className="min-w-56 flex-1"
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

        <Field
          id={`invite-name-${role}`}
          label="Nom (facultatif)"
          className="min-w-44 flex-1"
        >
          <input
            id={`invite-name-${role}`}
            type="text"
            autoComplete="off"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Button type="submit" loading={busy} disabled={email.trim().length === 0}>
          {label}
        </Button>
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
