"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listAllAdminEditais } from "@/modules/admin-edital/api";
import type { AdminEditaisResponse } from "@/modules/admin-edital/types";

export default function AdminPublicacoesIndexPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [draftEditalId, setDraftEditalId] = useState("");
  const [data, setData] = useState<AdminEditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useAbortableEffect(async (signal) => {
    if (!token) {
      return;
    }

    try {
      const response = await listAllAdminEditais(token);
      if (signal.aborted) return;
      setData(response);
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [signOut, token]);

  if (status === "loading") {
    return <LoadingState title="Carregando editais" description="Consultando editais para abrir o modulo de publicacoes." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar editais" description={message ?? undefined} />;
  }

  return (
    <div className="stack-layout">
      <PageHeader title="Publicacoes Oficiais" description="Selecione um edital para abrir o workspace de preview e publicacao." />

      <PageFeedback
        type="info"
        title="Entrada operacional das publicacoes oficiais"
        description="Selecione um edital publicado abaixo para abrir o modulo de previews e publicacao oficial."
      />

      <SectionCard title="Abrir publicacoes por edital" description="Escolha um edital pelo seletor pesquisável ou use os atalhos abaixo.">
        <div className="admin-launcher-form">
          <AdminEditalCombobox allowEmpty={false} emptyLabel="Selecione um edital" label="Edital" onChange={setDraftEditalId} token={token ?? ""} value={draftEditalId} />
          <div className="content-item-links admin-launcher-form-actions">
            <Link className="nav-link" href={draftEditalId.trim() ? `/admin/publicacoes/${draftEditalId.trim()}` : "/admin/publicacoes"}>
              Abrir publicacoes
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Editais disponiveis" description="Atalhos para abrir rapidamente o modulo de publicacoes por edital.">
        {data?.items.length ? (
          <div className="admin-launcher-grid">
            {data.items.map((edital) => (
              <article className="admin-launcher-card" key={edital.id}>
                <div className="admin-launcher-card-body">
                  <strong>{edital.numero}</strong>
                  <p>{edital.titulo}</p>
                  <small>{`${edital.cursoNivel} · ${edital.status}`}</small>
                </div>
                <div className="content-item-links">
                  <Link className="nav-link" href={`/admin/publicacoes/${edital.id}`}>
                    Abrir publicacoes
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem editais disponiveis" description="Nenhum edital administrativo foi retornado para abrir o modulo de publicacoes." />
        )}
      </SectionCard>
    </div>
  );
}
