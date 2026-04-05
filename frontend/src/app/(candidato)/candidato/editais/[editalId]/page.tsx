"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { resolveApiUrl } from "@/lib/config/api";
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
  const publicacoesDestaque = item?.publicacoesDestaque ?? [];
  const publicacoes = item?.publicacoes ?? [];
  const recursos = item?.recursos ?? [];
  const pacoteDocumentalUrl = item?.inscricao?.pacoteDocumental?.urlArquivo ?? null;

  if (status === "loading") {
    return <LoadingState title="Carregando edital do candidato" description="Consultando o acompanhamento consolidado do edital." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar acompanhamento" description={message ?? undefined} />;
  }

  if (!item) {
    return (
      <div className="stack-layout">
        <EmptyState title="Edital nao vinculado" description="Nao foi encontrada participacao deste candidato para o edital informado." />
        <div className="content-item-links">
          <Link className="nav-link" href="/candidato/participacoes">
            Ver participacoes da conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Acompanhamento consolidado do edital"
        description="Esta pagina concentra os estados do candidato neste edital, os artefatos disponiveis e o historico oficial publicado."
      />

      <SectionCard title={`${item.edital.numero} · ${item.edital.cursoNivel}`} description={item.edital.titulo}>
        <div className="content-list">
          <div className="content-item-row">
            <small>Status do edital: {getStatusLabel(item.edital.status)}</small>
            <StatusBadge variant={getStatusVariant(item.statusParticipacao)}>{getStatusLabel(item.statusParticipacao)}</StatusBadge>
          </div>
          <small>Curso: {getStatusLabel(item.edital.cursoNivel)}</small>
          <small>Isencao: {getStatusLabel(item.isencao?.status ?? "SEM_PEDIDO")}</small>
          <small>Inscricao: {getStatusLabel(item.inscricao?.status ?? "SEM_INSCRICAO")}</small>
          <small>Homologacao final: {getStatusLabel(item.inscricao?.homologacao?.statusFinal ?? "SEM_RESULTADO")}</small>
          <small>Etapa 1: {getStatusLabel(item.inscricao?.etapa1?.status ?? "SEM_RESULTADO")}</small>
          <small>Etapa 2: {getStatusLabel(item.inscricao?.etapa2?.status ?? "SEM_RESULTADO")}</small>
          <small>Politicas afirmativas: {getStatusLabel(item.inscricao?.politicasAfirmativas?.statusOperacional ?? "SEM_RESULTADO")}</small>
          <small>Classificacao: {getStatusLabel(item.classificacao?.status ?? "SEM_CLASSIFICACAO")}</small>
          <small>Recursos interpostos: {recursos.length}</small>
          <div className="content-item-links">
            {!item.isencao ? (
              <Link className="nav-link" href={`/candidato/editais/${item.edital.id}/isencao/nova`}>
                Registrar pedido de isencao
              </Link>
            ) : null}
            <Link className="nav-link" href={`/candidato/editais/${item.edital.id}/inscricao`}>
              Abrir inscricao
            </Link>
            <Link className="nav-link" href={`/candidato/editais/${item.edital.id}/espelhos`}>
              Gerenciar espelhos
            </Link>
            <Link className="nav-link" href={`/candidato/recursos?editalId=${item.edital.id}`}>
              Abrir recursos
            </Link>
            {item.isencao ? (
              <Link className="nav-link" href="/candidato/isencoes">
                Ver historico de isencao
              </Link>
            ) : null}
              <Link className="nav-link" href={`/editais/${item.edital.id}/publicacoes`}>
                Ver publicacoes publicas
              </Link>
              {pacoteDocumentalUrl ? (
              <Link className="nav-link" href={resolveApiUrl(pacoteDocumentalUrl)} rel="noreferrer" target="_blank">
                Baixar pacote documental
              </Link>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Artefatos e publicacoes" description="Leitura das publicacoes destacadas e do historico versionado retornado pelo backend.">
        <div className="content-list">
          {publicacoesDestaque.map((publicacao) => (
            <article className="content-item" key={`destaque-${publicacao.id}`}>
              <div className="content-item-row">
                <strong>{publicacao.titulo}</strong>
                <StatusBadge variant={getStatusVariant(publicacao.tipo)}>{getStatusLabel(publicacao.tipo)}</StatusBadge>
              </div>
              <p>{publicacao.descricao ?? "Sem descricao cadastrada."}</p>
              <small>Versao: {publicacao.versao}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={resolveApiUrl(publicacao.arquivoUrl)} rel="noreferrer" target="_blank">
                  Abrir PDF oficial
                </Link>
              </div>
            </article>
          ))}
          {publicacoes.length ? null : <EmptyState title="Sem publicacoes" description="Ainda nao ha publicacoes oficiais vinculadas a este edital." />}
        </div>
      </SectionCard>

      <SectionCard title="Historico de publicacoes" description="Historico ordenado pelo payload consolidado da area do candidato.">
        <div className="content-list">
          {publicacoes.map((publicacao) => (
            <article className="content-item" key={publicacao.id}>
              <div className="content-item-row">
                <strong>{publicacao.titulo}</strong>
                <StatusBadge variant={getStatusVariant(publicacao.tipo)}>{getStatusLabel(publicacao.tipo)}</StatusBadge>
              </div>
              <small>Versao: {publicacao.versao}</small>
              <small>Publicado em: {formatIsoDate(publicacao.publicadoEm)}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={resolveApiUrl(publicacao.arquivoUrl)} rel="noreferrer" target="_blank">
                  Abrir PDF oficial
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      {recursos.length ? (
        <SectionCard title="Recursos vinculados" description="Resumo dos recursos ja interpostos neste edital.">
          <div className="content-list">
            {recursos.map((recurso) => (
              <article className="content-item" key={recurso.id}>
                <div className="content-item-row">
                  <strong>{getStatusLabel(recurso.fase)}</strong>
                  <StatusBadge variant={getStatusVariant(recurso.status)}>{getStatusLabel(recurso.status)}</StatusBadge>
                </div>
                <p>{recurso.fundamentacao ?? "Sem fundamentacao resumida disponivel."}</p>
                <small>Identificador: {recurso.id}</small>
                <small>Respondido em: {formatIsoDate(recurso.respondidoEm ?? null)}</small>
                <small>Decisao: {recurso.decisao ?? "ainda nao registrada"}</small>
              </article>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <PageFeedback
        type="info"
        title="Fluxo operacional deste edital"
        description="Use esta pagina para acompanhar estados, baixar artefatos e abrir os fluxos de inscricao e isencao. Recursos e espelhos ainda dependem das janelas e exposicoes retornadas pelo backend."
      />
    </div>
  );
}
