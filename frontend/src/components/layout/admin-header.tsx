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
        <span className="admin-topbar-title">Painel Administrativo</span>
        <div className="admin-topbar-right">
          <span className="admin-topbar-role">Admin</span>
          <button aria-label="Sair" className="admin-topbar-signout" onClick={session.signOut} type="button">
            Sair
          </button>
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
      </nav>
    </header>
  );
}
