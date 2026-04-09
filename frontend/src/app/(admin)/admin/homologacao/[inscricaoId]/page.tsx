"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getFilenameFromDispositionHeader, triggerBrowserDownload, downloadAuthenticatedFile } from "@/lib/files/download";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import type { StatusConfirmacaoReserva } from "@/lib/enums";
import { formatIsoDate } from "@/modules/edital/formatters";

import {
  atualizarConfirmacaoReserva, baixarAnexoIvAdmin, baixarAnexoIvFlattenAdmin,
  getPacoteDocumentalAdmin, getInscricaoHomologacaoAdmin, listFundamentosHomologacao,
  registrarPacoteDocumentalAdmin, registrarHomologacaoFinal, registrarHomologacaoPreliminar,
} from "@/modules/admin-homologacao/api";
import type { AdminInscricaoHomologacao, HomologacaoFundamento } from "@/modules/admin-homologacao/types";
import { uploadPrivateFile } from "@/modules/upload/api";

/* Icons */
const iconDownload = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;
const iconFile = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;

type Props = { params: Promise<{ inscricaoId: string }> };
const confirmacaoOptions = ["PENDENTE", "CONFIRMADA", "NAO_CONFIRMADA", "NAO_SE_APLICA"] as const;

export default function AdminHomologacaoDetailPage({ params }: Props) {
  const session = useSession();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminInscricaoHomologacao | null>(null);
  const [fundamentos, setFundamentos] = useState<HomologacaoFundamento[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; title: string; description: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);

  // Decision state
  const [prelimHomologada, setPrelimHomologada] = useState(true);
  const [prelimParecer, setPrelimParecer] = useState("");
  const [finalHomologada, setFinalHomologada] = useState(true);
  const [finalParecer, setFinalParecer] = useState("");
  const [motivosPrelim, setMotivosPrelim] = useState<HomologacaoFundamento[]>([]);
  const [motivosFinal, setMotivosFinal] = useState<HomologacaoFundamento[]>([]);
  const [selectedMotivo, setSelectedMotivo] = useState("");

  // Reserve confirmation
  const [confirmAA, setConfirmAA] = useState<StatusConfirmacaoReserva>("PENDENTE");
  const [confirmPCD, setConfirmPCD] = useState<StatusConfirmacaoReserva>("PENDENTE");

  // Pacote
  const [pacote, setPacote] = useState<{ urlArquivo: string; nomeArquivo: string | null; geradoEm: string | null } | null>(null);

  useEffect(() => { let c = false; params.then((r) => { if (!c) setInscricaoId(r.inscricaoId); }); return () => { c = true; }; }, [params]);

  const loadItem = useCallback(async () => {
    if (!session.token || !inscricaoId) return;
    const [found, f] = await Promise.all([getInscricaoHomologacaoAdmin(inscricaoId, session.token), listFundamentosHomologacao(session.token)]);
    setItem(found);
    setFundamentos(f.items);
    setSelectedMotivo(f.items[0]?.codigo ?? "");
    setPrelimParecer(found.homologacao?.parecerPreliminar ?? "");
    setFinalParecer(found.homologacao?.parecerFinal ?? "");
    setMotivosPrelim(found.homologacao?.motivosPreliminar ?? []);
    setMotivosFinal(found.homologacao?.motivosFinal ?? []);
    setConfirmAA(found.confirmacaoAcoesAfirmativas as StatusConfirmacaoReserva);
    setConfirmPCD(found.confirmacaoPcd as StatusConfirmacaoReserva);
  }, [inscricaoId, session.token]);

  useAbortableEffect(async (signal) => {
    if (!session.token || !inscricaoId) return;
    try { await loadItem(); if (signal.aborted) return; setStatus("ready"); }
    catch (error) { if (signal.aborted) return; if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage({ type: "error", title: "Erro", description: getErrorMessage(error) }); setStatus("error"); }
  }, [inscricaoId, loadItem, session.signOut, session.token]);

  function handleUnauth(error: unknown) { if (isUnauthorizedError(error)) { session.signOut(); return true; } return false; }

  async function handleDownloadAnexo(kind: "formulario" | "flatten") {
    if (!session.token || !item) return;
    setBusy(true); setMessage(null);
    try {
      const result = kind === "formulario" ? await baixarAnexoIvAdmin(item.id, session.token) : await baixarAnexoIvFlattenAdmin(item.id, session.token);
      triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, `anexo-iv${kind === "flatten" ? "-flatten" : ""}.pdf`));
    } catch (error) { if (handleUnauth(error)) return; setMessage({ type: "error", title: "Falha no download", description: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleDownloadDoc(docId: string, url: string, nome: string | null) {
    if (!session.token) return;
    setBusyDocId(docId);
    try { await downloadAuthenticatedFile(url, session.token, nome ?? "documento.pdf"); }
    catch (error) { if (handleUnauth(error)) return; setMessage({ type: "error", title: "Falha no download", description: getErrorMessage(error) }); }
    finally { setBusyDocId(null); }
  }

  async function handleLoadPacote() {
    if (!session.token || !item) return;
    setBusy(true);
    try { const r = await getPacoteDocumentalAdmin(item.id, session.token); setPacote(r.pacoteDocumental); }
    catch (error) { if (handleUnauth(error)) return; setMessage({ type: "error", title: "Pacote indisponivel", description: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  function addMotivo(target: "prelim" | "final") {
    const f = fundamentos.find((x) => x.codigo === selectedMotivo);
    if (!f) return;
    if (target === "prelim") setMotivosPrelim((c) => c.some((x) => x.codigo === f.codigo) ? c : [...c, f]);
    else setMotivosFinal((c) => c.some((x) => x.codigo === f.codigo) ? c : [...c, f]);
  }

  async function handlePrelim(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !item) return;
    setBusy(true); setMessage(null);
    try { await registrarHomologacaoPreliminar(item.id, { homologada: prelimHomologada, parecer: prelimParecer, motivos: motivosPrelim }, session.token); await loadItem(); setMessage({ type: "success", title: "Decisao registrada", description: "Homologacao preliminar salva." }); }
    catch (error) { if (handleUnauth(error)) return; setMessage({ type: "error", title: "Falha", description: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleFinal(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !item) return;
    setBusy(true); setMessage(null);
    try { await registrarHomologacaoFinal(item.id, { homologada: finalHomologada, parecer: finalParecer, motivos: motivosFinal }, session.token); await loadItem(); setMessage({ type: "success", title: "Decisao registrada", description: "Homologacao final salva." }); }
    catch (error) { if (handleUnauth(error)) return; setMessage({ type: "error", title: "Falha", description: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleConfirmacao(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !item) return;
    setBusy(true); setMessage(null);
    try { await atualizarConfirmacaoReserva(item.id, { confirmacaoAcoesAfirmativas: confirmAA, confirmacaoPcd: confirmPCD }, session.token); await loadItem(); setMessage({ type: "success", title: "Confirmacao atualizada", description: "Reservas atualizadas." }); }
    catch (error) { if (handleUnauth(error)) return; setMessage({ type: "error", title: "Falha", description: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando homologacao" description="Consultando inscricao e documentos." />;
  if (status === "error") return <ErrorState title="Falha ao carregar" description={message?.description} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" />;

  const homolog = item.homologacao;
  const hasPrelim = !!homolog?.statusPreliminar;
  const hasFinal = !!homolog?.statusFinal;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {message ? <PageFeedback type={message.type} title={message.title} description={message.description} /> : null}

      {/* Header */}
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Homologacao — {item.candidato.nomeCompleto}</h1>
          <p>Edital {item.edital.numero} · {getStatusLabel(item.edital.cursoNivel)} · Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</p>
        </div>
        <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
      </div>

      {/* Summary grid - 4 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Documentos</span>
          <strong style={{ fontSize: 16, color: "#1E293B" }}>{item.documentos.length} enviados</strong>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Modalidade</span>
          <strong style={{ fontSize: 13, color: "#1E293B" }}>{getStatusLabel(item.modalidadeConcorrencia)}</strong>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Pagamento</span>
          <StatusBadge variant={getStatusVariant(item.statusPagamento)}>{getStatusLabel(item.statusPagamento)}</StatusBadge>
        </div>
        <div className="admin-stat-card">
          <span className="admin-stat-label">Submetida em</span>
          <strong style={{ fontSize: 13, color: "#1E293B" }}>{formatIsoDate(item.submetidaEm)}</strong>
        </div>
      </div>

      {/* Anexo IV + Pacote */}
      <div className="admin-form-card">
        <h3 className="admin-form-card-title">Artefatos da inscricao</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" disabled={busy} onClick={() => handleDownloadAnexo("formulario")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#1E293B" }}>
            {iconDownload} Anexo IV (formulario)
          </button>
          <button type="button" disabled={busy} onClick={() => handleDownloadAnexo("flatten")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#1E293B" }}>
            {iconDownload} Anexo IV (flattened)
          </button>
          <button type="button" disabled={busy} onClick={handleLoadPacote} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#475569" }}>
            Carregar pacote documental
          </button>
        </div>
        {pacote ? (
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
            Pacote: {pacote.nomeArquivo ?? "sem nome"} · Gerado em: {formatIsoDate(pacote.geradoEm)}
          </div>
        ) : null}
      </div>

      {/* Documentos */}
      <div className="admin-form-card">
        <h3 className="admin-form-card-title">Documentos da inscricao</h3>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {item.documentos.map((doc) => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
              {iconFile}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nomeArquivo ?? doc.nome}</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>{getStatusLabel(doc.tipo)}{doc.obrigatorio ? " · Obrigatorio" : ""}</div>
              </div>
              <button type="button" disabled={busyDocId === doc.id} onClick={() => handleDownloadDoc(doc.id, doc.urlArquivo, doc.nomeArquivo)}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 4, color: "#2563EB", fontSize: 12 }}>
                {iconDownload} {busyDocId === doc.id ? "..." : ""}
              </button>
            </div>
          ))}
          {item.documentos.length === 0 ? <span style={{ fontSize: 13, color: "#94A3B8", padding: "12px 0" }}>Nenhum documento registrado.</span> : null}
        </div>
      </div>

      {/* Decisao preliminar */}
      <div className="admin-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 className="admin-form-card-title">Decisao de homologacao</h3>
          {hasPrelim ? <StatusBadge variant={getStatusVariant(homolog?.statusPreliminar ?? "")}>{getStatusLabel(homolog?.statusPreliminar ?? "")}</StatusBadge> : null}
        </div>
        <form onSubmit={handlePrelim} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-form-row">
            <div className="wiz-field">
              <label className="wiz-field-label">Resultado *</label>
              <select value={prelimHomologada ? "HOMOLOGADA" : "INDEFERIDA"} onChange={(e) => setPrelimHomologada(e.target.value === "HOMOLOGADA")} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                <option value="HOMOLOGADA">Homologada</option>
                <option value="INDEFERIDA">Indeferida</option>
              </select>
            </div>
            <div className="wiz-field" style={{ flex: 2 }}>
              <label className="wiz-field-label">Parecer</label>
              <textarea value={prelimParecer} onChange={(e) => setPrelimParecer(e.target.value)} placeholder="Documentacao completa e regular..." style={{ height: 72, borderRadius: 6, border: "1px solid #CBD5E1", padding: "10px 14px", fontSize: 14, resize: "vertical" }} />
            </div>
          </div>
          {/* Motivos */}
          {motivosPrelim.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Motivos adicionados:</span>
              {motivosPrelim.map((m) => (
                <div key={m.codigo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569", padding: "4px 8px", background: "#F8FAFC", borderRadius: 4 }}>
                  <strong>{m.codigo}</strong> — {m.titulo}
                  <button type="button" onClick={() => setMotivosPrelim((c) => c.filter((x) => x.codigo !== m.codigo))} style={{ marginLeft: "auto", background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 11 }}>Remover</button>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div className="wiz-field" style={{ flex: 1 }}>
              <label className="wiz-field-label">Adicionar fundamento</label>
              <select value={selectedMotivo} onChange={(e) => setSelectedMotivo(e.target.value)} style={{ height: 36, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 12 }}>
                {fundamentos.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.titulo}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => addMotivo("prelim")} style={{ height: 36, padding: "0 12px", background: "#F1F5F9", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#334155" }}>+ Adicionar</button>
          </div>
          <button type="submit" disabled={busy} className="admin-page-cta" style={{ alignSelf: "flex-start", width: 220 }}>
            {busy ? "Registrando..." : "Registrar homologacao"}
          </button>
        </form>
      </div>

      {/* Decisao final */}
      <div className="admin-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 className="admin-form-card-title">Decisao final de homologacao</h3>
          {hasFinal ? <StatusBadge variant={getStatusVariant(homolog?.statusFinal ?? "")}>{getStatusLabel(homolog?.statusFinal ?? "")}</StatusBadge> : null}
        </div>
        <form onSubmit={handleFinal} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-form-row">
            <div className="wiz-field">
              <label className="wiz-field-label">Resultado *</label>
              <select value={finalHomologada ? "HOMOLOGADA" : "INDEFERIDA"} onChange={(e) => setFinalHomologada(e.target.value === "HOMOLOGADA")} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                <option value="">Selecione o resultado final</option>
                <option value="HOMOLOGADA">Homologada</option>
                <option value="INDEFERIDA">Indeferida</option>
              </select>
            </div>
            <div className="wiz-field" style={{ flex: 2 }}>
              <label className="wiz-field-label">Parecer</label>
              <textarea value={finalParecer} onChange={(e) => setFinalParecer(e.target.value)} placeholder="Parecer da homologacao final..." style={{ height: 72, borderRadius: 6, border: "1px solid #CBD5E1", padding: "10px 14px", fontSize: 14, resize: "vertical" }} />
            </div>
          </div>
          {motivosFinal.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Motivos adicionados:</span>
              {motivosFinal.map((m) => (
                <div key={m.codigo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569", padding: "4px 8px", background: "#F8FAFC", borderRadius: 4 }}>
                  <strong>{m.codigo}</strong> — {m.titulo}
                  <button type="button" onClick={() => setMotivosFinal((c) => c.filter((x) => x.codigo !== m.codigo))} style={{ marginLeft: "auto", background: "none", border: "none", color: "#DC2626", cursor: "pointer", fontSize: 11 }}>Remover</button>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div className="wiz-field" style={{ flex: 1 }}>
              <label className="wiz-field-label">Adicionar fundamento</label>
              <select value={selectedMotivo} onChange={(e) => setSelectedMotivo(e.target.value)} style={{ height: 36, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 12 }}>
                {fundamentos.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.titulo}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => addMotivo("final")} style={{ height: 36, padding: "0 12px", background: "#F1F5F9", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#334155" }}>+ Adicionar</button>
          </div>
          <button type="submit" disabled={busy} className="admin-page-cta" style={{ alignSelf: "flex-start", width: 240 }}>
            {busy ? "Registrando..." : "Registrar homologacao final"}
          </button>
        </form>
      </div>

      {/* Confirmacao de reserva */}
      {item.modalidadeConcorrencia !== "AMPLA_CONCORRENCIA" ? (
        <div className="admin-form-card">
          <h3 className="admin-form-card-title">Confirmacao operacional de reserva</h3>
          <form onSubmit={handleConfirmacao} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="admin-form-row">
              <div className="wiz-field">
                <label className="wiz-field-label">Acoes afirmativas</label>
                <select value={confirmAA} onChange={(e) => setConfirmAA(e.target.value as StatusConfirmacaoReserva)} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                  {confirmacaoOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
                </select>
              </div>
              <div className="wiz-field">
                <label className="wiz-field-label">PCD</label>
                <select value={confirmPCD} onChange={(e) => setConfirmPCD(e.target.value as StatusConfirmacaoReserva)} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                  {confirmacaoOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={busy} style={{ alignSelf: "flex-start", padding: "10px 20px", background: "#F1F5F9", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", color: "#334155" }}>
              {busy ? "Atualizando..." : "Atualizar confirmacao"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
