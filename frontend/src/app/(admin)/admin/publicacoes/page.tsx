"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";

export default function AdminPublicacoesIndexPage() {
  const session = useSession();
  const [draftEditalId, setDraftEditalId] = useState("");

  return (
    <div className="stack-layout">
      <PageHeader title="Publicações Oficiais" description="Selecione um edital para gerenciar publicações." />

      <SectionCard title="Abrir publicações" description="Selecione um edital para continuar.">
        <div className="admin-launcher-select-card">
          <AdminEditalCombobox allowEmpty={false} emptyLabel="Selecione um edital" label="Edital" onChange={setDraftEditalId} token={session.token ?? ""} value={draftEditalId} />
          <div className="content-item-links admin-launcher-form-actions">
            <Link className="nav-link" href={draftEditalId.trim() ? `/admin/publicacoes/${draftEditalId.trim()}` : "/admin/publicacoes"}>
              Abrir publicações
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
