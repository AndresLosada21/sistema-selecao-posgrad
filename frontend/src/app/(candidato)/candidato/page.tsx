"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SummaryGrid } from "@/components/shared/summary-grid";
import { PageFeedback } from "@/components/shared/page-feedback";
import { ActionButton, getActionButtonClassName } from "@/components/shared/action-button";
import { getStatusVariant, getStatusLabel } from "@/components/shared/status-variant-map";
import { resolveApiUrl } from "@/lib/config/api";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";

/* ---- helpers ---- */

type StepVariant = "done" | "active" | "pending" | "error";

const PENDING_STATUSES = new Set([
  "SEM_RESULTADO", "SEM_PEDIDO", "SEM_INSCRICAO", "SEM_CLASSIFICACAO",
  "PENDENTE", "NAO_SOLICITADA", "",
]);

const ACTIVE_STATUSES = new Set([
  "RASCUNHO", "SOLICITADA", "EM_ANALISE", "EM_ANALISE_DOCUMENTAL", "EM_AVALIACAO",
]);

const ERROR_STATUSES = new Set([
  "ELIMINADA", "ELIMINADA_ETAPA_1", "ELIMINADO",
  "NAO_HOMOLOGADA_PRELIMINAR", "NAO_HOMOLOGADA_FINAL",
  "INDEFERIDA", "INDEFERIDA_PRELIMINAR", "INDEFERIDA_FINAL",
  "NAO_CONFIRMADA",
]);

function resolveStepVariant(status: string | null | undefined): StepVariant {
  const s = status ?? "";
  if (!s || PENDING_STATUSES.has(s)) return "pending";
  if (ERROR_STATUSES.has(s)) return "error";
  if (ACTIVE_STATUSES.has(s)) return "active";
  return "done";
}

function resolveStepLabel(status: string | null | undefined): string {
  if (!status || status.startsWith("SEM_") || PENDING_STATUSES.has(status)) return "Pendente";
  return getStatusLabel(status);
}

const STEP_COLORS: Record<StepVariant, string> = {
  done: "var(--color-success)",
  active: "var(--color-warning)",
  error: "var(--color-error)",
  pending: "var(--color-text-disabled)",
};

function StepIcon({ variant }: { variant: StepVariant }) {
  const color = STEP_COLORS[variant];
  const weight = variant === "done" || variant === "error" ? "2.5" : "2";

  if (variant === "done") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
        <title>Etapa concluida</title>
        <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (variant === "error") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
        <title>Etapa com impedimento</title>
        <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
      </svg>
    );
  }
  if (variant === "active") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
        <title>Etapa em andamento</title>
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
      <title>Etapa pendente</title>
      <circle cx="12" cy="12" r="10" /><path d="M8 12h8" />
    </svg>
  );
}

function QuickAction({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={href} className="dashboard-quick-action">
      <div className="dashboard-quick-action-left">
        <div className="dashboard-quick-action-icon">{icon}</div>
        <div>
          <div className="dashboard-quick-action-title">{title}</div>
          <div className="dashboard-quick-action-subtitle">{subtitle}</div>
        </div>
      </div>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-border-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
    </Link>
  );
}

const iconPen = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-navy-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z" /></svg>;
const iconFile = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-navy-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;
const iconDownload = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-navy-700)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;
const iconPlus = <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
const iconDownloadSm = <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;

/* ---- page ---- */

export default function CandidateDashboardPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedParticipacaoId, setSelectedParticipacaoId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getCandidateDashboard(token)
      .then((response) => { setData(response); setStatus("ready"); })
      .catch((error) => {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [signOut, token]);

  function retryDashboard() {
    setStatus("loading");
    setMessage(null);
  }

  useEffect(() => {
    if (!data?.items.length) {
      setSelectedParticipacaoId(null);
      return;
    }

    setSelectedParticipacaoId((current) => {
      if (current && data.items.some((item) => item.id === current)) {
        return current;
      }

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
      <div className="stack-layout">
        <ErrorState title="Falha ao carregar painel" description={message ?? undefined} />
        <div className="content-item-links">
          <ActionButton onClick={retryDashboard} type="button" variant="secondary">Tentar novamente</ActionButton>
        </div>
      </div>
    );
  }
  if (!data?.items.length) return <EmptyState title="Nenhuma participacao encontrada" description="Ainda nao ha participacoes vinculadas a esta conta." />;

  const inscricao = active?.inscricao ?? null;
  const hasInscricao = !!inscricao;

  const steps = [
    { label: "Isencao", status: active?.isencao?.status ?? null },
    { label: "Inscricao", status: inscricao?.status ?? null },
    { label: "Homologacao", status: inscricao?.homologacao?.statusFinal ?? null },
    { label: "Etapa 1", status: inscricao?.etapa1?.status ?? null },
    { label: "Etapa 2", status: inscricao?.etapa2?.status ?? null },
    { label: "Classificacao", status: active?.classificacao?.status ?? null },
  ];

  const activeStep = [...steps].reverse().find((s) => resolveStepVariant(s.status) === "active");
  const currentPhaseLabel = activeStep ? activeStep.label : "Aguardando";
  const currentPhaseColor = activeStep ? "var(--color-warning)" : "var(--color-text-muted)";

  const pubs = active?.publicacoesDestaque ?? [];
  const hasOpenRecurso = (active?.recursos ?? []).some((r) => r.status === "ABERTO");
  const pacoteDocumentalUrl = inscricao?.pacoteDocumental?.urlArquivo ?? null;

  const etapa1 = inscricao?.etapa1 ?? null;
  const etapa2 = inscricao?.etapa2 ?? null;
  const espelhoEtapa1Disponivel = Boolean(etapa1 && ["PRELIMINAR_PUBLICADA", "FINAL_PUBLICADA"].includes(etapa1.status));
  const espelhoEtapa2Disponivel = Boolean(etapa2 && ["PRELIMINAR_PUBLICADA", "FINAL_PUBLICADA"].includes(etapa2.status));
  const espelhoDisponivel = espelhoEtapa1Disponivel || espelhoEtapa2Disponivel;
  const espelhoEtapaLabel = espelhoEtapa1Disponivel ? "Etapa 1 — Redacao" : "Etapa 2 — Titulos";

  return (
    <div className="stack-layout">

      {/* ---- Greeting ---- */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "var(--space-7)" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "var(--font-size-h1)", fontWeight: 800, color: "var(--color-text-primary)" }}>
            Ola, {session.user?.nomeCompleto?.split(" ")[0] ?? "Candidato"}
          </h2>
          <p style={{ margin: "var(--space-1) 0 0", color: "var(--color-text-muted)", fontSize: "var(--font-size-base)" }}>
            Acompanhe suas participacoes nos processos seletivos do PPGEE/UFAM.
          </p>
        </div>
        {active ? (
          <Link href={`/candidato/editais/${active.edital.id}/inscricao`} className={getActionButtonClassName("primary", "md")}>
            <span className="action-btn-icon">{iconPlus}</span>
            <span>{hasInscricao ? "Editar inscricao" : "Nova inscricao"}</span>
          </Link>
        ) : null}
      </div>

      {data.items.length > 1 ? (
        <SectionCard title="Participacao em foco" description="Selecione o edital que deseja acompanhar em detalhes no painel.">
          <label className="form-field" htmlFor="participacao-em-foco">
            <span className="form-field-label">Edital selecionado</span>
            <select
              id="participacao-em-foco"
              value={active?.id ?? ""}
              onChange={(event) => setSelectedParticipacaoId(event.target.value)}
            >
              {data.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.edital.numero} - {item.edital.titulo}
                </option>
              ))}
            </select>
          </label>
        </SectionCard>
      ) : null}

      {/* ---- Summary cards ---- */}
      <SummaryGrid items={[
        { label: "Participacoes ativas", value: data.total },
        { label: "Inscricao atual", value: inscricao ? getStatusLabel(inscricao.status) : "Sem inscricao", color: inscricao ? STEP_COLORS[resolveStepVariant(inscricao.status)] : undefined },
        { label: "Fase atual", value: currentPhaseLabel, color: currentPhaseColor },
        { label: "Documentos", value: inscricao?.documentos.length ?? 0 },
      ]} />

      {/* ---- Progress card ---- */}
      {active ? (
        <div className="dashboard-progress-card">
          <div className="dashboard-progress-header">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
              <div style={{ width: 10, height: 10, borderRadius: "var(--radius-full)", background: active.edital.status === "EM_ANDAMENTO" ? "var(--color-success)" : "var(--color-border-strong)" }} />
              <strong style={{ fontSize: "var(--font-size-lg)", color: "var(--color-text-primary)" }}>
                {active.edital.numero} — {active.edital.cursoNivel === "MESTRADO" ? "Mestrado" : "Doutorado"} em Engenharia Eletrica
              </strong>
            </div>
            <StatusBadge variant={getStatusVariant(active.edital.status)}>{getStatusLabel(active.edital.status)}</StatusBadge>
          </div>
          <div className="dashboard-progress-steps">
            {steps.map((step, index) => {
              const v = resolveStepVariant(step.status);
              const isLast = index === steps.length - 1;
              return (
                <div key={step.label} className={`dashboard-progress-step ${v === "active" ? "dashboard-progress-step--active" : v === "error" ? "dashboard-progress-step--error" : ""}`} style={{ borderRight: isLast ? "none" : undefined }}>
                  <span className="dashboard-progress-step-label" style={{ color: STEP_COLORS[v] }}>{step.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <StepIcon variant={v} />
                    <span className="dashboard-progress-step-value" style={{ color: STEP_COLORS[v] }}>{resolveStepLabel(step.status)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ---- Alerts ---- */}
      {espelhoDisponivel && active ? (
        <PageFeedback
          type="info"
          title={`Espelho disponivel — ${espelhoEtapaLabel}`}
          description="O resultado da etapa ja permite acompanhamento do espelho. Use a tela de espelhos para solicitar ou consultar a liberacao antes de abrir recurso."
          action={
            <Link href={`/candidato/editais/${active.edital.id}/espelhos`} className={getActionButtonClassName("primary", "sm")}>
              Gerenciar espelhos
            </Link>
          }
        />
      ) : null}
      {hasOpenRecurso ? (
        <PageFeedback type="warning" title="Recurso em andamento" description="Voce tem um recurso aberto. Acompanhe o status na pagina de acompanhamento do edital." />
      ) : null}

      {/* ---- Bottom: Publicacoes + Sidebar ---- */}
      <div className="dashboard-bottom">
        {/* Publicacoes */}
        <div className="dashboard-bottom-main">
          <SectionCard title="Publicacoes oficiais">
            {pubs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {pubs.map((pub) => (
                  <div key={pub.id} className="dashboard-pub-row">
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "var(--font-size-base)", color: "var(--color-text-primary)" }}>{pub.titulo}</strong>
                        <StatusBadge variant="neutral" shape="tag">v{pub.versao}</StatusBadge>
                      </div>
                      <small style={{ color: "var(--color-text-muted)" }}>Publicado em {formatIsoDate(pub.publicadoEm ?? null)}</small>
                    </div>
                    <Link href={resolveApiUrl(pub.arquivoUrl)} target="_blank" className={getActionButtonClassName("secondary", "sm")}>
                      <span className="action-btn-icon">{iconDownloadSm}</span>
                      <span>PDF</span>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem publicacoes" description="Nenhuma publicacao oficial disponivel para este edital." />
            )}
          </SectionCard>
        </div>

        {/* Sidebar */}
        <div className="dashboard-bottom-side">
          <SectionCard title="Acoes rapidas">
            {active ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <QuickAction href={`/candidato/editais/${active.edital.id}/inscricao`} icon={iconPen} title={hasInscricao ? "Editar inscricao" : "Iniciar inscricao"} subtitle={`Edital ${active.edital.numero}`} />
                <QuickAction href={`/candidato/editais/${active.edital.id}/inscricao`} icon={iconFile} title="Gerenciar Anexo IV" subtitle="Download disponivel na tela da inscricao" />
                <QuickAction href={`/candidato/editais/${active.edital.id}`} icon={iconDownload} title={pacoteDocumentalUrl ? "Pacote documental" : "Abrir acompanhamento"} subtitle={pacoteDocumentalUrl ? "Baixe pela tela do edital com sessao autenticada" : "Ver artefatos do edital"} />
                <QuickAction href={`/candidato/recursos?editalId=${active.edital.id}`} icon={iconFile} title="Abrir recursos" subtitle="Criar e acompanhar recursos do edital" />
              </div>
            ) : null}
          </SectionCard>

          {inscricao ? (
            <SectionCard title="Resumo da inscricao">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Linha de pesquisa</span>
                  <span className="dashboard-summary-value">{inscricao.linhaPesquisa?.nome ?? "Nao definida"}</span>
                </div>
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Pagamento</span>
                  <StatusBadge variant={getStatusVariant(inscricao.statusPagamento)} shape="tag">{getStatusLabel(inscricao.statusPagamento)}</StatusBadge>
                </div>
                <div className="dashboard-summary-row">
                  <span className="dashboard-summary-label">Documentos</span>
                  <span className="dashboard-summary-value">{inscricao.documentos.length} anexos</span>
                </div>
                <div className="dashboard-summary-row" style={{ borderBottom: "none" }}>
                  <span className="dashboard-summary-label">Recursos</span>
                  <span className="dashboard-summary-value">{active?.recursos.length ?? 0} interpostos</span>
                </div>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
