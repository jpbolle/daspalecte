"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatSince } from "@/lib/format";
import type { InvitationDoc } from "@/lib/types";

export function PendingInvitations({
  invitations,
}: {
  invitations: InvitationDoc[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function revoke(email: string) {
    setPending(email);
    setError(null);
    const response = await fetch(
      `/api/invitations?email=${encodeURIComponent(email)}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      router.refresh();
    } else {
      setError("Le retrait a échoué. Réessaie.");
    }
    setPending(null);
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {invitations.map((invitation) => (
          <li
            key={invitation.email}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">
                {invitation.displayName ?? invitation.email}
              </p>
              {invitation.displayName ? (
                <p className="truncate text-[0.8125rem] text-ink-muted">
                  {invitation.email}
                </p>
              ) : null}
            </div>
            {invitation.schoolClass ? (
              <span className="rounded-sm border border-line bg-element px-2 py-0.5 text-[0.75rem] font-medium text-ink-secondary">
                {invitation.schoolClass}
              </span>
            ) : null}
            <span className="text-[0.8125rem] text-ink-muted">
              inscrit {formatSince(invitation.createdAt)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              loading={pending === invitation.email}
              onClick={() => revoke(invitation.email)}
            >
              Retirer
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="px-5 pb-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
