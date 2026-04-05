"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listPoliticas } from "@/modules/admin-politicas/api";
import type { PoliticasListResponse } from "@/modules/admin-politicas/types";

export default function AdminPoliticasPage() {
  const session = useSession();
  const [draftFilter, setDraftFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<PoliticasListResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token || !filter) return;
    setStatus("loading");
    listPoliticas(filter, session.token)
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          session.signOut();
          return;
        }
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [filter, session]);

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Fila de politicas afirmativas por edital"
        description="Este modulo ainda depende de contexto por edital. Informe o ID apenas quando quiser consultar uma fila especifica."
      />

      <SectionCard title="Filtro de politicas afirmativas" description="Informe o ID do edital para consultar as etapas vinculadas.">
        <div className="content-list">
          <label className="field-block"><span>ID do edital</span><input onChange={(e) => setDraftFilter(e.target.value)} value={draftFilter} /></label>
          <div className="content-item-links">
            <ActionButton onClick={() => setFilter(draftFilter.trim())} type="button" variant="secondary">Consultar fila</ActionButton>
            <ActionButton onClick={() => { setDraftFilter(""); setFilter(""); setData(null); setStatus("idle"); }} type="button" variant="ghost">Limpar</ActionButton>
            <Link className="nav-link" href="/editais">Consultar editais publicados</Link>
          </div>
        </div>
      </SectionCard>
      {status === "idle" ? <EmptyState title="Nenhum edital consultado" description="Informe um ID de edital para carregar a fila de politicas afirmativas correspondente." /> : null}
      {status === "loading" ? <LoadingState title="Carregando etapas" description="Consultando a fila de politicas afirmativas." /> : null}
      {status === "error" ? <ErrorState title="Falha ao carregar politicas afirmativas" description={message ?? undefined} /> : null}
      {status === "ready" ? (
        <SectionCard title="Fila de politicas afirmativas" description="Leitura administrativa da etapa e acesso ao detalhe por inscricao.">
          {data?.items.length ? (
            <div className="content-list">
              {data.items.map((item) => (
                <article className="content-item" key={item.id}>
                  <div className="content-item-row"><strong>{item.candidato.nomeCompleto}</strong><StatusBadge variant={getStatusVariant(item.statusOperacao)}>{getStatusLabel(item.statusOperacao)}</StatusBadge></div>
                  <small>Tipo: {getStatusLabel(item.tipo)}</small>
                  <small>Edital: {item.edital.numero}</small>
                  <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
                  <small>Resultado preliminar: {getStatusLabel(item.resultadoPreliminar ?? "SEM_RESULTADO")}</small>
                  <small>Resultado final: {getStatusLabel(item.resultadoFinal ?? "SEM_RESULTADO")}</small>
                  <small>Convocado em: {formatIsoDate(item.convocadoEm)}</small>
                  <div className="content-item-links"><Link className="nav-link" href={`/admin/politicas-afirmativas/${item.inscricao.id}?editalId=${encodeURIComponent(item.edital.id)}`}>Abrir detalhe</Link></div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="Sem etapas vinculadas" description="Nenhuma etapa de politicas afirmativas foi retornada para o edital informado." />}
        </SectionCard>
      ) : null}
    </div>
  );
}
