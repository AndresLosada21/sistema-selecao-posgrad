"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useSession } from "@/lib/auth/session-provider";

type AdminNavItem = {
  href: string;
  label: string;
  section: "principal" | "processo" | "avaliacao" | "administracao";
  icon: ReactNode;
};

/* Icones alinhados ao Pencil DS (lucide equivalents) */
const iconDashboard = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="10" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>;
const iconFileText = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></svg>;
const iconHandCoins = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" /><path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /><path d="m2 16 6 6" /><circle cx="16" cy="9" r="2.9" /><circle cx="6" cy="5" r="3" /></svg>;
const iconShieldCheck = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>;
const iconClipboardList = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg>;
const iconAward = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>;
const iconTrendingUp = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>;
const iconScale = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg>;
const iconMessageSquare = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
const iconUsers = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const iconMegaphone = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8 1.4" /></svg>;
const iconLogout = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>;

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Painel Geral", section: "principal", icon: iconDashboard },
  /* PROCESSO SELETIVO */
  { href: "/admin/editais", label: "Editais", section: "processo", icon: iconFileText },
  { href: "/admin/isencao", label: "Isencao", section: "processo", icon: iconHandCoins },
  { href: "/admin/homologacao", label: "Homologacao", section: "processo", icon: iconShieldCheck },
  /* AVALIACAO */
  { href: "/admin/etapa-1", label: "Etapa 1 — Redacao", section: "avaliacao", icon: iconClipboardList },
  { href: "/admin/etapa-2", label: "Etapa 2 — Titulos", section: "avaliacao", icon: iconAward },
  { href: "/admin/classificacao", label: "Classificacao Final", section: "avaliacao", icon: iconTrendingUp },
  { href: "/admin/politicas-afirmativas", label: "Pol. Afirmativas", section: "avaliacao", icon: iconScale },
  { href: "/admin/recursos", label: "Recursos", section: "avaliacao", icon: iconMessageSquare },
  /* ADMINISTRACAO */
  { href: "/admin/usuarios", label: "Usuarios", section: "administracao", icon: iconUsers },
  { href: "/admin/publicacoes", label: "Publicacoes Oficiais", section: "administracao", icon: iconMegaphone },
];

const SECTIONS: Array<{ key: AdminNavItem["section"]; label?: string }> = [
  { key: "principal" },
  { key: "processo", label: "PROCESSO SELETIVO" },
  { key: "avaliacao", label: "AVALIACAO" },
  { key: "administracao", label: "ADMINISTRACAO" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const session = useSession();

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/admin") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="admin-sidebar" aria-label="Menu administrativo">
      {SECTIONS.map((section) => {
        const items = ADMIN_NAV_ITEMS.filter((item) => item.section === section.key);
        return (
          <div className="admin-sidebar-section" key={section.key}>
            {section.label ? <span className="admin-sidebar-section-label">{section.label}</span> : null}
            <nav className="admin-sidebar-nav">
              {items.map((item) => (
                <Link key={item.href} href={item.href} className={`admin-sidebar-item ${isActive(item.href) ? "admin-sidebar-item--active" : ""}`}>
                  <span className="admin-sidebar-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        );
      })}

      <div className="admin-sidebar-footer">
        <button aria-label="Sair" className="admin-sidebar-item admin-sidebar-item--danger" onClick={session.signOut} type="button">
          <span className="admin-sidebar-icon" aria-hidden="true">{iconLogout}</span>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
