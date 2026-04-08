"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth/session-provider";

export function PublicHeader() {
  const session = useSession();

  return (
    <header className="public-topbar">
      <div className="public-topbar-inner">
        <Link href="/editais" className="public-topbar-logo" aria-label="Pagina inicial">
          <span className="public-topbar-logo-text">PPGEE/UFAM</span>
          <span className="public-topbar-logo-divider" aria-hidden="true" />
          <span className="public-topbar-logo-subtitle">Portal de Selecao</span>
        </Link>

        <div className="public-topbar-spacer" />

        <nav className="public-topbar-nav" aria-label="Navegacao principal">
          <Link href="/editais" className="public-topbar-link">
            Editais
          </Link>

          {session.isAuthenticated ? (
            <>
              {session.hasRole("ADMIN") ? (
                <Link href="/admin" className="public-topbar-link">
                  Area administrativa
                </Link>
              ) : (
                <Link href="/candidato" className="public-topbar-link">
                  Area do candidato
                </Link>
              )}
              <button
                className="public-topbar-btn public-topbar-btn--ghost"
                onClick={session.signOut}
                type="button"
              >
                Sair
              </button>
            </>
          ) : (
            <Link href="/entrar" className="public-topbar-btn public-topbar-btn--solid">
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
