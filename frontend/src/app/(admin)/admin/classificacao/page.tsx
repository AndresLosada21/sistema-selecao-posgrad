"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";

export default function AdminClassificacaoIndexPage() {
  const session = useSession();
  const [draftEditalId, setDraftEditalId] = useState("");

  return (
    <div className="stack-layout">
      <PageHeader title="Classificação" description="Selecione um edital para abrir o módulo de classificação." />

      <SectionCard title="Abrir classificação" description="Selecione um edital para continuar.">
        <div className="admin-launcher-select-card">
          <AdminEditalCombobox allowEmpty={false} emptyLabel="Selecione um edital" label="Edital" onChange={setDraftEditalId} token={session.token ?? ""} value={draftEditalId} />
          <div className="content-item-links admin-launcher-form-actions">
            <Link className="nav-link" href={draftEditalId.trim() ? `/admin/classificacao/${draftEditalId.trim()}` : "/admin/classificacao"}>
              Abrir classificação
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
