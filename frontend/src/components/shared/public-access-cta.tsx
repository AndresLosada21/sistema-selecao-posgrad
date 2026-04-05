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

  if (session.isAuthenticated) {
    if (session.hasRole("ADMIN")) {
      return (
        <Link className="nav-link" href="/admin">
          Abrir area administrativa
        </Link>
      );
    }

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
