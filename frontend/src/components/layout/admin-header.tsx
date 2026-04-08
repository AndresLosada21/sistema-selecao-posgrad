"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV_ITEMS } from "@/components/layout/admin-sidebar";
import { useSession } from "@/lib/auth/session-provider";

export function AdminHeader() {
  const session = useSession();
  const pathname = usePathname();

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-inner">
        <div className="admin-topbar-brand">
          <span className="admin-topbar-brand-logo">PPGEE</span>
        </div>

        <div className="admin-topbar-right">
          <span className="admin-topbar-title">Painel Administrativo</span>
          <span className="admin-topbar-divider" aria-hidden="true" />
          <div className="admin-topbar-role">
            <span className="admin-topbar-role-dot" aria-hidden="true" />
            <span>Admin</span>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <nav className="admin-mobile-nav" aria-label="Navegacao rapida administrativa">
        {ADMIN_NAV_ITEMS.filter((item) => item.section !== "administracao").map((item) => {
          const isActive = item.href === "/admin" ? pathname === item.href : pathname?.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} className={`admin-mobile-nav-item ${isActive ? "admin-mobile-nav-item--active" : ""}`}>
              <span className="admin-mobile-nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button aria-label="Sair" className="admin-mobile-nav-logout" onClick={session.signOut} type="button">
          Sair
        </button>
      </nav>
    </header>
  );
}
