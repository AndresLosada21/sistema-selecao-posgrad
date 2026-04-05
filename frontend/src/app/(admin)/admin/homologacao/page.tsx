"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";

import { listFundamentosHomologacao, listInscricoesParaHomologacao } from "@/modules/admin-homologacao/api";
import type { AdminInscricoesHomologacaoResponse, HomologacaoFundamentosResponse } from "@/modules/admin-homologacao/types";

export default function AdminHomologacaoPage() {
  const session = useSession();
  const [data, setData] = useState<AdminInscricoesHomologacaoResponse | null>(null);
  const [fundamentos, setFundamentos] = useState<HomologacaoFundamentosResponse | null>(null);
  const [draftFilter, setDraftFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) {
      return;
    }

    Promise.all([
      listInscricoesParaHomologacao(session.token, { editalId: filter || undefined, page, pageSize: 20 }),
      listFundamentosHomologacao(session.token),
    ])
      .then(([items, fundamentosResponse]) => {
        setData(items);
        setFundamentos(fundamentosResponse);
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
  }, [filter, page, session]);

  const resumo = useMemo(() => ({
    total: data?.total ?? 0,
    comParecerPreliminar: data?.items.filter((item) => item.homologacao?.statusPreliminar).length ?? 0,
    comParecerFinal: data?.items.filter((item) => item.homologacao?.statusFinal).length ?? 0,
  }), [data]);

  if (status === "loading") {
    return <LoadingState title="Carregando fila de homologacao" description="Consultando inscricoes, filtros e fundamentos operacionais." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar homologacao" description={message ?? undefined} />;
  }

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Fila administrativa de homologacao"
        description="Use o filtro por edital apenas quando precisar restringir a fila. Sem filtro aplicado, a pagina busca todas as inscricoes retornadas pelo backend."
      />

      <SectionCard title="Resumo da fila de homologacao" description="Leitura inicial dos contratos administrativos do modulo de homologacao.">
        <div className="summary-grid">
          <article className="summary-card">
            <span>Total de inscricoes</span>
            <strong>{resumo.total}</strong>
          </article>
          <article className="summary-card">
            <span>Com preliminar</span>
            <strong>{resumo.comParecerPreliminar}</strong>
          </article>
          <article className="summary-card">
            <span>Com final</span>
            <strong>{resumo.comParecerFinal}</strong>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Filtro operacional" description="Filtra a fila por edital quando necessario.">
        <div className="content-list">
          <label className="field-block">
            <span>ID do edital</span>
            <input onChange={(event) => setDraftFilter(event.target.value)} placeholder="Opcional" value={draftFilter} />
          </label>
          <div className="content-item-links">
            <ActionButton onClick={() => setFilter(draftFilter.trim())} type="button" variant="secondary">Aplicar filtro</ActionButton>
            <ActionButton onClick={() => { setDraftFilter(""); setFilter(""); setPage(1); }} type="button" variant="ghost">Limpar filtro</ActionButton>
            <Link className="nav-link" href="/editais">Consultar editais publicados</Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Fila de inscricoes" description="Lista administrativa para abertura do detalhe operacional da homologacao.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row">
                  <strong>{item.candidato.nomeCompleto}</strong>
                  <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                </div>
                <small>Edital: {item.edital.numero}</small>
                <small>Curso: {getStatusLabel(item.edital.cursoNivel)}</small>
                <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
                <small>Pagamento: {getStatusLabel(item.statusPagamento)}</small>
                <small>Documentos: {item.documentosTotal}</small>
                <small>Submetida em: {formatIsoDate(item.submetidaEm)}</small>
                <small>Homologacao preliminar: {getStatusLabel(item.homologacao?.statusPreliminar ?? "SEM_PARECER")}</small>
                <small>Homologacao final: {getStatusLabel(item.homologacao?.statusFinal ?? "SEM_PARECER")}</small>
                <div className="content-item-links">
                  <Link className="nav-link" href={`/admin/homologacao/${item.id}`}>
                    Abrir detalhe
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Fila vazia" description="Nenhuma inscricao foi retornada para o filtro atual." />
        )}
        <div className="content-item-links">
          <ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="ghost">Pagina anterior</ActionButton>
          <small>{`Pagina ${data?.page ?? page}`}</small>
          <ActionButton disabled={(data?.items.length ?? 0) < (data?.pageSize ?? 20)} onClick={() => setPage((current) => current + 1)} type="button" variant="ghost">Proxima pagina</ActionButton>
        </div>
      </SectionCard>

      <SectionCard title="Fundamentos operacionais" description="Catalogo de fundamentos devolvido pelo backend para apoiar os pareceres.">
        {fundamentos?.items.length ? (
          <div className="content-list">
            {fundamentos.items.map((fundamento) => (
              <article className="content-item" key={fundamento.codigo}>
                <div className="content-item-row">
                  <strong>{fundamento.codigo}</strong>
                  <StatusBadge variant={fundamento.sanavel ? "warning" : "error"}>{fundamento.sanavel ? "Sanavel" : "Nao sanavel"}</StatusBadge>
                </div>
                <p>{fundamento.titulo}</p>
                <small>Item do edital: {fundamento.itemEdital}</small>
                <small>Documento: {fundamento.documentoTipo ?? "nao vinculado"}</small>
                <small>{fundamento.descricao}</small>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem fundamentos" description="O backend nao retornou fundamentos operacionais para a homologacao." />
        )}
      </SectionCard>
    </div>
  );
}
