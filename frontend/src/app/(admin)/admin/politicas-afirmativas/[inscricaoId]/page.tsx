"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { FileField } from "@/components/shared/file-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { uploadPrivateFile } from "@/modules/upload/api";
import { getPoliticasByInscricao, registrarEncaminhamentoPoliticas, registrarResultadoFinalPoliticas, registrarResultadoPreliminarPoliticas } from "@/modules/admin-politicas/api";
import type { PoliticasEtapaItem } from "@/modules/admin-politicas/types";
import { resultadoPoliticasOptions } from "@/modules/admin-operacao/constants";

type Props = { params: Promise<{ inscricaoId: string }> };

export default function AdminPoliticasDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const searchParams = useSearchParams();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<PoliticasEtapaItem | null>(null);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editalId, setEditalId] = useState("");
  const [busyDownloadId, setBusyDownloadId] = useState<string | null>(null);
  const [encaminhamento, setEncaminhamento] = useState({ convocadoEm: "", documentosEncaminhadosEm: "", protocoloEncaminhamento: "", observacaoEncaminhamento: "" });
  const [preliminar, setPreliminar] = useState<{ resultado: (typeof resultadoPoliticasOptions)[number]; parecer: string; arquivoRetornoUrl: string }>({ resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" });
  const [finalResult, setFinalResult] = useState<{ resultado: (typeof resultadoPoliticasOptions)[number]; parecer: string; arquivoRetornoUrl: string }>({ resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" });

  useEffect(() => { let c = false; params.then((r) => { if (!c) setInscricaoId(r.inscricaoId); }); return () => { c = true; }; }, [params]);
  useEffect(() => { const q = searchParams?.get("editalId"); if (q) setEditalId(q); }, [searchParams]);

  const loadItem = useCallback(async () => {
    if (!token || !inscricaoId) return;
    const found = await getPoliticasByInscricao(inscricaoId, token);
    setItem(found);
    setEditalId((c) => c || found.edital.id);
    setEncaminhamento({ convocadoEm: found.convocadoEm ?? "", documentosEncaminhadosEm: found.documentosEncaminhadosEm ?? "", protocoloEncaminhamento: found.protocoloEncaminhamento ?? "", observacaoEncaminhamento: found.observacaoEncaminhamento ?? "" });
    setPreliminar({ resultado: (found.resultadoPreliminar as (typeof resultadoPoliticasOptions)[number]) ?? resultadoPoliticasOptions[0], parecer: found.parecerPreliminar ?? "", arquivoRetornoUrl: found.arquivoRetornoPreliminarUrl ?? "" });
    setFinalResult({ resultado: (found.resultadoFinal as (typeof resultadoPoliticasOptions)[number]) ?? resultadoPoliticasOptions[0], parecer: found.parecerFinal ?? "", arquivoRetornoUrl: found.arquivoRetornoFinalUrl ?? "" });
  }, [inscricaoId, token]);

  useAbortableEffect(async (signal) => {
    if (!inscricaoId || !token) return;
    try { await loadItem(); if (signal.aborted) return; setPageStatus("ready"); }
    catch (e) { if (signal.aborted) return; if (isUnauthorizedError(e)) { signOut(); return; } setFeedback({ type: "error", text: getErrorMessage(e) }); setPageStatus("error"); }
  }, [inscricaoId, loadItem, token, signOut]);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true); setFeedback(null);
    try { await fn(); await loadItem(); } catch (e) { if (isUnauthorizedError(e)) { signOut(); return; } setFeedback({ type: "error", text: getErrorMessage(e) }); } finally { setBusy(false); }
  }

  async function submitEncaminhamento(e: FormEvent) { e.preventDefault(); await wrap(async () => { await registrarEncaminhamentoPoliticas(inscricaoId!, encaminhamento, token!); setFeedback({ type: "success", text: "Encaminhamento registrado." }); }); }
  async function submitPreliminar(e: FormEvent) { e.preventDefault(); await wrap(async () => { await registrarResultadoPreliminarPoliticas(inscricaoId!, { ...preliminar, arquivoRetornoUrl: preliminar.arquivoRetornoUrl || undefined }, token!); setFeedback({ type: "success", text: "Resultado preliminar registrado." }); }); }
  async function submitFinal(e: FormEvent) { e.preventDefault(); await wrap(async () => { await registrarResultadoFinalPoliticas(inscricaoId!, { ...finalResult, arquivoRetornoUrl: finalResult.arquivoRetornoUrl || undefined }, token!); setFeedback({ type: "success", text: "Resultado final registrado." }); }); }

  async function handleUpload(target: "preliminar" | "final", file: File | null) {
    if (!token || !file) return;
    setBusy(true); setFeedback(null);
    try {
      const u = await uploadPrivateFile(file, token);
      if (target === "preliminar") setPreliminar((c) => ({ ...c, arquivoRetornoUrl: u.urlArquivo }));
      else setFinalResult((c) => ({ ...c, arquivoRetornoUrl: u.urlArquivo }));
      setFeedback({ type: "success", text: "Arquivo enviado." });
    } catch (e) { if (isUnauthorizedError(e)) { signOut(); return; } setFeedback({ type: "error", text: getErrorMessage(e) }); } finally { setBusy(false); }
  }

  async function handleDownload(id: string, url: string, name: string | null) {
    if (!token) return;
    setBusyDownloadId(id); setFeedback(null);
    try { await downloadAuthenticatedFile(url, token, name ?? "documento.pdf"); }
    catch (e) { if (isUnauthorizedError(e)) { signOut(); return; } setFeedback({ type: "error", text: getErrorMessage(e) }); }
    finally { setBusyDownloadId(null); }
  }

  if (pageStatus === "loading") return <LoadingState title="Carregando politicas" description="Consultando detalhe." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar" description={feedback?.text} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="Nenhuma etapa de politicas afirmativas encontrada." />;

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && <PageFeedback description={feedback.text} title="Retorno" type={feedback.type} />}

      <div className="admin-detail-header">
        <h1>Politicas Afirmativas — {item.candidato.nomeCompleto}</h1>
        <p>Edital {item.edital.numero} &middot; Encaminhamento e resultado de heteroidentificacao</p>
      </div>

      {/* Summary cards */}
      <div className="admin-summary-cards">
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Modalidade</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B" }}>{getStatusLabel(item.inscricao?.modalidadeConcorrencia ?? "—")}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Status</span>
          <StatusBadge variant={getStatusVariant(item.statusOperacao)}>{getStatusLabel(item.statusOperacao)}</StatusBadge>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Resultado preliminar</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: item.resultadoPreliminar ? "#065F46" : "#94A3B8" }}>
            {item.resultadoPreliminar ? getStatusLabel(item.resultadoPreliminar) : "Pendente"}
          </span>
        </div>
      </div>

      {/* Documentos */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Documentos de acoes afirmativas</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Arquivos enviados pelo candidato no ato da inscricao para analise da comissao.</p>
        {item.documentosReserva.length ? item.documentosReserva.map((doc) => (
          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#F8FAFC", borderRadius: 6, border: "1px solid #F1F5F9" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{doc.nomeArquivo ?? getStatusLabel(doc.tipo)}</span>
            <button className="admin-homologacao-table-link" disabled={busyDownloadId === doc.id} onClick={() => handleDownload(doc.id, doc.urlArquivo, doc.nomeArquivo)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }} type="button">
              {busyDownloadId === doc.id ? "Baixando..." : "Baixar"}
            </button>
          </div>
        )) : <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhum documento de reserva registrado.</span>}
      </div>

      {/* Encaminhamento e resultado */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Encaminhamento e resultado</h2>
        <form onSubmit={submitPreliminar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="admin-form-row">
            <div className="admin-eval-field">
              <label>Resultado preliminar *</label>
              <select className="select-field" onChange={(e) => setPreliminar((c) => ({ ...c, resultado: e.target.value as (typeof resultadoPoliticasOptions)[number] }))} value={preliminar.resultado}>
                {resultadoPoliticasOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
              </select>
            </div>
            <div className="admin-eval-field">
              <label>Parecer</label>
              <textarea className="text-area" onChange={(e) => setPreliminar((c) => ({ ...c, parecer: e.target.value }))} placeholder="Parecer da comissao..." style={{ minHeight: 72 }} value={preliminar.parecer} />
            </div>
          </div>
          {preliminar.arquivoRetornoUrl && <span style={{ fontSize: 12, color: "#64748B" }}>Arquivo de retorno vinculado ao formulario.</span>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <FileField accept="application/pdf" label="Upload retorno" onFileSelect={(f) => void handleUpload("preliminar", f)} />
            <button className="admin-page-cta" disabled={busy} style={{ width: 200 }} type="submit">Registrar preliminar</button>
          </div>
        </form>
      </div>

      {/* Resultado final */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Resultado final</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Registre o resultado final apos retorno da Comissao Geral de Heteroidentificacao.</p>
        <form onSubmit={submitFinal} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="admin-form-row">
            <div className="admin-eval-field">
              <label>Resultado final *</label>
              <select className="select-field" onChange={(e) => setFinalResult((c) => ({ ...c, resultado: e.target.value as (typeof resultadoPoliticasOptions)[number] }))} value={finalResult.resultado}>
                {resultadoPoliticasOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
              </select>
            </div>
            <div className="admin-eval-field">
              <label>Parecer final</label>
              <textarea className="text-area" onChange={(e) => setFinalResult((c) => ({ ...c, parecer: e.target.value }))} placeholder="Parecer final da comissao..." style={{ minHeight: 72 }} value={finalResult.parecer} />
            </div>
          </div>
          {finalResult.arquivoRetornoUrl && <span style={{ fontSize: 12, color: "#64748B" }}>Arquivo de retorno vinculado ao formulario.</span>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <FileField accept="application/pdf" label="Upload retorno" onFileSelect={(f) => void handleUpload("final", f)} />
            <button className="admin-page-cta" disabled={busy} style={{ width: 200 }} type="submit">Registrar final</button>
          </div>
        </form>
      </div>
    </div>
  );
}
