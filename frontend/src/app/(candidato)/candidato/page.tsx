"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";

export default function CandidateDashboardPage() {
  const session = useSession();
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) {
      return;
    }

    getCandidateDashboard(session.token)
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
  }, [session]);

  const summary = useMemo(() => {
    const first = data?.items[0];

    return {
      participacoes: data?.total ?? 0,
      inscricao: first?.inscricao?.status ?? "SEM_INSCRICAO",
      classificacao: first?.classificacao?.status ?? "SEM_CLASSIFICACAO",
    };
  }, [data]);

  if (status === "loading") {
    return <LoadingState description="Consultando area consolidada do candidato..." title="Carregando painel" />;
  }

  if (status === "error") {
    return <ErrorState description={message ?? undefined} title="Falha ao carregar painel" />;
  }

  if (!data?.items.length) {
    return <EmptyState description="Ainda nao ha participacoes vinculadas a esta conta." title="Nenhuma participacao encontrada" />;
  }

  return (
    <div className="stack-layout">
      <SectionCard description={session.user ? `${session.user.nomeCompleto} · ${session.user.email}` : undefined} title="Resumo do candidato">
        <div className="summary-grid">
          <article className="summary-card">
            <span>Participacoes</span>
            <strong>{summary.participacoes}</strong>
          </article>
          <article className="summary-card">
            <span>Status da inscricao</span>
            <strong>{summary.inscricao}</strong>
          </article>
          <article className="summary-card">
            <span>Classificacao</span>
            <strong>{summary.classificacao}</strong>
          </article>
        </div>
      </SectionCard>

      <SectionCard description="Consumo inicial do payload consolidado da area do candidato." title="Participacoes por edital">
        <div className="content-list">
          {data.items.map((item) => (
            <article className="content-item" key={item.id}>
              <div className="content-item-row">
                <strong>{item.edital.numero}</strong>
                <StatusBadge>{item.edital.status}</StatusBadge>
              </div>
              <p>{item.edital.titulo}</p>
              <small>Isencao: {item.isencao?.status ?? "SEM_PEDIDO"}</small>
              <small>Inscricao: {item.inscricao?.status ?? "SEM_INSCRICAO"}</small>
              <small>Documentos: {item.inscricao?.documentos.length ?? 0}</small>
              <small>Etapa 1: {item.inscricao?.etapa1?.status ?? "SEM_RESULTADO"}</small>
              <small>Etapa 2: {item.inscricao?.etapa2?.status ?? "SEM_RESULTADO"}</small>
              <small>Classificacao: {item.classificacao?.status ?? "SEM_CLASSIFICACAO"}</small>
              <small>Recursos: {item.recursos.length}</small>
              <small>Publicacoes em destaque: {item.publicacoesDestaque.length}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={`/candidato/editais/${item.edital.id}`}>
                  Abrir acompanhamento
                </Link>
                {item.publicacoesDestaque[0] ? (
                  <Link className="nav-link" href={item.publicacoesDestaque[0].arquivoUrl} target="_blank">
                    Abrir ultimo PDF oficial
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Publicacoes em destaque" description="Atalhos para os artefatos oficiais mais recentes por edital.">
        <div className="content-list">
          {data.items.flatMap((item) =>
            item.publicacoesDestaque.map((publicacao) => (
              <article className="content-item" key={`${item.id}-${publicacao.id}`}>
                <div className="content-item-row">
                  <strong>{publicacao.titulo}</strong>
                  <StatusBadge>{publicacao.tipo}</StatusBadge>
                </div>
                <small>Edital: {item.edital.numero}</small>
                <small>Versao: {publicacao.versao}</small>
                <small>Publicado em: {formatIsoDate(publicacao.publicadoEm ?? null)}</small>
                <div className="content-item-links">
                  <Link className="nav-link" href={publicacao.arquivoUrl} target="_blank">
                    Abrir PDF oficial
                  </Link>
                </div>
              </article>
            )),
          )}
        </div>
      </SectionCard>
    </div>
  );
}
