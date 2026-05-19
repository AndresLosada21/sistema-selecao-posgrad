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

/* Ícones lucide distintos por módulo — 18px para legibilidade */
const iconDashboard = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const iconEditais = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

const iconIsencao = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

const iconHomologacao = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const iconEtapa1 = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
  </svg>
);

const iconEtapa2 = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
  </svg>
);

const iconClassificacao = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.4 4 6 4.5 6 4.5" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5c-.9 0-1.5.5-1.5.5" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const iconPoliticas = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
);

const iconRecursos = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const iconUsuarios = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);

const iconPublicacoes = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
  </svg>
);

const iconLogout = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" />
  </svg>
);

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Painel Geral", section: "principal", icon: iconDashboard },
  { href: "/admin/editais", label: "Editais", section: "processo", icon: iconEditais },
  { href: "/admin/isencao", label: "Isenção", section: "processo", icon: iconIsencao },
  { href: "/admin/homologacao", label: "Homologação", section: "processo", icon: iconHomologacao },
  { href: "/admin/etapa-1", label: "Etapa 1 — Redação", section: "avaliacao", icon: iconEtapa1 },
  { href: "/admin/etapa-2", label: "Etapa 2 — Títulos", section: "avaliacao", icon: iconEtapa2 },
  { href: "/admin/classificacao", label: "Classificação Final", section: "avaliacao", icon: iconClassificacao },
  { href: "/admin/politicas-afirmativas", label: "Políticas Afirmativas", section: "avaliacao", icon: iconPoliticas },
  { href: "/admin/recursos", label: "Recursos", section: "avaliacao", icon: iconRecursos },
  { href: "/admin/usuarios", label: "Usuários", section: "administracao", icon: iconUsuarios },
  { href: "/admin/publicacoes", label: "Publicações Oficiais", section: "administracao", icon: iconPublicacoes },
];

const SECTIONS: Array<{ key: AdminNavItem["section"]; label?: string }> = [
  { key: "principal" },
  { key: "processo", label: "PROCESSO SELETIVO" },
  { key: "avaliacao", label: "AVALIAÇÃO" },
  { key: "administracao", label: "ADMINISTRAÇÃO" },
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
