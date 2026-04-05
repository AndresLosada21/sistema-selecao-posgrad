"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { getErrorMessage } from "@/lib/http/api-error";
import { listEditais } from "@/modules/edital/api";
import type { EditaisResponse } from "@/modules/edital/types";

export default function AdminClassificacaoIndexPage() {
  const [draftEditalId, setDraftEditalId] = useState("");
  const [data, setData] = useState<EditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listEditais()
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return <LoadingState title="Carregando editais" description="Consultando editais para abrir o modulo de classificacao." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar editais" description={message ?? undefined} />;
  }

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Entrada operacional da classificacao"
        description="Selecione um edital publicado abaixo ou informe o ID manualmente para abrir o modulo de classificacao correspondente."
      />

      <SectionCard title="Abrir classificacao por ID" description="Use esta opcao quando o edital desejado nao estiver visivel na lista resumida abaixo.">
        <div className="content-list">
          <label className="field-block">
            <span>ID do edital</span>
            <input onChange={(event) => setDraftEditalId(event.target.value)} value={draftEditalId} />
          </label>
          <div className="content-item-links">
            <Link className="nav-link" href={draftEditalId.trim() ? `/admin/classificacao/${draftEditalId.trim()}` : "/admin/classificacao"}>
              Abrir rota por ID
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Editais disponiveis" description="Atalhos para abrir rapidamente a classificacao por edital.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((edital) => (
              <article className="content-item" key={edital.id}>
                <strong>{edital.numero}</strong>
                <p>{edital.titulo}</p>
                <small>ID: {edital.id}</small>
                <div className="content-item-links">
                  <Link className="nav-link" href={`/admin/classificacao/${edital.id}`}>
                    Abrir classificacao
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem editais disponiveis" description="Nenhum edital publico foi retornado para abrir o modulo de classificacao." />
        )}
      </SectionCard>
    </div>
  );
}
