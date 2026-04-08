"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <header className="candidate-topbar">
      <div className="candidate-topbar-inner">
        <Link href="/candidato" className="candidate-topbar-logo" aria-label="Painel do candidato">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ppgee-colorida.png" alt="PPGEE/UFAM" className="candidate-topbar-logo-img" height={36} />
        </Link>

        <div className="public-topbar-spacer" />

        <div className="candidate-topbar-right" ref={dropdownRef}>
          <button className="candidate-topbar-notif" type="button" aria-label="Notificacoes">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </button>
          <button
            className="candidate-topbar-avatar-pill"
            onClick={() => setOpen((v) => !v)}
            type="button"
            aria-expanded={open}
            aria-haspopup="true"
          >
            <span className="candidate-topbar-avatar-dot" aria-hidden="true">{initials}</span>
            <span className="candidate-topbar-avatar-name">{displayName}</span>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {open ? (
            <div className="candidate-topbar-dropdown" role="menu">
              <Link href="/candidato" className="candidate-topbar-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                Meu painel
              </Link>
              <Link href="/candidato/participacoes" className="candidate-topbar-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                Participacoes
              </Link>
              <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0" }} />
              <button className="candidate-topbar-dropdown-item candidate-topbar-dropdown-item--danger" onClick={session.signOut} type="button" role="menuitem">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                Encerrar sessao
              </button>
            </div>
          ) : null}
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
