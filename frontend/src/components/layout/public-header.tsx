"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth/session-provider";

export function PublicHeader() {
  const session = useSession();

  return (
    <header className="public-topbar">
      <div className="public-topbar-inner">
        <Link href="/editais" className="public-topbar-logo" aria-label="Pagina inicial">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ppgee-branca.png" alt="PPGEE/UFAM" className="public-topbar-logo-img" height={36} />
        </Link>

        <div className="public-topbar-spacer" />

        <nav className="public-topbar-nav" aria-label="Navegacao principal">
          <Link href="/editais" className="public-topbar-link">
            Editais
          </Link>

          {session.isAuthenticated ? (
            <>
              <Link href="/candidato" className="public-topbar-link">
                Area do candidato
              </Link>
              {session.hasRole("ADMIN") ? (
                <Link href="/admin" className="public-topbar-link">
                  Area administrativa
                </Link>
              ) : null}
              <button
                className="public-topbar-btn public-topbar-btn--ghost"
                onClick={session.signOut}
                type="button"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link href="/criar-conta" className="public-topbar-link">
                Criar conta
              </Link>
              <Link href="/entrar" className="public-topbar-btn public-topbar-btn--solid">
                Entrar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
