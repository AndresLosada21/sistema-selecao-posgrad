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
          <p>Selecione o edital para acessar o workspace de publicacoes.</p>
        </div>
      </div>

      <div className="admin-form-card" style={{ maxWidth: 600 }}>
        <h2 className="admin-form-card-title">Selecionar edital</h2>
        <AdminEditalCombobox allowEmpty={false} emptyLabel="" label="Edital" onChange={setEditalId} token={session.token ?? ""} value={editalId} />
        {editalId ? (
          <Link className="admin-page-cta" href={`/admin/publicacoes/${editalId}`} style={{ textDecoration: "none", alignSelf: "flex-start" }}>
            Abrir publicacoes
          </Link>
        ) : (
          <span style={{ fontSize: 13, color: "#94A3B8" }}>Selecione um edital para continuar.</span>
        )}
      </div>
    </div>
  );
}
