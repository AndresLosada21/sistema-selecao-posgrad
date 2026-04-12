"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { FileField } from "@/components/shared/file-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, getFirstFormError, pickFirstFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { uploadPrivateFile } from "@/modules/upload/api";
import { getPoliticasByInscricao, registrarEncaminhamentoPoliticas, registrarResultadoFinalPoliticas, registrarResultadoPreliminarPoliticas } from "@/modules/admin-politicas/api";
import type { PoliticasEtapaItem, PoliticasInscricaoDetail } from "@/modules/admin-politicas/types";
import { resultadoPoliticasOptions } from "@/modules/admin-operacao/constants";

type Props = { params: Promise<{ inscricaoId: string }> };

type EncaminhamentoState = {
  convocadoEm: string;
  documentosEncaminhadosEm: string;
  protocoloEncaminhamento: string;
  observacaoEncaminhamento: string;
};

type ResultadoState = {
  resultado: (typeof resultadoPoliticasOptions)[number];
  parecer: string;
  arquivoRetornoUrl: string;
};

function getTipoLabel(tipo: string) {
  return tipo === "PCD" ? "Analise PCD" : "Heteroidentificacao";
}

function getReservasResumo(detail: PoliticasInscricaoDetail | null) {
  if (!detail?.inscricao.reservasConcorrencia) {
    return "Ampla concorrencia";
  }

  const labels: string[] = [];

  if (detail.inscricao.reservasConcorrencia.acoesAfirmativas) {
    labels.push("Acoes afirmativas");
  }

  if (detail.inscricao.reservasConcorrencia.pcd) {
    labels.push("PCD");
  }

  return labels.length ? labels.join(" + ") : "Ampla concorrencia";
}

function buildEncaminhamentoState(etapa: PoliticasEtapaItem): EncaminhamentoState {
  return {
    convocadoEm: etapa.convocadoEm ?? "",
    documentosEncaminhadosEm: etapa.documentosEncaminhadosEm ?? "",
    protocoloEncaminhamento: etapa.protocoloEncaminhamento ?? "",
    observacaoEncaminhamento: etapa.observacaoEncaminhamento ?? "",
  };
}

function buildResultadoState(etapa: PoliticasEtapaItem, fase: "preliminar" | "final"): ResultadoState {
  return fase === "preliminar"
    ? {
        resultado: (etapa.resultadoPreliminar as (typeof resultadoPoliticasOptions)[number]) ?? resultadoPoliticasOptions[0],
        parecer: etapa.parecerPreliminar ?? "",
        arquivoRetornoUrl: etapa.arquivoRetornoPreliminarUrl ?? "",
      }
    : {
        resultado: (etapa.resultadoFinal as (typeof resultadoPoliticasOptions)[number]) ?? resultadoPoliticasOptions[0],
        parecer: etapa.parecerFinal ?? "",
        arquivoRetornoUrl: etapa.arquivoRetornoFinalUrl ?? "",
      };
}

export default function AdminPoliticasDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const searchParams = useSearchParams();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PoliticasInscricaoDetail | null>(null);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editalId, setEditalId] = useState("");
  const [busyDownloadId, setBusyDownloadId] = useState<string | null>(null);
  const [encaminhamento, setEncaminhamento] = useState<Record<string, EncaminhamentoState>>({});
  const [preliminar, setPreliminar] = useState<Record<string, ResultadoState>>({});
  const [finalResult, setFinalResult] = useState<Record<string, ResultadoState>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => {
      if (!cancelled) {
        setInscricaoId(resolved.inscricaoId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    const queryEditalId = searchParams?.get("editalId");
    if (queryEditalId) {
      setEditalId(queryEditalId);
    }
  }, [searchParams]);

  const loadItem = useCallback(async () => {
    if (!token || !inscricaoId) return;
    const found = await getPoliticasByInscricao(inscricaoId, token);
    setDetail(found);
    setEditalId((current) => current || found.edital.id);
    setEncaminhamento(Object.fromEntries(found.etapas.map((etapa) => [etapa.tipo, buildEncaminhamentoState(etapa)])));
    setPreliminar(Object.fromEntries(found.etapas.map((etapa) => [etapa.tipo, buildResultadoState(etapa, "preliminar")])));
    setFinalResult(Object.fromEntries(found.etapas.map((etapa) => [etapa.tipo, buildResultadoState(etapa, "final")])));
  }, [inscricaoId, token]);

  useAbortableEffect(async (signal) => {
    if (!inscricaoId || !token) return;
    try {
      await loadItem();
      if (signal.aborted) return;
      setPageStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setFeedback({ type: "error", text: getErrorMessage(error) });
      setPageStatus("error");
    }
  }, [inscricaoId, loadItem, token, signOut]);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    setFeedback(null); setFieldErrors({});
    try {
      await fn();
      await loadItem();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setFieldErrors(pickFirstFieldErrors(error, ["tipo", "convocadoEm", "documentosEncaminhadosEm", "protocoloEncaminhamento", "observacaoEncaminhamento", "resultado", "parecer", "arquivoRetornoUrl"] as const));
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function updateEncaminhamento(tipo: string, patch: Partial<EncaminhamentoState>) {
    setEncaminhamento((current) => ({
      ...current,
      [tipo]: { ...(current[tipo] ?? buildEncaminhamentoState({} as PoliticasEtapaItem)), ...patch },
    }));
  }

  function updatePreliminar(tipo: string, patch: Partial<ResultadoState>) {
    setPreliminar((current) => ({
      ...current,
      [tipo]: { ...(current[tipo] ?? { resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" }), ...patch },
    }));
  }

  function updateFinal(tipo: string, patch: Partial<ResultadoState>) {
    setFinalResult((current) => ({
      ...current,
      [tipo]: { ...(current[tipo] ?? { resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" }), ...patch },
    }));
  }

  async function submitEncaminhamento(tipo: string, event: FormEvent) {
    event.preventDefault();
    await wrap(async () => {
      await registrarEncaminhamentoPoliticas(inscricaoId!, { tipo, ...encaminhamento[tipo] }, token!);
      setFeedback({ type: "success", text: `Encaminhamento atualizado para ${getTipoLabel(tipo)}.` });
    });
  }

  async function submitPreliminar(tipo: string, event: FormEvent) {
    event.preventDefault();
    await wrap(async () => {
      const etapa = preliminar[tipo];
      await registrarResultadoPreliminarPoliticas(inscricaoId!, {
        tipo,
        resultado: etapa.resultado,
        parecer: etapa.parecer,
        arquivoRetornoUrl: etapa.arquivoRetornoUrl || undefined,
      }, token!);
      setFeedback({ type: "success", text: `Resultado preliminar registrado para ${getTipoLabel(tipo)}.` });
    });
  }

  async function submitFinal(tipo: string, event: FormEvent) {
    event.preventDefault();
    await wrap(async () => {
      const etapa = finalResult[tipo];
      await registrarResultadoFinalPoliticas(inscricaoId!, {
        tipo,
        resultado: etapa.resultado,
        parecer: etapa.parecer,
        arquivoRetornoUrl: etapa.arquivoRetornoUrl || undefined,
      }, token!);
      setFeedback({ type: "success", text: `Resultado final registrado para ${getTipoLabel(tipo)}.` });
    });
  }

  async function handleUpload(tipo: string, target: "preliminar" | "final", file: File | null) {
    if (!token || !file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const uploaded = await uploadPrivateFile(file, token);
      if (target === "preliminar") {
        updatePreliminar(tipo, { arquivoRetornoUrl: uploaded.urlArquivo });
      } else {
        updateFinal(tipo, { arquivoRetornoUrl: uploaded.urlArquivo });
      }
      setFeedback({ type: "success", text: `Arquivo vinculado a ${getTipoLabel(tipo)}.` });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(id: string, url: string, name: string | null) {
    if (!token) return;
    setBusyDownloadId(id);
    setFeedback(null);
    try {
      await downloadAuthenticatedFile(url, token, name ?? "documento.pdf");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusyDownloadId(null);
    }
  }

  const etapas = useMemo(() => detail?.etapas ?? [], [detail]);

  if (pageStatus === "loading") return <LoadingState title="Carregando politicas" description="Consultando detalhe." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar" description={feedback?.text} />;
  if (!detail) return <EmptyState title="Inscricao nao encontrada" description="Nenhuma etapa de politicas afirmativas encontrada." />;

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback ? <PageFeedback description={feedback.text} title="Retorno" type={feedback.type} /> : null}

      <div className="admin-detail-header">
        <h1>Politicas Afirmativas — {detail.candidato.nomeCompleto}</h1>
        <p>Edital {detail.edital.numero} · Acompanhe separadamente heteroidentificacao e PCD quando houver as duas etapas.</p>
      </div>

      <div className="admin-summary-cards">
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Reservas</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B" }}>{getReservasResumo(detail)}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Etapas ativas</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B" }}>{etapas.length}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Linha</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B" }}>{detail.linhaPesquisa?.nome ?? "Nao definida"}</span>
        </div>
      </div>

      {etapas.map((etapa) => (
        <div className="admin-form-card" key={etapa.id} style={{ gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 className="admin-form-card-title">{getTipoLabel(etapa.tipo)}</h2>
            <StatusBadge variant={getStatusVariant(etapa.statusOperacao)}>{getStatusLabel(etapa.statusOperacao)}</StatusBadge>
            <StatusBadge variant={getStatusVariant(etapa.resultadoFinal ?? "PENDENTE")}>{getStatusLabel(etapa.resultadoFinal ?? "PENDENTE")}</StatusBadge>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <strong style={{ fontSize: 13, color: "#0F172A" }}>Documentos de reserva</strong>
            {etapa.documentosReserva.length ? etapa.documentosReserva.map((documento) => (
              <div key={documento.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#F8FAFC", borderRadius: 6, border: "1px solid #F1F5F9" }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{documento.nomeArquivo ?? getStatusLabel(documento.tipo)}</span>
                <button className="admin-homologacao-table-link" disabled={busyDownloadId === documento.id} onClick={() => handleDownload(documento.id, documento.urlArquivo, documento.nomeArquivo)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }} type="button">
                  {busyDownloadId === documento.id ? "Baixando..." : "Baixar"}
                </button>
              </div>
            )) : <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhum documento de reserva registrado para esta etapa.</span>}
          </div>

          <form onSubmit={(event) => void submitEncaminhamento(etapa.tipo, event)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#0F172A" }}>Encaminhamento</h3>
            <div className="admin-form-row">
              <div className="admin-eval-field">
                <label>Convocado em</label>
                <input aria-invalid={!!fieldErrors.convocadoEm} onChange={(event) => { updateEncaminhamento(etapa.tipo, { convocadoEm: event.target.value }); setFieldErrors((current) => ({ ...current, convocadoEm: null })); }} type="datetime-local" value={encaminhamento[etapa.tipo]?.convocadoEm ?? ""} />
                {fieldErrors.convocadoEm ? <span className="field-error-text">{fieldErrors.convocadoEm}</span> : null}
              </div>
              <div className="admin-eval-field">
                <label>Documentos encaminhados em</label>
                <input aria-invalid={!!fieldErrors.documentosEncaminhadosEm} onChange={(event) => { updateEncaminhamento(etapa.tipo, { documentosEncaminhadosEm: event.target.value }); setFieldErrors((current) => ({ ...current, documentosEncaminhadosEm: null })); }} type="datetime-local" value={encaminhamento[etapa.tipo]?.documentosEncaminhadosEm ?? ""} />
                {fieldErrors.documentosEncaminhadosEm ? <span className="field-error-text">{fieldErrors.documentosEncaminhadosEm}</span> : null}
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-eval-field">
                <label>Protocolo</label>
                <input aria-invalid={!!fieldErrors.protocoloEncaminhamento} onChange={(event) => { updateEncaminhamento(etapa.tipo, { protocoloEncaminhamento: event.target.value }); setFieldErrors((current) => ({ ...current, protocoloEncaminhamento: null })); }} value={encaminhamento[etapa.tipo]?.protocoloEncaminhamento ?? ""} />
                {fieldErrors.protocoloEncaminhamento ? <span className="field-error-text">{fieldErrors.protocoloEncaminhamento}</span> : null}
              </div>
              <div className="admin-eval-field">
                <label>Observacao</label>
                <textarea aria-invalid={!!fieldErrors.observacaoEncaminhamento} className="text-area" onChange={(event) => { updateEncaminhamento(etapa.tipo, { observacaoEncaminhamento: event.target.value }); setFieldErrors((current) => ({ ...current, observacaoEncaminhamento: null })); }} value={encaminhamento[etapa.tipo]?.observacaoEncaminhamento ?? ""} />
                {fieldErrors.observacaoEncaminhamento ? <span className="field-error-text">{fieldErrors.observacaoEncaminhamento}</span> : null}
              </div>
            </div>
            <button className="admin-page-cta" disabled={busy} style={{ width: 220 }} type="submit">Salvar encaminhamento</button>
          </form>

          <form onSubmit={(event) => void submitPreliminar(etapa.tipo, event)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#0F172A" }}>Resultado preliminar</h3>
            <div className="admin-form-row">
              <div className="admin-eval-field">
                <label>Resultado *</label>
                <select aria-invalid={!!fieldErrors.resultado} className="select-field" onChange={(event) => { updatePreliminar(etapa.tipo, { resultado: event.target.value as (typeof resultadoPoliticasOptions)[number] }); setFieldErrors((current) => ({ ...current, resultado: null })); }} value={preliminar[etapa.tipo]?.resultado ?? resultadoPoliticasOptions[0]}>
                  {resultadoPoliticasOptions.map((value) => <option key={value} value={value}>{getStatusLabel(value)}</option>)}
                </select>
                {fieldErrors.resultado ? <span className="field-error-text">{fieldErrors.resultado}</span> : null}
              </div>
              <div className="admin-eval-field">
                <label>Parecer</label>
                <textarea aria-invalid={!!fieldErrors.parecer} className="text-area" onChange={(event) => { updatePreliminar(etapa.tipo, { parecer: event.target.value }); setFieldErrors((current) => ({ ...current, parecer: null })); }} value={preliminar[etapa.tipo]?.parecer ?? ""} />
                {fieldErrors.parecer ? <span className="field-error-text">{fieldErrors.parecer}</span> : null}
              </div>
            </div>
            {fieldErrors.arquivoRetornoUrl ? <span className="field-error-text">{fieldErrors.arquivoRetornoUrl}</span> : null}
            {preliminar[etapa.tipo]?.arquivoRetornoUrl ? <span style={{ fontSize: 12, color: "#64748B" }}>Arquivo preliminar vinculado ao formulario.</span> : null}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <FileField accept="application/pdf" label="Upload retorno" onFileSelect={(file) => void handleUpload(etapa.tipo, "preliminar", file)} />
              <button className="admin-page-cta" disabled={busy} style={{ width: 220 }} type="submit">Registrar preliminar</button>
            </div>
          </form>

          <form onSubmit={(event) => void submitFinal(etapa.tipo, event)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#0F172A" }}>Resultado final</h3>
            <div className="admin-form-row">
              <div className="admin-eval-field">
                <label>Resultado final *</label>
                <select aria-invalid={!!fieldErrors.resultado} className="select-field" onChange={(event) => { updateFinal(etapa.tipo, { resultado: event.target.value as (typeof resultadoPoliticasOptions)[number] }); setFieldErrors((current) => ({ ...current, resultado: null })); }} value={finalResult[etapa.tipo]?.resultado ?? resultadoPoliticasOptions[0]}>
                  {resultadoPoliticasOptions.map((value) => <option key={value} value={value}>{getStatusLabel(value)}</option>)}
                </select>
                {fieldErrors.resultado ? <span className="field-error-text">{fieldErrors.resultado}</span> : null}
              </div>
              <div className="admin-eval-field">
                <label>Parecer final</label>
                <textarea aria-invalid={!!fieldErrors.parecer} className="text-area" onChange={(event) => { updateFinal(etapa.tipo, { parecer: event.target.value }); setFieldErrors((current) => ({ ...current, parecer: null })); }} value={finalResult[etapa.tipo]?.parecer ?? ""} />
                {fieldErrors.parecer ? <span className="field-error-text">{fieldErrors.parecer}</span> : null}
              </div>
            </div>
            {fieldErrors.arquivoRetornoUrl ? <span className="field-error-text">{fieldErrors.arquivoRetornoUrl}</span> : null}
            {finalResult[etapa.tipo]?.arquivoRetornoUrl ? <span style={{ fontSize: 12, color: "#64748B" }}>Arquivo final vinculado ao formulario.</span> : null}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <FileField accept="application/pdf" label="Upload retorno" onFileSelect={(file) => void handleUpload(etapa.tipo, "final", file)} />
              <button className="admin-page-cta" disabled={busy} style={{ width: 220 }} type="submit">Registrar final</button>
            </div>
          </form>
        </div>
      ))}
    </div>
  );
}
