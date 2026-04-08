"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useSession } from "@/lib/auth/session-provider";

type AdminNavItem = {
  href: string;
  label: string;
  section?: "principal" | "modulos" | "administracao";
  icon: ReactNode;
};

const iconDashboard = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="10" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></svg>;
const iconEdital = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>;
const iconShield = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /></svg>;
const iconCheck = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
const iconPencil = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const iconFile = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;
const iconUsers = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const iconTrophy = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3a2 2 0 0 1 0 4h-3" /><path d="M7 5H4a2 2 0 0 0 0 4h3" /></svg>;
const iconMegaphone = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8 1.4" /></svg>;
const iconLogout = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>;

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Painel Geral", section: "principal", icon: iconDashboard },
  { href: "/admin/editais", label: "Editais", section: "modulos", icon: iconEdital },
  { href: "/admin/isencao", label: "Isenção", section: "modulos", icon: iconShield },
  { href: "/admin/homologacao", label: "Homologação", section: "modulos", icon: iconCheck },
  { href: "/admin/etapa-1", label: "Etapa 1 — Redação", section: "modulos", icon: iconPencil },
  { href: "/admin/etapa-2", label: "Etapa 2 — Títulos", section: "modulos", icon: iconFile },
  { href: "/admin/classificacao", label: "Classificação Final", section: "modulos", icon: iconTrophy },
  { href: "/admin/politicas-afirmativas", label: "Pol. Afirmativas", section: "modulos", icon: iconShield },
  { href: "/admin/recursos", label: "Recursos", section: "modulos", icon: iconFile },
  { href: "/admin/usuarios", label: "Usuários", section: "administracao", icon: iconUsers },
  { href: "/admin/publicacoes", label: "Publicações Oficiais", section: "administracao", icon: iconMegaphone },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const session = useSession();

  function isActive(href: string) {
    if (!pathname) return false;
    if (href === "/admin") return pathname === href;
    return pathname.startsWith(href);
  }

  const sections: Array<{ key: "principal" | "modulos" | "administracao"; label?: string }> = [
    { key: "principal" },
    { key: "modulos", label: "AVALIAÇÃO" },
    { key: "administracao", label: "ADMINISTRAÇÃO" },
  ];

  return (
    <aside className="admin-sidebar" aria-label="Menu administrativo">
      {sections.map((section) => {
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
