"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { useSession } from "@/lib/auth/session-provider";

export default function AdminPublicacoesLauncher() {
  const session = useSession();
  const [editalId, setEditalId] = useState("");

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Publicacoes Oficiais</h1>
          <p>Selecione um edital para continuar.</p>
        </div>
      </div>

      <div className="admin-form-card admin-launcher-card">
        <h2 className="admin-form-card-title">Selecionar edital</h2>
        <AdminEditalCombobox allowEmpty={false} emptyLabel="" label="Edital" onChange={setEditalId} token={session.token ?? ""} value={editalId} />
        {editalId ? (
          <Link className="admin-page-cta" href={`/admin/publicacoes/${editalId}`} style={{ textDecoration: "none", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8 }}>
            Abrir publicacoes
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        ) : (
          <span className="admin-soft-note">Selecione um edital para continuar.</span>
        )}
      </div>
    </div>
  );
}
