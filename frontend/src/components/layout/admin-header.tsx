"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { ADMIN_NAV_ITEMS } from "@/components/layout/admin-sidebar";
import { useSession } from "@/lib/auth/session-provider";

export function AdminHeader() {
  const session = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-inner">
        <Link href="/admin" className="admin-topbar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/ppgee-colorida.png" alt="PPGEE/UFAM" className="admin-topbar-brand-img" height={36} />
        </Link>

        <div className="admin-topbar-right" ref={ref} style={{ position: "relative" }}>
          <span className="admin-topbar-title">Painel Administrativo</span>
          <span className="admin-topbar-divider" aria-hidden="true" />
          <button
            className="admin-topbar-role"
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="true"
          >
            <span className="admin-topbar-role-dot" aria-hidden="true" />
            <span>Admin</span>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {open ? (
            <div className="admin-topbar-dropdown" role="menu">
              <Link href="/admin" className="admin-topbar-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                Dashboard
              </Link>
              <Link href="/admin/usuarios" className="admin-topbar-dropdown-item" role="menuitem" onClick={() => setOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                Usuarios
              </Link>
              <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0" }} />
              <button className="admin-topbar-dropdown-item admin-topbar-dropdown-item--danger" onClick={session.signOut} type="button" role="menuitem">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                Encerrar sessao
              </button>
            </div>
          ) : null}
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

{/* Sair disponivel no dropdown do avatar */}
      </nav>
    </header>
  );
}
