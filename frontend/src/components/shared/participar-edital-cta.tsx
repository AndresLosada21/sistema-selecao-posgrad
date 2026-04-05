"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { apiPost } from "@/lib/http/client";

type ParticiparEditalCtaProps = {
  editalId: string;
};

export function ParticiparEditalCta({ editalId }: ParticiparEditalCtaProps) {
  const session = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session.isAuthenticated || session.hasRole("ADMIN")) {
    return null;
  }

  async function handleClick() {
    if (!session.token) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/v1/editais/${editalId}/participar`, undefined, session.token);
      router.push(`/candidato/editais/${editalId}`);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        session.signOut();
        return;
      }
      setError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-item-links">
      <ActionButton disabled={busy} loading={busy} onClick={handleClick} type="button">
        Entrar neste edital
      </ActionButton>
      {error ? <small>{error}</small> : null}
    </div>
  );
}
