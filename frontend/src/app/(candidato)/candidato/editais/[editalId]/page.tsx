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

type CandidateEditalPageProps = {
  params: Promise<{ editalId: string }>;
};

export default function CandidateEditalPage({ params }: CandidateEditalPageProps) {
  const session = useSession();
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setEditalId(resolved.editalId));
  }, [params]);

  useEffect(() => {
    if (!session.token || !editalId) {
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
  }, [editalId, session]);

  const item = useMemo(() => data?.items.find((entry) => entry.edital.id === editalId) ?? null, [data, editalId]);

  if (status === "loading") {
    return <LoadingState title="Carregando edital do candidato" description="Consultando o acompanhamento consolidado do edital." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar acompanhamento" description={message ?? undefined} />;
  }

  if (!item) {
    return <EmptyState title="Edital nao vinculado" description="Nao foi encontrada participacao deste candidato para o edital informado." />;
  }

  return (
    <div className="stack-layout">
      <SectionCard title={`${item.edital.numero} · ${item.edital.cursoNivel}`} description={item.edital.titulo}>
        <div className="content-list">
          <div className="content-item-row">
            <small>Status do edital: {item.edital.status}</small>
            <StatusBadge>{item.statusParticipacao}</StatusBadge>
          </div>
          <small>Isencao: {item.isencao?.status ?? "SEM_PEDIDO"}</small>
          <small>Inscricao: {item.inscricao?.status ?? "SEM_INSCRICAO"}</small>
          <small>Homologacao final: {item.inscricao?.homologacao?.statusFinal ?? "SEM_RESULTADO"}</small>
          <small>Etapa 1: {item.inscricao?.etapa1?.status ?? "SEM_RESULTADO"}</small>
          <small>Etapa 2: {item.inscricao?.etapa2?.status ?? "SEM_RESULTADO"}</small>
          <small>Politicas afirmativas: {item.inscricao?.politicasAfirmativas?.statusOperacional ?? "SEM_RESULTADO"}</small>
          <small>Classificacao: {item.classificacao?.status ?? "SEM_CLASSIFICACAO"}</small>
          <div className="content-item-links">
            <Link className="nav-link" href={`/candidato/editais/${item.edital.id}/isencao/nova`}>
              Registrar ou atualizar isencao
            </Link>
            <Link className="nav-link" href={`/candidato/editais/${item.edital.id}/inscricao`}>
              Abrir inscricao
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Artefatos e publicacoes" description="Leitura das publicacoes destacadas e do historico versionado retornado pelo backend.">
        <div className="content-list">
          {item.publicacoesDestaque.map((publicacao) => (
            <article className="content-item" key={`destaque-${publicacao.id}`}>
              <div className="content-item-row">
                <strong>{publicacao.titulo}</strong>
                <StatusBadge>{publicacao.tipo}</StatusBadge>
              </div>
              <p>{publicacao.descricao ?? "Sem descricao cadastrada."}</p>
              <small>Versao: {publicacao.versao}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={publicacao.arquivoUrl} target="_blank">
                  Abrir PDF oficial
                </Link>
              </div>
            </article>
          ))}
          {item.publicacoes.length ? null : <EmptyState title="Sem publicacoes" description="Ainda nao ha publicacoes oficiais vinculadas a este edital." />}
        </div>
      </SectionCard>

      <SectionCard title="Historico de publicacoes" description="Historico ordenado pelo payload consolidado da area do candidato.">
        <div className="content-list">
          {item.publicacoes.map((publicacao) => (
            <article className="content-item" key={publicacao.id}>
              <div className="content-item-row">
                <strong>{publicacao.titulo}</strong>
                <StatusBadge>{publicacao.tipo}</StatusBadge>
              </div>
              <small>Versao: {publicacao.versao}</small>
              <small>Publicado em: {formatIsoDate(publicacao.publicadoEm)}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={publicacao.arquivoUrl} target="_blank">
                  Abrir PDF oficial
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
