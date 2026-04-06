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
import { listEtapa1 } from "@/modules/admin-etapas/api";
import type { Etapa1ListResponse } from "@/modules/admin-etapas/types";

export default function AdminEtapa1Page() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<Etapa1ListResponse | null>(null);
  const [draftFilter, setDraftFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    listEtapa1(token, { editalId: filter || undefined, page, pageSize: 20 })
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          signOut();
          return;
        }
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [filter, page, signOut, token]);

  if (status === "loading") return <LoadingState title="Carregando etapa 1" description="Consultando a fila administrativa da etapa 1." />;
  if (status === "error") return <ErrorState title="Falha ao carregar etapa 1" description={message ?? undefined} />;

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Fila administrativa da etapa 1"
        description="Sem filtro aplicado, a pagina busca a fila completa retornada pelo backend. Use o ID do edital apenas para restringir a operacao."
      />

      <SectionCard title="Filtro da etapa 1" description="Filtra a fila pelo edital quando necessario.">
        <div className="content-list">
          <label className="field-block">
            <span>ID do edital</span>
            <input onChange={(event) => setDraftFilter(event.target.value)} value={draftFilter} />
          </label>
          <div className="content-item-links">
            <ActionButton onClick={() => setFilter(draftFilter.trim())} type="button" variant="secondary">Aplicar filtro</ActionButton>
            <ActionButton onClick={() => { setDraftFilter(""); setFilter(""); setPage(1); }} type="button" variant="ghost">Limpar filtro</ActionButton>
            <Link className="nav-link" href="/editais">Consultar editais publicados</Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Fila da etapa 1" description="Lista administrativa das inscricoes aptas para avaliacao e leitura do espelho.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row">
                  <strong>{item.candidato.nomeCompleto}</strong>
                  <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                </div>
                <small>Edital: {item.edital.numero}</small>
                <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
                <small>Nota atual: {item.avaliacao?.nota ?? "sem nota"}</small>
                <small>Status da avaliacao: {getStatusLabel(item.avaliacao?.status ?? "SEM_AVALIACAO")}</small>
                <small>Espelho solicitado em: {formatIsoDate(item.avaliacao?.espelhoSolicitadoEm ?? null)}</small>
                <small>Espelho liberado em: {formatIsoDate(item.avaliacao?.espelhoLiberadoEm ?? null)}</small>
                <div className="content-item-links">
                  <Link className="nav-link" href={`/admin/etapa-1/${item.id}`}>
                    Abrir detalhe
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem inscricoes para etapa 1" description="Nenhuma inscricao foi retornada para o filtro atual." />
        )}
        <div className="content-item-links">
          <ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="ghost">Pagina anterior</ActionButton>
          <small>{`Pagina ${data?.page ?? page}`}</small>
          <ActionButton disabled={(data?.items.length ?? 0) < (data?.pageSize ?? 20)} onClick={() => setPage((current) => current + 1)} type="button" variant="ghost">Proxima pagina</ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}
