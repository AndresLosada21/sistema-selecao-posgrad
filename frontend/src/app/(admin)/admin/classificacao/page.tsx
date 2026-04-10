"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { useSession } from "@/lib/auth/session-provider";

export default function AdminClassificacaoLauncher() {
  const session = useSession();
  const [editalId, setEditalId] = useState("");

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Classificacao Final</h1>
          <p>Selecione o edital para acessar o ranking e operacoes de recalculo.</p>
        </div>
      </div>

      <div className="admin-form-card" style={{ maxWidth: 600 }}>
        <h2 className="admin-form-card-title">Selecionar edital</h2>
        <AdminEditalCombobox allowEmpty={false} emptyLabel="" label="Edital" onChange={setEditalId} token={session.token ?? ""} value={editalId} />
        {editalId ? (
          <Link className="admin-page-cta" href={`/admin/classificacao/${editalId}`} style={{ textDecoration: "none", alignSelf: "flex-start" }}>
            Abrir classificacao
          </Link>
        ) : (
          <span style={{ fontSize: 13, color: "#94A3B8" }}>Selecione um edital para continuar.</span>
        )}
      </div>
    </div>
  );
}
