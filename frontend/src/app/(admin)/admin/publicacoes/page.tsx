"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listAdminEditais } from "@/modules/admin-edital/api";
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
      const response = await listAdminEditais(token);
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
      <PageFeedback
        type="info"
        title="Entrada operacional das publicacoes oficiais"
        description="Selecione um edital publicado abaixo ou informe o ID manualmente para abrir o modulo de previews e publicacao oficial."
      />

      <SectionCard title="Abrir publicacoes por edital" description="Selecione o edital desejado ou use a lista resumida abaixo.">
        <div className="content-list">
          <label className="field-block">
            <span>Edital</span>
            <select className="select-field" onChange={(event) => setDraftEditalId(event.target.value)} value={draftEditalId}>
              <option value="">Selecione um edital</option>
              {data?.items.map((edital) => <option key={edital.id} value={edital.id}>{`${edital.numero} · ${edital.titulo}`}</option>)}
            </select>
          </label>
          <div className="content-item-links">
            <Link className="nav-link" href={draftEditalId.trim() ? `/admin/publicacoes/${draftEditalId.trim()}` : "/admin/publicacoes"}>
              Abrir publicacoes
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Editais disponiveis" description="Atalhos para abrir rapidamente o modulo de publicacoes por edital.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((edital) => (
              <article className="content-item" key={edital.id}>
                <strong>{edital.numero}</strong>
                <p>{edital.titulo}</p>
                <small>ID: {edital.id}</small>
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
