"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth/session-provider";

type PublicAccessCtaProps = {
  nextPath?: string;
  candidateLabel?: string;
  authenticatedHref?: string;
};

export function PublicAccessCta({ nextPath, candidateLabel = "Abrir area do candidato", authenticatedHref = "/candidato" }: PublicAccessCtaProps) {
  const session = useSession();

  if (session.status === "loading") {
    return (
      <span className="nav-link" aria-live="polite">
        Restaurando sessao...
      </span>
    );
  }

  if (session.isAuthenticated) {
    return (
      <Link className="nav-link" href={authenticatedHref}>
        {candidateLabel}
      </Link>
    );
  }

  return (
    <Link className="nav-link" href={nextPath ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar"}>
      Entrar
    </Link>
  );
}
