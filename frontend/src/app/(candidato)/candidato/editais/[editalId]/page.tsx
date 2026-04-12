"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { resolveApiUrl } from "@/lib/config/api";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";

/* ---- icons (Pencil-aligned) ---- */

const iconPencil = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z" /></svg>
);
const iconShieldCheck = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
);
const iconEye = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
);
const iconMessageSquare = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const iconDownload = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
);

type CandidateEditalPageProps = {
  params: Promise<{ editalId: string }>;
};

/* ---- helpers ---- */

const PENDING_STATUSES = new Set([
  "SEM_RESULTADO", "SEM_PEDIDO", "SEM_INSCRICAO", "SEM_CLASSIFICACAO",
  "PENDENTE", "",
]);

const SUCCESS_STATUSES = new Set([
  "DEFERIDA", "DEFERIDA_PRELIMINAR", "DEFERIDA_FINAL", "APROVADA", "APROVADO",
  "HOMOLOGADA", "HOMOLOGADA_PRELIMINAR", "HOMOLOGADA_FINAL",
  "SUBMETIDA", "CONFIRMADA", "CLASSIFICADO",
  "FINAL_PUBLICADA", "PRELIMINAR_PUBLICADA",
]);

const WARNING_STATUSES = new Set([
  "RASCUNHO", "SOLICITADA", "EM_ANALISE", "EM_AVALIACAO", "EM_ANDAMENTO",
]);

const ERROR_STATUSES = new Set([
  "INDEFERIDA", "INDEFERIDA_PRELIMINAR", "INDEFERIDA_FINAL",
  "NAO_HOMOLOGADA_PRELIMINAR", "NAO_HOMOLOGADA_FINAL",
  "ELIMINADA", "ELIMINADO", "NAO_CONFIRMADA",
]);

type HubColor = "success" | "warning" | "error" | "active" | "neutral";

function resolveHubValue(status: string | null | undefined): { text: string; color: HubColor } {
  const s = status ?? "";
  if (s === "SEM_RESULTADO") return { text: "Sem resultado", color: "neutral" };
  if (s === "SEM_CLASSIFICACAO") return { text: "Sem classificacao", color: "neutral" };
  if (s === "SEM_PEDIDO") return { text: "Sem pedido", color: "neutral" };
  if (s === "NAO_SOLICITADA") return { text: "Nao solicitada", color: "neutral" };
  if (!s || PENDING_STATUSES.has(s)) return { text: "Pendente", color: "neutral" };
  if (SUCCESS_STATUSES.has(s)) return { text: getStatusLabel(s), color: "success" };
  if (WARNING_STATUSES.has(s)) return { text: getStatusLabel(s), color: "warning" };
  if (ERROR_STATUSES.has(s)) return { text: getStatusLabel(s), color: "error" };
  return { text: getStatusLabel(s), color: "neutral" };
}

function getOrigemArquivoLabel(origem: "MANUAL" | "GERADO" | undefined) {
  return origem === "MANUAL" ? "PDF enviado" : "PDF gerado";
}

function getReservasConcorrenciaLabel(input: { acoesAfirmativas?: boolean; pcd?: boolean } | undefined) {
  if (!input) {
    return null;
  }

  if (input.acoesAfirmativas && input.pcd) {
    return "Acoes afirmativas + PCD";
  }

  if (input.acoesAfirmativas) {
    return "Acoes afirmativas";
  }

  if (input.pcd) {
    return "PCD";
  }

  return "Ampla concorrencia";
}

function getPoliticasTipoLabel(tipo: string | undefined) {
  return tipo === "PCD" ? "PCD" : "Heteroidentificacao";
}

/* ---- page ---- */

export default function CandidateEditalPage({ params }: CandidateEditalPageProps) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingPacote, setDownloadingPacote] = useState(false);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => { if (!cancelled) setEditalId(resolved.editalId); });
    return () => { cancelled = true; };
  }, [params]);

  useAbortableEffect(async (signal) => {
    if (!token || !editalId) return;
    try {
      const response = await getCandidateDashboard(token);
      if (signal.aborted) return;
      setData(response);
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [editalId, signOut, token]);

  const item = useMemo(() => data?.items.find((entry) => entry.edital.id === editalId) ?? null, [data, editalId]);
  const pacoteDocumentalUrl = item?.inscricao?.pacoteDocumental?.urlArquivo ?? null;

  if (status === "loading") return <LoadingState title="Carregando edital do candidato" description="Consultando o acompanhamento consolidado do edital." />;

  if (status === "error") return <ErrorState title="Falha ao carregar acompanhamento" description={message ?? undefined} />;

  if (!item) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <EmptyState title="Edital nao vinculado" description="Nao foi encontrada participacao deste candidato para o edital informado." />
        <Link href="/candidato/participacoes" style={{ fontSize: 13, fontWeight: 500, color: "#2563EB" }}>Ver participacoes da conta</Link>
      </div>
    );
  }

  const inscricao = item.inscricao;
  const hasInscricao = !!inscricao;
  const pacoteNomeArquivo = inscricao?.pacoteDocumental?.nomeArquivo ?? "pacote-documental.pdf";

  async function handleDownloadPacote() {
    if (!session.token || !pacoteDocumentalUrl) return;
    setDownloadingPacote(true);
    setMessage(null);
    try {
      await downloadAuthenticatedFile(pacoteDocumentalUrl, session.token, pacoteNomeArquivo);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setDownloadingPacote(false); }
  }

  const cursoLabel = item.edital.cursoNivel === "MESTRADO" ? "Mestrado" : "Doutorado";
  const homologacaoVigente = inscricao?.homologacao?.vigente ?? null;
  const reservasConcorrenciaLabel = getReservasConcorrenciaLabel(inscricao?.reservasConcorrencia);
  const publicacaoClassificacaoFinalVigente = item.publicacoes.find((publicacao) => publicacao.tipo === "CLASSIFICACAO_FINAL" && publicacao.isVersaoAtualDoTipo) ?? null;
  const publicacaoClassificacaoPreliminarVigente = item.publicacoes.find((publicacao) => publicacao.tipo === "CLASSIFICACAO_PRELIMINAR" && publicacao.isVersaoAtualDoTipo) ?? null;
  const publicacaoClassificacaoVigente = publicacaoClassificacaoFinalVigente ?? publicacaoClassificacaoPreliminarVigente;

  /* Status cards data */
  const inscricaoHub = inscricao ? resolveHubValue(inscricao.status) : { text: "Sem inscricao", color: "neutral" as HubColor };
  const cards: Array<{ label: string; text: string; color: HubColor; badge?: { text: string } | null }> = [
    { label: "Isencao", ...resolveHubValue(item.isencao?.status ?? "NAO_SOLICITADA") },
    { label: "Inscricao", ...inscricaoHub, badge: inscricao?.status === "RASCUNHO" ? { text: "Rascunho" } : null },
    { label: "Homologacao", ...resolveHubValue(homologacaoVigente?.statusVigente ?? null) },
    { label: "Etapa 1", ...resolveHubValue(inscricao?.etapa1?.status ?? null) },
    { label: "Etapa 2", ...resolveHubValue(inscricao?.etapa2?.status ?? null) },
    { label: "Classificacao", ...resolveHubValue(item.classificacao?.status ?? null) },
    { label: "Recursos", text: (item.recursos?.length ?? 0) === 0 ? "Nenhum" : `${item.recursos.length} interposto(s)`, color: (item.recursos?.length ?? 0) > 0 ? "active" : "neutral" },
    { label: "Publicacoes", text: `${(item.publicacoes?.length ?? 0)} disponiveis`, color: (item.publicacoes?.length ?? 0) > 0 ? "active" : "neutral" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Page header */}
      <div className="hub-header">
        <div className="hub-header-left">
          <h1>{item.edital.numero}</h1>
          <p>{cursoLabel} em Engenharia Eletrica · Acompanhamento do candidato</p>
        </div>
        {item.elegibilidade?.podeEditarInscricao || item.elegibilidade?.podeCancelarSubmissao ? (
          hasInscricao ? (
            <Link href={`/candidato/editais/${item.edital.id}/inscricao`} className="hub-cta">
              {iconPencil}
              <span>{item.elegibilidade?.podeCancelarSubmissao ? "Cancelar submissao para editar" : "Editar inscricao"}</span>
            </Link>
          ) : (
            <Link href={`/candidato/editais/${item.edital.id}/inscricao`} className="hub-cta">
              {iconPencil}
              <span>Nova inscricao</span>
            </Link>
          )
        ) : (
          <span className="hub-cta" style={{ opacity: 0.65, cursor: "default" }} title={item.elegibilidade?.motivoBloqueioInscricao ?? undefined}>
            {iconPencil}
            <span>{item.elegibilidade?.motivoBloqueioInscricao ?? "Inscricao bloqueada"}</span>
          </span>
        )}
      </div>

      {/* Status grid row 1 */}
      <div className="hub-grid">
        {cards.slice(0, 4).map((card) => {
          const cardClass = card.color !== "neutral" && card.color !== "active" ? ` hub-status-card--${card.color}` : "";
          const valueClass = card.color !== "neutral" ? ` hub-status-value--${card.color}` : "";
          return (
            <div key={card.label} className={`hub-status-card${cardClass}`}>
              <span className="hub-status-label">{card.label}</span>
              {card.badge ? (
                <StatusBadge variant={getStatusVariant("RASCUNHO")}>{card.badge.text}</StatusBadge>
              ) : (
                <span className={`hub-status-value${valueClass}`}>{card.text}</span>
              )}
            </div>
          );
        })}
      </div>

      {item.acompanhamento ? (
        <div className="hub-status-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="hub-status-label">Situacao operacional</span>
          <strong style={{ fontSize: 14, color: "#0F172A" }}>{getStatusLabel(item.acompanhamento.faseAtual)}</strong>
          <span className="hub-status-value">{getStatusLabel(item.acompanhamento.situacaoAtual)}</span>
          {item.acompanhamento.etapaBloqueio ? <span style={{ fontSize: 12, color: "#B45309" }}>Etapa de bloqueio/indeferimento: {getStatusLabel(item.acompanhamento.etapaBloqueio)}</span> : null}
          {item.acompanhamento.motivoResumo ? <span style={{ fontSize: 12, color: "#64748B" }}>{item.acompanhamento.motivoResumo}</span> : null}
          {item.acompanhamento.proximoPasso ? <span style={{ fontSize: 12, color: "#2563EB" }}>{item.acompanhamento.proximoPasso}</span> : null}
        </div>
      ) : null}

      {/* Status grid row 2 */}
      <div className="hub-grid">
        {cards.slice(4).map((card) => {
          const cardClass = card.color !== "neutral" && card.color !== "active" ? ` hub-status-card--${card.color}` : "";
          const valueClass = card.color !== "neutral" ? ` hub-status-value--${card.color}` : "";
          return (
            <div key={card.label} className={`hub-status-card${cardClass}`}>
              <span className="hub-status-label">{card.label}</span>
              <span className={`hub-status-value${valueClass}`}>{card.text}</span>
            </div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="hub-links">
        {item.isencao ? (
          <Link href="/candidato/isencoes" className="hub-link">
            {iconShieldCheck} Ver isencao
          </Link>
        ) : item.elegibilidade?.podeCriarIsencao ? (
          <Link href={`/candidato/editais/${item.edital.id}/isencao/nova`} className="hub-link">
            {iconShieldCheck} Solicitar isencao
          </Link>
        ) : (
          <span className="hub-link" style={{ opacity: 0.6 }}>{iconShieldCheck} {item.elegibilidade?.motivoBloqueioIsencao ?? (item.elegibilidade?.janelaIsencaoAberta ? "Isencao indisponivel" : "Janela de isencao encerrada")}</span>
        )}
        {(item.elegibilidade?.podeSolicitarEspelhoEtapa1 || item.elegibilidade?.podeSolicitarEspelhoEtapa2 || item.elegibilidade?.podeVerEspelhoEtapa1 || item.elegibilidade?.podeVerEspelhoEtapa2) ? (
          <Link href={`/candidato/editais/${item.edital.id}/espelhos`} className="hub-link">
            {iconEye} {item.elegibilidade?.podeVerEspelhoEtapa1 || item.elegibilidade?.podeVerEspelhoEtapa2 ? "Ver espelhos" : "Solicitar espelho"}
          </Link>
        ) : (
          <span className="hub-link" style={{ opacity: 0.6 }}>{iconEye} {item.elegibilidade?.motivoBloqueioEspelhoEtapa1 ?? item.elegibilidade?.motivoBloqueioEspelhoEtapa2 ?? "Espelhos indisponiveis"}</span>
        )}
        {(item.elegibilidade?.fasesRecursoElegiveis?.length ?? 0) > 0 ? (
          <Link href={`/candidato/recursos?editalId=${item.edital.id}`} className="hub-link">
            {iconMessageSquare} Interpor recurso
          </Link>
        ) : (
          <span className="hub-link" style={{ opacity: 0.6 }}>{iconMessageSquare} {item.elegibilidade?.motivoBloqueioRecurso ?? "Recurso indisponivel"}</span>
        )}
        <button type="button" onClick={pacoteDocumentalUrl ? handleDownloadPacote : undefined} disabled={!pacoteDocumentalUrl || downloadingPacote} className="hub-link" style={{ background: "none", border: "none", cursor: pacoteDocumentalUrl ? "pointer" : "default", padding: 0, font: "inherit", opacity: pacoteDocumentalUrl ? 1 : 0.5 }}>
          {iconDownload} {pacoteDocumentalUrl ? (downloadingPacote ? "Baixando..." : "Baixar pacote documental") : "Pacote documental indisponivel"}
        </button>
      </div>

      {homologacaoVigente ? (
        <div className="hub-status-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="hub-status-label">Homologacao vigente</span>
          <strong style={{ fontSize: 14, color: "#0F172A" }}>{homologacaoVigente.faseVigente ? `Fase ${homologacaoVigente.faseVigente.toLowerCase()}` : "Sem fase vigente"}</strong>
          <span className="hub-status-value">{homologacaoVigente.statusVigente ? getStatusLabel(homologacaoVigente.statusVigente) : "Pendente"}</span>
          {homologacaoVigente.motivoResumoVigente ? <span style={{ fontSize: 12, color: "#64748B" }}>{homologacaoVigente.motivoResumoVigente}</span> : null}
          {homologacaoVigente.parecerVigente ? <span style={{ fontSize: 12, color: "#334155" }}>{homologacaoVigente.parecerVigente}</span> : null}
        </div>
      ) : null}

      {item.inscricao?.politicasAfirmativas?.itens?.length ? (
        <div className="hub-status-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="hub-status-label">Politicas afirmativas</span>
          {item.inscricao.politicasAfirmativas.itens.map((etapa) => (
            <div key={etapa.id ?? etapa.tipo} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <strong style={{ fontSize: 13, color: "#0F172A" }}>{getPoliticasTipoLabel(etapa.tipo)}</strong>
              <span className="hub-status-value">{getStatusLabel(etapa.resultadoFinal && etapa.resultadoFinal !== "PENDENTE" ? etapa.resultadoFinal : etapa.resultadoPreliminar ?? etapa.statusOperacao)}</span>
              {etapa.parecerFinal || etapa.parecerPreliminar ? <span style={{ fontSize: 12, color: "#64748B" }}>{etapa.parecerFinal ?? etapa.parecerPreliminar}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {item.classificacao ? (
        <div className="hub-status-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="hub-status-label">Classificacao {publicacaoClassificacaoVigente ? "oficial vigente" : "calculada"}</span>
          <strong style={{ fontSize: 14, color: "#0F172A" }}>{getStatusLabel(item.classificacao.status)}</strong>
          <span className="hub-status-value">NF: {item.classificacao.notaFinal != null ? item.classificacao.notaFinal.toFixed(2) : "—"}</span>
          <span style={{ fontSize: 12, color: "#64748B" }}>Posicao geral: {item.classificacao.posicaoGeral ?? "—"} · Posicao na linha: {item.classificacao.posicaoLinha ?? "—"}</span>
          {reservasConcorrenciaLabel ? <span style={{ fontSize: 12, color: "#64748B" }}>Reservas declaradas: {reservasConcorrenciaLabel}</span> : null}
          {item.classificacao.modalidadeConcorrencia ? <span style={{ fontSize: 12, color: "#64748B" }}>Modalidade: {getStatusLabel(item.classificacao.modalidadeConcorrencia)}</span> : null}
          {publicacaoClassificacaoVigente ? <span style={{ fontSize: 12, color: "#2563EB" }}>{getStatusLabel(publicacaoClassificacaoVigente.tipo)} · versao {publicacaoClassificacaoVigente.versao}{publicacaoClassificacaoVigente.republicacaoDaVersao ? ` · republica v${publicacaoClassificacaoVigente.republicacaoDaVersao}` : ""}</span> : <span style={{ fontSize: 12, color: "#B45309" }}>Classificacao ainda nao publicada oficialmente.</span>}
          {publicacaoClassificacaoVigente?.publicadoEm ? <span style={{ fontSize: 12, color: "#2563EB" }}>Publicado em: {formatIsoDate(publicacaoClassificacaoVigente.publicadoEm)}</span> : null}
        </div>
      ) : null}

      {item.publicacoesDestaque.length ? (
        <div className="hub-status-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="hub-status-label">Publicacoes oficiais vigentes</span>
          {item.publicacoesDestaque.slice(0, 4).map((publicacao) => (
            <div key={publicacao.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 13, color: "#0F172A" }}>{publicacao.titulo}</strong>
                <span style={{ fontSize: 12, color: "#64748B" }}>
                  {getStatusLabel(publicacao.tipo)} · Versao {publicacao.versao}
                  {publicacao.republicacaoDaVersao ? ` · republica v${publicacao.republicacaoDaVersao}` : ""}
                  {publicacao.publicadoEm ? ` · ${formatIsoDate(publicacao.publicadoEm)}` : ""}
                </span>
                <span style={{ fontSize: 12, color: "#64748B" }}>{getOrigemArquivoLabel(publicacao.origemArquivo)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href={resolveApiUrl(publicacao.arquivoUrl)} className="hub-link" rel="noreferrer" target="_blank">Abrir PDF</Link>
                <Link href={`/editais/${item.edital.id}/publicacoes`} className="hub-link">Historico</Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {message ? (
        <div style={{ padding: "12px 16px", background: "#FEF2F2", borderRadius: 6, color: "#991B1B", fontSize: 13 }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
