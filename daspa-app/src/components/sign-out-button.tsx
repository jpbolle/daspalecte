"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOutEverywhere } from "@/lib/auth/sign-in";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await signOutEverywhere();
        router.replace("/login");
        router.refresh();
      }}
    >
      Déconnexion
    </Button>
  );
}
