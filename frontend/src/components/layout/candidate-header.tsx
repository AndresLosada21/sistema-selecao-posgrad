"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth/session-provider";

export function CandidateHeader() {
  const session = useSession();
  const displayName = session.user?.nomeCompleto ?? "Candidato";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="candidate-topbar">
      <div className="candidate-topbar-inner">
        <Link href="/candidato" className="candidate-topbar-logo" aria-label="Painel do candidato">
          <span className="candidate-topbar-logo-text">PPGEE/UFAM</span>
        </Link>

        <div className="public-topbar-spacer" />

        <div className="candidate-topbar-right">
          <span className="candidate-topbar-name">{displayName}</span>
          <span className="avatar avatar--sm avatar--muted" aria-hidden="true">
            {initials}
          </span>
          <button
            className="candidate-topbar-signout"
            onClick={session.signOut}
            type="button"
            title="Encerrar sessao"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
