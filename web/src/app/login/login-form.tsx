"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
import { homePathFor } from "@/lib/auth/paths";
import {
  completeRedirectSignIn,
  signInWithGoogle,
  type SignInResult,
} from "@/lib/auth/sign-in";

export function LoginForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SignInResult | null>(null);

  // Retour d'une connexion par redirection (Chromebooks ou popups bloques).
  useEffect(() => {
    let active = true;
    completeRedirectSignIn(() => active && setBusy(true))
      .then((redirect) => {
        if (!active) return;
        if (redirect?.status === "ok") {
          router.replace(homePathFor(redirect.role));
          return;
        }
        if (redirect) setResult(redirect);
        setBusy(false);
      })
      .catch(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSignIn() {
    setBusy(true);
    setResult(null);
    const outcome = await signInWithGoogle();
    if (outcome.status === "ok") {
      router.replace(homePathFor(outcome.role));
      return;
    }
    if (outcome.status === "redirecting") return;
    setResult(outcome);
    setBusy(false);
  }

  return (
    <div className="w-full">
      <Button
        onClick={handleSignIn}
        variant="secondary"
        loading={busy}
        icon={busy ? undefined : <GoogleIcon />}
        className="w-full"
      >
        {busy ? "Connexion…" : "Se connecter avec Google"}
      </Button>

      <Feedback result={result} />
    </div>
  );
}

function Feedback({ result }: { result: SignInResult | null }) {
  if (!result || result.status === "ok" || result.status === "redirecting") {
    return null;
  }

  if (result.status === "cancelled") {
    return (
      <Message>
        Connexion interrompue. Tu peux réessayer quand tu veux.
      </Message>
    );
  }

  if (result.status === "unknown-account") {
    return (
      <Message tone="warning">
        Le compte <strong className="font-semibold">{result.email}</strong> n’est
        pas encore inscrit. Demande à ton professeur de t’ajouter, puis
        reconnecte-toi.
      </Message>
    );
  }

  if (result.status === "email-unverified") {
    return (
      <Message tone="warning">
        L’adresse de ce compte Google n’est pas vérifiée. Utilise ton compte
        scolaire.
      </Message>
    );
  }

  return (
    <Message tone="danger">
      La connexion a échoué ({result.message}). Réessaie dans un instant.
    </Message>
  );
}

function Message({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-line bg-element text-ink-secondary",
    warning: "border-accent/45 bg-accent/10 text-accent-ink",
    danger: "border-danger/40 bg-danger/8 text-danger",
  } as const;

  return (
    <p
      role="status"
      className={`mt-4 rounded-sm border px-3.5 py-3 text-sm text-pretty ${tones[tone]}`}
    >
      {children}
    </p>
  );
}
