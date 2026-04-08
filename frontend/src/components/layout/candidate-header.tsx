"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CANDIDATE_NAV_ITEMS } from "@/components/layout/candidate-sidebar";
import { useSession } from "@/lib/auth/session-provider";

export function CandidateHeader() {
  const session = useSession();
  const pathname = usePathname();
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ppgee-colorida.png" alt="PPGEE/UFAM" className="candidate-topbar-logo-img" height={36} />
        </Link>

        <div className="public-topbar-spacer" />

        <div className="candidate-topbar-right">
          <button className="candidate-topbar-notif" type="button" aria-label="Notificacoes">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>
          <button className="candidate-topbar-avatar-pill" onClick={session.signOut} type="button" title="Encerrar sessao">
            <span className="candidate-topbar-avatar-dot" aria-hidden="true">{initials}</span>
            <span className="candidate-topbar-avatar-name">{displayName}</span>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      <nav className="candidate-mobile-nav" aria-label="Navegacao rapida do candidato">
        {CANDIDATE_NAV_ITEMS.map((item) => {
          const isActive = item.href === "/candidato" ? pathname === item.href : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`candidate-mobile-nav-item ${isActive ? "candidate-mobile-nav-item--active" : ""}`}
            >
              <span className="candidate-mobile-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
