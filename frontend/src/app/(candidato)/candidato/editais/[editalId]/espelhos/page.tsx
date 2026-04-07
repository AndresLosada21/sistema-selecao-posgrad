"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";
import { getEspelhoEtapa1Candidate, getEspelhoEtapa2Candidate, solicitarEspelhoEtapa1, solicitarEspelhoEtapa2 } from "@/modules/espelho/api";
import type { CandidateEtapa1Espelho, CandidateEtapa2Espelho } from "@/modules/espelho/types";

type EspelhosPageProps = {
  params: Promise<{ editalId: string }>;
};

function renderPrimitive(value: unknown) {
  if (value === null || value === undefined) {
    return "nao informado";
  }

  if (typeof value === "object") {
    return "objeto estruturado";
  }

  return String(value);
}

function renderKeyValueObject(title: string, value: Record<string, unknown> | null | undefined) {
  if (!value || !Object.keys(value).length) {
    return null;
  }

  return (
    <div className="content-item">
      <strong>{title}</strong>
      <div className="content-list">
        {Object.entries(value).map(([key, entryValue]) => (
          <small key={key}>{`${key}: ${renderPrimitive(entryValue)}`}</small>
        ))}
      </div>
    </div>
  );
}

function renderRecordArray(title: string, items: Array<Record<string, unknown>> | null | undefined) {
  if (!items?.length) {
    return null;
  }

  return (
    <div className="content-item">
      <strong>{title}</strong>
      <div className="content-list">
        {items.map((item) => (
          <div className="content-item" key={`${title}-${Object.values(item).map(String).join("-")}`}>
            {Object.entries(item).map(([key, value]) => (
              <small key={key}>{`${key}: ${renderPrimitive(value)}`}</small>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderEspelhoEtapa1(espelho: CandidateEtapa1Espelho) {
  return (
    <div className="content-list">
      <small>Tema: {espelho.tema ?? "nao informado"}</small>
      <small>Solicitado em: {formatIsoDate(espelho.espelhoSolicitadoEm ?? null)}</small>
      <small>Liberado em: {formatIsoDate(espelho.espelhoLiberadoEm ?? null)}</small>
      <small>Resultado preliminar em: {formatIsoDate(espelho.resultadoPreliminarEm ?? null)}</small>
      <small>Resultado final em: {formatIsoDate(espelho.resultadoFinalEm ?? null)}</small>
      <div className="content-item">
        <strong>Texto submetido</strong>
        <pre className="preformatted-block">{espelho.textoSubmetido ?? "Nao informado."}</pre>
      </div>
      <div className="content-item">
        <strong>Espelho de correcao</strong>
        <pre className="preformatted-block">{espelho.espelhoCorrecao ?? "Nao informado."}</pre>
      </div>
      {renderKeyValueObject("Rubrica detalhada", espelho.rubricaDetalhada ?? undefined)}
    </div>
  );
}

function renderEspelhoEtapa2(espelho: CandidateEtapa2Espelho) {
  return (
    <div className="content-list">
      <small>Pontuacao bruta: {espelho.pontuacaoBruta ?? "nao informada"}</small>
      <small>Nota normalizada: {espelho.notaNormalizada ?? "nao informada"}</small>
      <small>Solicitado em: {formatIsoDate(espelho.espelhoSolicitadoEm ?? null)}</small>
      <small>Liberado em: {formatIsoDate(espelho.espelhoLiberadoEm ?? null)}</small>
      <small>Resultado preliminar em: {formatIsoDate(espelho.resultadoPreliminarEm ?? null)}</small>
      <small>Resultado final em: {formatIsoDate(espelho.resultadoFinalEm ?? null)}</small>
      {renderKeyValueObject("Pontuacao por item", espelho.pontuacaoItens)}
      {renderRecordArray("Glosas", espelho.glosas)}
      {renderKeyValueObject("Memoria de calculo", espelho.memoriaCalculo ?? undefined)}
      <div className="content-item">
        <strong>Espelho de correcao</strong>
        <pre className="preformatted-block">{espelho.espelhoCorrecao ?? "Nao informado."}</pre>
      </div>
    </div>
  );
}

export default function CandidateEspelhosPage({ params }: EspelhosPageProps) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState<"etapa1-request" | "etapa1-load" | "etapa2-request" | "etapa2-load" | null>(null);
  const [espelhoEtapa1, setEspelhoEtapa1] = useState<CandidateEtapa1Espelho | null>(null);
  const [espelhoEtapa2, setEspelhoEtapa2] = useState<CandidateEtapa2Espelho | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => { if (!cancelled) setEditalId(resolved.editalId); });
    return () => { cancelled = true; };
  }, [params]);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      return;
    }

    const response = await getCandidateDashboard(token);
    setData(response);
  }, [token]);

  useAbortableEffect(async (signal) => {
    if (!token || !editalId) {
      return;
    }

    try {
      await loadDashboard();
      if (signal.aborted) return;
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setMessage({ type: "error", text: getErrorMessage(error) });
      setStatus("error");
    }
  }, [editalId, loadDashboard, signOut, token]);

  const item = useMemo(() => data?.items.find((entry) => entry.edital.id === editalId) ?? null, [data, editalId]);
  const inscricaoId = item?.inscricao?.id ?? null;
  const etapa1 = item?.inscricao?.etapa1 ?? null;
  const etapa2 = item?.inscricao?.etapa2 ?? null;
  const podeSolicitarEtapa1 = Boolean(inscricaoId && etapa1 && ["PRELIMINAR_PUBLICADA", "FINAL_PUBLICADA"].includes(etapa1.status) && !etapa1.espelhoSolicitadoEm);
  const podeSolicitarEtapa2 = Boolean(inscricaoId && etapa2 && ["PRELIMINAR_PUBLICADA", "FINAL_PUBLICADA"].includes(etapa2.status) && !etapa2.espelhoSolicitadoEm);
  const podeVerEtapa1 = Boolean(inscricaoId && etapa1?.espelhoLiberadoEm);
  const podeVerEtapa2 = Boolean(inscricaoId && etapa2?.espelhoLiberadoEm);

  async function handleSolicitarEtapa1() {
    if (!session.token || !inscricaoId) return;
    setBusy("etapa1-request");
    setMessage(null);
      try {
        await solicitarEspelhoEtapa1(inscricaoId, session.token);
        await loadDashboard();
        setMessage({ type: "success", text: "Solicitacao do espelho da etapa 1 registrada." });
      } catch (error) {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage({ type: "error", text: getErrorMessage(error) });
      } finally { setBusy(null); }
  }

  async function handleSolicitarEtapa2() {
    if (!session.token || !inscricaoId) return;
    setBusy("etapa2-request");
    setMessage(null);
      try {
        await solicitarEspelhoEtapa2(inscricaoId, session.token);
        await loadDashboard();
        setMessage({ type: "success", text: "Solicitacao do espelho da etapa 2 registrada." });
      } catch (error) {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage({ type: "error", text: getErrorMessage(error) });
      } finally { setBusy(null); }
  }

  async function handleCarregarEtapa1() {
    if (!session.token || !inscricaoId) return;
    setBusy("etapa1-load");
    setMessage(null);
      try {
        setEspelhoEtapa1(await getEspelhoEtapa1Candidate(inscricaoId, session.token));
      } catch (error) {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage({ type: "error", text: getErrorMessage(error) });
      } finally { setBusy(null); }
  }

  async function handleCarregarEtapa2() {
    if (!session.token || !inscricaoId) return;
    setBusy("etapa2-load");
    setMessage(null);
      try {
        setEspelhoEtapa2(await getEspelhoEtapa2Candidate(inscricaoId, session.token));
      } catch (error) {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage({ type: "error", text: getErrorMessage(error) });
      } finally { setBusy(null); }
  }

  if (status === "loading") return <LoadingState title="Carregando espelhos" description="Consultando o contexto do edital e das etapas avaliativas." />;
  if (status === "error") return <ErrorState title="Falha ao carregar espelhos" description={message?.text} />;
  if (!item || !item.inscricao) {
    return (
      <div className="stack-layout">
        <EmptyState title="Inscricao nao localizada" description="O edital informado nao possui inscricao ativa no contexto autenticado do candidato." />
        <div className="content-item-links">
          <Link className="nav-link" href="/candidato/participacoes">Ver participacoes</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Retorno operacional" description={message.text} /> : null}

      <PageFeedback
        type="info"
        title="Espelhos do edital"
        description="Solicite e consulte os espelhos apenas quando a etapa correspondente estiver em janela e o backend permitir a operacao."
      />

      <SectionCard title={`Espelhos de ${item.edital.numero}`} description={item.edital.titulo}>
        <div className="content-list">
          <small>Inscricao: {getStatusLabel(item.inscricao.status)}</small>
          <small>Etapa 1: {getStatusLabel(etapa1?.status ?? "SEM_RESULTADO")}</small>
          <small>Etapa 2: {getStatusLabel(etapa2?.status ?? "SEM_RESULTADO")}</small>
        </div>
      </SectionCard>

      <SectionCard title="Espelho da etapa 1" description="Redacao, rubrica e texto avaliado quando liberados ao candidato.">
        {etapa1 ? (
          <div className="content-list">
            <div className="content-item-row">
              <small>Status</small>
              <StatusBadge variant={getStatusVariant(etapa1.status)}>{getStatusLabel(etapa1.status)}</StatusBadge>
            </div>
            <small>Solicitado em: {formatIsoDate(etapa1.espelhoSolicitadoEm ?? null)}</small>
            <small>Liberado em: {formatIsoDate(etapa1.espelhoLiberadoEm ?? null)}</small>
            <div className="content-item-links">
              {podeSolicitarEtapa1 ? <ActionButton disabled={busy !== null} onClick={handleSolicitarEtapa1} type="button">Solicitar espelho da etapa 1</ActionButton> : null}
              {podeVerEtapa1 ? <ActionButton disabled={busy !== null} onClick={handleCarregarEtapa1} type="button" variant="secondary">Ver espelho da etapa 1</ActionButton> : null}
            </div>
            {espelhoEtapa1 ? renderEspelhoEtapa1(espelhoEtapa1) : null}
          </div>
        ) : <EmptyState title="Etapa 1 indisponivel" description="Nao ha avaliacao da etapa 1 vinculada a esta inscricao." />}
      </SectionCard>

      <SectionCard title="Espelho da etapa 2" description="Pontuacao, glosas e memoria da avaliacao curricular quando liberadas ao candidato.">
        {etapa2 ? (
          <div className="content-list">
            <div className="content-item-row">
              <small>Status</small>
              <StatusBadge variant={getStatusVariant(etapa2.status)}>{getStatusLabel(etapa2.status)}</StatusBadge>
            </div>
            <small>Solicitado em: {formatIsoDate(etapa2.espelhoSolicitadoEm ?? null)}</small>
            <small>Liberado em: {formatIsoDate(etapa2.espelhoLiberadoEm ?? null)}</small>
            <div className="content-item-links">
              {podeSolicitarEtapa2 ? <ActionButton disabled={busy !== null} onClick={handleSolicitarEtapa2} type="button">Solicitar espelho da etapa 2</ActionButton> : null}
              {podeVerEtapa2 ? <ActionButton disabled={busy !== null} onClick={handleCarregarEtapa2} type="button" variant="secondary">Ver espelho da etapa 2</ActionButton> : null}
            </div>
            {espelhoEtapa2 ? renderEspelhoEtapa2(espelhoEtapa2) : null}
          </div>
        ) : <EmptyState title="Etapa 2 indisponivel" description="Nao ha avaliacao da etapa 2 vinculada a esta inscricao." />}
      </SectionCard>
    </div>
  );
}
