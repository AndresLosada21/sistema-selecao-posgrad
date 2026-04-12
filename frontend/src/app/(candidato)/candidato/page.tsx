"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActionButton } from "@/components/shared/action-button";
import { getStatusVariant, getStatusLabel } from "@/components/shared/status-variant-map";
import { resolveApiUrl } from "@/lib/config/api";
import { useSession } from "@/lib/auth/session-provider";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";

/* ---- helpers ---- */

const PENDING_STATUSES = new Set([
  "SEM_RESULTADO", "SEM_PEDIDO", "SEM_INSCRICAO", "SEM_CLASSIFICACAO",
  "PENDENTE", "",
]);

const ACTIVE_STATUSES = new Set([
  "RASCUNHO", "SOLICITADA", "EM_ANALISE", "EM_ANALISE_DOCUMENTAL", "EM_AVALIACAO",
]);

const ERROR_STATUSES = new Set([
  "ELIMINADA", "ELIMINADO", "INDEFERIDA", "INDEFERIDA_PRELIMINAR", "INDEFERIDA_FINAL",
  "NAO_HOMOLOGADA_PRELIMINAR", "NAO_HOMOLOGADA_FINAL", "NAO_CONFIRMADA",
]);

type StepVariant = "done" | "active" | "pending" | "error";

function resolveStepVariant(status: string | null | undefined): StepVariant {
  const s = status ?? "";
  if (!s || PENDING_STATUSES.has(s)) return "pending";
  if (ERROR_STATUSES.has(s)) return "error";
  if (ACTIVE_STATUSES.has(s)) return "active";
  return "done";
}

const STEP_STYLES: Record<StepVariant, { iconColor: string; textClass: string }> = {
  done:    { iconColor: "#22C55E", textClass: "dash-step-text dash-step-text--done" },
  active:  { iconColor: "#F59E0B", textClass: "dash-step-text dash-step-text--active" },
  error:   { iconColor: "#EF4444", textClass: "dash-step-text dash-step-text--error" },
  pending: { iconColor: "#94A3B8", textClass: "dash-step-text dash-step-text--pending" },
};

function resolveStepLabel(status: string | null | undefined): string {
  if (status === "SEM_INSCRICAO") return "Sem inscricao";
  if (status === "SEM_RESULTADO") return "Sem resultado";
  if (status === "SEM_CLASSIFICACAO") return "Sem classificacao";
  if (status === "SEM_PEDIDO") return "Sem pedido";
  if (!status || status.startsWith("SEM_") || PENDING_STATUSES.has(status)) return "Pendente";
  if (status === "NAO_SOLICITADA") return "Nao solicitada";
  return getStatusLabel(status);
}

/* ---- SVG icons (Pencil-aligned) ---- */

const iconPlus = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
);
const iconCircleMinus = (color: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>
);
const iconCircleCheck = (color: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
);
const iconCircleX = (color: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>
);
const iconLoader = (color: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" /><path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" /><path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" /></svg>
);
const iconPencil = (color: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z" /></svg>
);
const iconFileText = (color: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" /></svg>
);
const iconMessageSquare = (color: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const iconEye = (color: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></svg>
);
const iconShieldCheck = (color: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
);
const iconChevronRight = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
);
const iconDownloadTrailing = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
);
const iconMegaphone = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 13v-2z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
);
const iconFileTextSm = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
);

/* ---- page ---- */

export default function CandidateDashboardPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  useAbortableEffect(async (signal) => {
    if (!token) return;
    setStatus("loading");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signOut, token, fetchKey]);

  useEffect(() => {
    if (!data?.items.length) { setSelectedParticipacaoId(null); return; }
    setSelectedParticipacaoId((current) => {
      if (current && data.items.some((item) => item.id === current)) return current;
      return data.items[0]?.id ?? null;
    });
  }, [data]);

  const active = useMemo(() => {
    if (!data?.items.length) return null;
    return data.items.find((item) => item.id === selectedParticipacaoId) ?? data.items[0] ?? null;
  }, [data, selectedParticipacaoId]);

  if (status === "loading") return <LoadingState title="Carregando painel" description="Consultando area consolidada do candidato..." />;
  if (status === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ErrorState title="Falha ao carregar painel" description={message ?? undefined} />
        <ActionButton onClick={() => { setMessage(null); setFetchKey((k) => k + 1); }} type="button" variant="secondary">Tentar novamente</ActionButton>
      </div>
    );
  }
  if (!data?.items.length) {
    const contaAdministrativaSemPerfilCandidato = session.hasRole("ADMIN") && !session.hasRole("CANDIDATO");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <EmptyState title="Nenhuma participacao encontrada" description="Ainda nao ha participacoes vinculadas a esta conta." />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "16px 18px", borderRadius: 10, background: "#EFF6FF", color: "#1E3A8A" }}>
          {contaAdministrativaSemPerfilCandidato ? <strong>Esta conta esta autenticada com perfil administrativo, mas o fluxo do candidato continua disponivel pelos editais publicos.</strong> : null}
          <span>Para iniciar, abra um edital publicado e clique em <strong>Entrar neste edital</strong>. Depois disso, os CTAs de inscricao e isencao aparecem no acompanhamento.</span>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/editais" className="dash-greeting-cta">
            {iconPlus}
            <span>Escolher edital e entrar</span>
          </Link>
          <Link href="/candidato/participacoes" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 999, border: "1px solid #CBD5E1", color: "#0F172A", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            Ver participacoes
          </Link>
        </div>
      </div>
    );
  }

  const inscricao = active?.inscricao ?? null;
  const hasInscricao = !!inscricao;

  const steps = [
    { label: "Isencao", status: active?.isencao?.status ?? "NAO_SOLICITADA" },
    { label: "Inscricao", status: inscricao?.status ?? "SEM_INSCRICAO" },
    { label: "Homologacao", status: inscricao?.homologacao?.vigente?.statusVigente ?? inscricao?.homologacao?.statusFinal ?? inscricao?.homologacao?.statusPreliminar ?? null },
    { label: "Etapa 1", status: inscricao?.etapa1?.status ?? null },
    { label: "Etapa 2", status: inscricao?.etapa2?.status ?? null },
  ];

  const pubs = active?.publicacoesDestaque ?? [];
  const anexoIvUrl = active?.inscricao?.anexoIvDisponivel ? (active.inscricao.anexoIvGeradoUrl ?? null) : null;

  const editalLabel = active
    ? `${active.edital.numero} — ${active.edital.cursoNivel === "MESTRADO" ? "Mestrado" : "Doutorado"} em Engenharia Eletrica`
    : "";

  const acompanhamento = active?.acompanhamento;
  const phaseLabel = acompanhamento?.faseAtual ? getStatusLabel(acompanhamento.faseAtual) : getStatusLabel(active?.edital.status ?? "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Multi-edital selector */}
      {data.items.length > 1 ? (
        <select
          value={active?.id ?? ""}
          onChange={(e) => setSelectedParticipacaoId(e.target.value)}
          style={{ alignSelf: "flex-start", padding: "8px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }}
        >
          {data.items.map((item) => (
            <option key={item.id} value={item.id}>{item.edital.numero} - {item.edital.titulo}</option>
          ))}
        </select>
      ) : null}

      {/* Greeting */}
      <div className="dash-greeting">
        <div>
          <h2>Ola, {session.user?.nomeCompleto?.split(" ")[0] ?? "Candidato"}</h2>
          <p>Acompanhe suas participacoes nos processos seletivos do PPGEE/UFAM.</p>
        </div>
        {active?.elegibilidade?.podeEditarInscricao || active?.elegibilidade?.podeCancelarSubmissao ? (
          <Link href={`/candidato/editais/${active.edital.id}/inscricao`} className="dash-greeting-cta">
            {iconPlus}
            <span>{active?.elegibilidade?.podeCancelarSubmissao ? "Cancelar submissao para editar" : hasInscricao ? "Editar inscricao" : "Nova inscricao"}</span>
          </Link>
        ) : active ? (
          <span className="dash-greeting-cta" style={{ opacity: 0.65, cursor: "default" }} title={active.elegibilidade?.motivoBloqueioInscricao ?? undefined}>
            {iconPlus}
            <span>{active.elegibilidade?.motivoBloqueioInscricao ?? "Inscricao bloqueada"}</span>
          </span>
        ) : null}
      </div>

      {/* Edital card with steps */}
      {active ? (
        <div className="dash-edital-card">
          <div className="dash-edital-card-hdr">
            <span className="dash-edital-card-title">{editalLabel}</span>
            <StatusBadge variant={getStatusVariant(active.edital.status === "EM_ANDAMENTO" ? "EM_ANDAMENTO" : active.edital.status)}>
              {phaseLabel}
            </StatusBadge>
          </div>
          <div className="dash-edital-card-divider" />
          <div className="dash-steps-row">
            {steps.map((step, i) => {
              const variant = resolveStepVariant(step.status);
              const { iconColor, textClass } = STEP_STYLES[variant];
              const label = `${step.label}: ${resolveStepLabel(step.status)}`;
              const icon = variant === "done" ? iconCircleCheck(iconColor)
                : variant === "active" ? iconLoader(iconColor)
                : variant === "error" ? iconCircleX(iconColor)
                : iconCircleMinus(iconColor);
              return (
                <span key={step.label} style={{ display: "contents" }}>
                  {i > 0 ? <span className="dash-step-divider" /> : null}
                  <span className="dash-step">
                    {icon}
                    <span className={textClass}>{label}</span>
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {acompanhamento ? (
        <div className="dash-pub-card">
          <div className="dash-pub-hdr">
            <span className="dash-pub-hdr-title">Situacao atual</span>
          </div>
          <div className="dash-pub-divider" />
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 6 }}>
            <strong style={{ fontSize: 14, color: "#0F172A" }}>{getStatusLabel(acompanhamento.faseAtual)}</strong>
            <span style={{ fontSize: 13, color: "#334155" }}>{getStatusLabel(acompanhamento.situacaoAtual)}</span>
            {acompanhamento.etapaBloqueio ? <span style={{ fontSize: 12, color: "#B45309" }}>Etapa de bloqueio/indeferimento: {getStatusLabel(acompanhamento.etapaBloqueio)}</span> : null}
            {acompanhamento.motivoResumo ? <span style={{ fontSize: 12, color: "#64748B" }}>{acompanhamento.motivoResumo}</span> : null}
            {acompanhamento.proximoPasso ? <span style={{ fontSize: 12, color: "#2563EB" }}>{acompanhamento.proximoPasso}</span> : null}
          </div>
        </div>
      ) : null}

      {/* Quick actions */}
      <h3 className="dash-section-title">Acoes rapidas</h3>
      {active ? (
        <div className="dash-qa-row">
          {active.elegibilidade?.podeEditarInscricao || active.elegibilidade?.podeCancelarSubmissao ? (
            <Link href={`/candidato/editais/${active.edital.id}/inscricao`} className="dash-qa-card">
              <div className="dash-qa-icon dash-qa-icon--blue">{iconPencil("#2563EB")}</div>
              <div className="dash-qa-text">
                <strong>{active.elegibilidade?.podeCancelarSubmissao ? "Cancelar submissao para editar" : hasInscricao ? "Editar inscricao" : "Iniciar inscricao"}</strong>
                <span>{active.elegibilidade?.podeCancelarSubmissao ? "A inscricao foi enviada. Cancele a submissao durante a janela para voltar ao rascunho." : "Continuar rascunho ou revisar dados"}</span>
              </div>
              {iconChevronRight}
            </Link>
          ) : (
            <div className="dash-qa-card" style={{ opacity: 0.7 }}>
              <div className="dash-qa-icon dash-qa-icon--blue">{iconPencil("#2563EB")}</div>
              <div className="dash-qa-text">
                <strong>Edicao indisponivel</strong>
                <span>{active.elegibilidade?.motivoBloqueioInscricao ?? (active.elegibilidade?.janelaInscricaoAberta ? "A inscricao atual nao pode mais ser editada neste status." : "A janela de inscricao deste edital esta encerrada.")}</span>
              </div>
            </div>
          )}
          {active.isencao ? (
            <Link href="/candidato/isencoes" className="dash-qa-card">
              <div className="dash-qa-icon dash-qa-icon--emerald">{iconShieldCheck("#10B981")}</div>
              <div className="dash-qa-text">
                <strong>Ver isencao</strong>
                <span>Consultar status do pedido</span>
              </div>
              {iconChevronRight}
            </Link>
          ) : active.elegibilidade?.podeCriarIsencao ? (
            <Link href={`/candidato/editais/${active.edital.id}/isencao/nova`} className="dash-qa-card">
              <div className="dash-qa-icon dash-qa-icon--emerald">{iconShieldCheck("#10B981")}</div>
              <div className="dash-qa-text">
                <strong>Solicitar isencao</strong>
                <span>Registrar pedido de isencao</span>
              </div>
              {iconChevronRight}
            </Link>
          ) : (
            <div className="dash-qa-card" style={{ opacity: 0.7 }}>
              <div className="dash-qa-icon dash-qa-icon--emerald">{iconShieldCheck("#10B981")}</div>
              <div className="dash-qa-text">
                <strong>Isencao indisponivel</strong>
                <span>{active.elegibilidade?.motivoBloqueioIsencao ?? "Nao ha acao de isencao disponivel para este edital."}</span>
              </div>
            </div>
          )}
          <button
            type="button"
            className="dash-qa-card"
            style={{ background: "none", border: "none", textAlign: "left", cursor: anexoIvUrl && token ? "pointer" : "default", opacity: anexoIvUrl && token ? 1 : 0.6 }}
            onClick={() => { if (anexoIvUrl && token) { void downloadAuthenticatedFile(anexoIvUrl, token, "anexo-iv.pdf"); } }}
            disabled={!anexoIvUrl || !token}
          >
            <div className="dash-qa-icon dash-qa-icon--blue">{iconFileText("#3B82F6")}</div>
            <div className="dash-qa-text">
              <strong>{anexoIvUrl ? "Baixar Anexo IV" : "Anexo IV indisponivel"}</strong>
              <span>{anexoIvUrl ? "Ficha cadastral preenchida (PDF)" : "Preencha e salve a inscricao para gerar o Anexo IV."}</span>
            </div>
            {anexoIvUrl ? iconDownloadTrailing : null}
          </button>
          {(active.elegibilidade?.podeSolicitarEspelhoEtapa1 || active.elegibilidade?.podeSolicitarEspelhoEtapa2 || active.elegibilidade?.podeVerEspelhoEtapa1 || active.elegibilidade?.podeVerEspelhoEtapa2) ? (
            <Link href={`/candidato/editais/${active.edital.id}/espelhos`} className="dash-qa-card">
              <div className="dash-qa-icon dash-qa-icon--violet">{iconEye("#8B5CF6")}</div>
              <div className="dash-qa-text">
                <strong>Espelhos</strong>
                <span>{active.elegibilidade?.podeVerEspelhoEtapa1 || active.elegibilidade?.podeVerEspelhoEtapa2 ? "Consultar espelhos liberados" : "Solicitar espelho das etapas preliminares"}</span>
              </div>
              {iconChevronRight}
            </Link>
          ) : (
            <div className="dash-qa-card" style={{ opacity: 0.7 }}>
              <div className="dash-qa-icon dash-qa-icon--violet">{iconEye("#8B5CF6")}</div>
              <div className="dash-qa-text">
                <strong>Espelhos indisponiveis</strong>
                <span>{active.elegibilidade?.motivoBloqueioEspelhoEtapa1 ?? active.elegibilidade?.motivoBloqueioEspelhoEtapa2 ?? "Nenhum espelho pode ser solicitado ou visualizado no momento."}</span>
              </div>
            </div>
          )}
          {active.elegibilidade?.fasesRecursoElegiveis?.length ? (
            <Link href={`/candidato/recursos?editalId=${active.edital.id}`} className="dash-qa-card">
              <div className="dash-qa-icon dash-qa-icon--amber">{iconMessageSquare("#F59E0B")}</div>
              <div className="dash-qa-text">
                <strong>Recursos</strong>
                <span>Fases disponiveis: {active.elegibilidade.fasesRecursoElegiveis.map((fase) => getStatusLabel(fase)).join(", ")}</span>
              </div>
              {iconChevronRight}
            </Link>
          ) : (
            <div className="dash-qa-card" style={{ opacity: 0.7 }}>
              <div className="dash-qa-icon dash-qa-icon--amber">{iconMessageSquare("#F59E0B")}</div>
              <div className="dash-qa-text">
                <strong>Recursos indisponiveis</strong>
                <span>{active.elegibilidade?.motivoBloqueioRecurso ?? "Nenhuma fase esta elegivel para recurso no momento."}</span>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Publications */}
      <div className="dash-pub-card">
        <div className="dash-pub-hdr">
          {iconMegaphone}
          <span className="dash-pub-hdr-title">Publicacoes em destaque</span>
          {active ? (
            <Link href={`/candidato/editais/${active.edital.id}`} className="dash-pub-hdr-link">Ver todas</Link>
          ) : null}
        </div>
        <div className="dash-pub-divider" />
        {pubs.length > 0 ? pubs.map((pub, i) => (
          <span key={pub.id} style={{ display: "contents" }}>
            {i > 0 ? <div className="dash-pub-divider" /> : null}
            <div className="dash-pub-row">
              <div className="dash-pub-row-text">
                <span className="dash-pub-row-title">{pub.titulo}</span>
                <span className="dash-pub-row-meta">{formatIsoDate(pub.publicadoEm ?? null)} · Versao {pub.versao}{pub.isVersaoAtualDoTipo ? " · vigente" : ""}{pub.versaoFinal ? " · final" : ""}{pub.republicacaoDaVersao ? ` · republica v${pub.republicacaoDaVersao}` : ""}</span>
              </div>
              <Link href={resolveApiUrl(pub.arquivoUrl)} target="_blank" rel="noreferrer" className="dash-pdf-badge">
                {iconFileTextSm}
                PDF
              </Link>
            </div>
          </span>
        )) : (
          <div style={{ padding: "24px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            Nenhuma publicacao oficial disponivel para este edital.
          </div>
        )}
      </div>
    </div>
  );
}
