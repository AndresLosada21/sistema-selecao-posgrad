"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getFilenameFromDispositionHeader, triggerBrowserDownload, downloadAuthenticatedFile } from "@/lib/files/download";
import { ApiError, getActionableErrorMessage, getErrorMessage, getFirstFormError, pickLabeledFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import type { StatusConfirmacaoReserva, StatusPagamentoInscricao } from "@/lib/enums";
import { formatIsoDate } from "@/modules/edital/formatters";

import {
  atualizarStatusPagamentoHomologacao,
  atualizarConfirmacaoReserva, baixarAnexoIvAdmin, baixarAnexoIvFlattenAdmin,
  getPacoteDocumentalAdmin, getInscricaoHomologacaoAdmin, listFundamentosHomologacao,
  regenerarPacoteDocumentalAdmin,
  registrarHomologacaoFinal, registrarHomologacaoPreliminar,
} from "@/modules/admin-homologacao/api";
import type { AdminInscricaoHomologacao, HomologacaoFundamento } from "@/modules/admin-homologacao/types";

/* Icons */
const iconDownload = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;
const iconFile = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;

type Props = { params: Promise<{ inscricaoId: string }> };
const confirmacaoOptions = ["PENDENTE", "CONFIRMADA", "NAO_CONFIRMADA", "AUSENTE", "NAO_SE_APLICA"] as const;

export default function AdminHomologacaoDetailPage({ params }: Props) {
  const session = useSession();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminInscricaoHomologacao | null>(null);
  const [fundamentos, setFundamentos] = useState<HomologacaoFundamento[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; title: string; description: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [busyPagamento, setBusyPagamento] = useState(false);
  const [downloadingPacote, setDownloadingPacote] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [fieldErrorScope, setFieldErrorScope] = useState<"prelim" | "final" | "confirmacao" | null>(null);

  // Decision state
  const [prelimResultado, setPrelimResultado] = useState<"" | "HOMOLOGADA" | "INDEFERIDA">("");
  const [prelimParecer, setPrelimParecer] = useState("");
  const [finalResultado, setFinalResultado] = useState<"" | "HOMOLOGADA" | "INDEFERIDA">("");
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
    setPrelimResultado(found.homologacao?.statusPreliminar === "HOMOLOGADA_PRELIMINAR" ? "HOMOLOGADA" : found.homologacao?.statusPreliminar === "NAO_HOMOLOGADA_PRELIMINAR" ? "INDEFERIDA" : "");
    setFinalResultado(found.homologacao?.statusFinal === "HOMOLOGADA_FINAL" ? "HOMOLOGADA" : found.homologacao?.statusFinal === "NAO_HOMOLOGADA_FINAL" ? "INDEFERIDA" : "");
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

  async function handleDownloadPacote() {
    if (!session.token || !item) return;
    setDownloadingPacote(true);
    setMessage(null);
    try {
      let pacoteAtual = pacote;

      if (!pacoteAtual) {
        try {
          pacoteAtual = (await getPacoteDocumentalAdmin(item.id, session.token)).pacoteDocumental;
        } catch (error) {
          if (error instanceof ApiError && error.code === "PACOTE_DOCUMENTAL_NAO_GERADO") {
            pacoteAtual = await regenerarPacoteDocumentalAdmin(item.id, session.token);
            setMessage({
              type: "success",
              title: "Pacote documental gerado",
              description: "O pacote nao existia e foi gerado automaticamente antes do download.",
            });
          } else {
            throw error;
          }
        }
      }

      setPacote(pacoteAtual);
      await downloadAuthenticatedFile(pacoteAtual.urlArquivo, session.token, pacoteAtual.nomeArquivo ?? "pacote-documental.pdf");
    }
    catch (error) { if (handleUnauth(error)) return; setMessage({ type: "error", title: "Pacote indisponivel", description: getErrorMessage(error) }); }
    finally { setDownloadingPacote(false); }
  }

  async function handleStatusPagamento(statusPagamento: Exclude<StatusPagamentoInscricao, "NAO_APLICAVEL" | "DISPENSADO">) {
    if (!session.token || !item) return;
    setBusyPagamento(true);
    setMessage(null); setFieldErrors({});
    try {
      await atualizarStatusPagamentoHomologacao(item.id, { statusPagamento }, session.token);
      await loadItem();
      setMessage({ type: "success", title: "Pagamento atualizado", description: `Status alterado para ${getStatusLabel(statusPagamento)}.` });
    } catch (error) {
      if (handleUnauth(error)) return;
      setFieldErrors(pickLabeledFieldErrors(error, { statusPagamento: "o status de pagamento" }));
      setMessage({ type: "error", title: "Nao foi possivel atualizar o pagamento", description: getFirstFormError(error) ?? getErrorMessage(error) });
    } finally {
      setBusyPagamento(false);
    }
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
    setBusy(true); setMessage(null); setFieldErrors({}); setFieldErrorScope("prelim");
    if (!prelimResultado) { setMessage({ type: "warning", title: "Resultado obrigatorio", description: "Selecione homologada ou indeferida antes de salvar a homologacao preliminar." }); setBusy(false); return; }
    try { await registrarHomologacaoPreliminar(item.id, { homologada: prelimResultado === "HOMOLOGADA", parecer: prelimParecer, motivos: motivosPrelim }, session.token); await loadItem(); setMessage({ type: "success", title: "Decisao registrada", description: "Resultado preliminar salvo." }); }
    catch (error) { if (handleUnauth(error)) return; setFieldErrors(pickLabeledFieldErrors(error, { homologada: "o resultado preliminar", parecer: "o parecer preliminar", motivos: "ao menos um fundamento do edital" })); setMessage({ type: "error", title: "Nao foi possivel salvar o resultado preliminar", description: getActionableErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleFinal(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !item) return;
    setBusy(true); setMessage(null); setFieldErrors({}); setFieldErrorScope("final");
    if (!finalResultado) { setMessage({ type: "warning", title: "Resultado obrigatorio", description: "Selecione homologada ou indeferida antes de salvar a homologacao final." }); setBusy(false); return; }
    try { await registrarHomologacaoFinal(item.id, { homologada: finalResultado === "HOMOLOGADA", parecer: finalParecer, motivos: motivosFinal }, session.token); await loadItem(); setMessage({ type: "success", title: "Decisao registrada", description: "Resultado final salvo." }); }
    catch (error) { if (handleUnauth(error)) return; setFieldErrors(pickLabeledFieldErrors(error, { homologada: "o resultado final", parecer: "o parecer final", motivos: "ao menos um fundamento do edital" })); setMessage({ type: "error", title: "Nao foi possivel salvar o resultado final", description: getActionableErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleConfirmacao(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !item) return;
    setBusy(true); setMessage(null); setFieldErrors({}); setFieldErrorScope("confirmacao");
    try { await atualizarConfirmacaoReserva(item.id, { confirmacaoAcoesAfirmativas: confirmAA, confirmacaoPcd: confirmPCD }, session.token); await loadItem(); setMessage({ type: "success", title: "Confirmacao atualizada", description: "Reservas atualizadas." }); }
    catch (error) { if (handleUnauth(error)) return; setFieldErrors(pickLabeledFieldErrors(error, { confirmacaoAcoesAfirmativas: "a confirmacao de acoes afirmativas", confirmacaoPcd: "a confirmacao PCD" })); setMessage({ type: "error", title: "Nao foi possivel atualizar as reservas", description: getActionableErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando homologacao" description="Consultando inscricao e documentos." />;
  if (status === "error") return <ErrorState title="Falha ao carregar" description={message?.description} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" />;

  const homolog = item.homologacao;
  const hasPrelim = !!homolog?.statusPreliminar;
  const hasFinal = !!homolog?.statusFinal;
  const reservaAcoesAtiva = Boolean(item.reservasConcorrencia?.acoesAfirmativas);
  const reservaPcdAtiva = Boolean(item.reservasConcorrencia?.pcd);
  const confirmacaoAcoesOptions = reservaAcoesAtiva
    ? confirmacaoOptions.filter((value) => value !== "NAO_SE_APLICA")
    : ["NAO_SE_APLICA"] as const;
  const confirmacaoPcdOptions = reservaPcdAtiva
    ? confirmacaoOptions.filter((value) => value !== "NAO_SE_APLICA")
    : ["NAO_SE_APLICA"] as const;
  const comprovantePagamento = item.documentos.find((doc) => doc.tipo === "COMPROVANTE_PAGAMENTO");
  const pagamentoManualDisponivel = item.statusPagamento !== "DISPENSADO";
  const pagamentoAction = !pagamentoManualDisponivel || !comprovantePagamento
    ? null
    : item.statusPagamento === "PAGO"
      ? { label: "Invalidar pagamento", nextStatus: "INVALIDADO" as const, background: "#FEF2F2", color: "#B91C1C", border: "#FECACA" }
      : { label: "Confirmar pagamento", nextStatus: "PAGO" as const, background: "#ECFDF5", color: "#047857", border: "#A7F3D0" };

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
          <span className="admin-stat-label">Reservas declaradas</span>
          <strong style={{ fontSize: 13, color: "#1E293B" }}>
            {reservaAcoesAtiva && reservaPcdAtiva
              ? "Acoes afirmativas + PCD"
              : reservaAcoesAtiva
                ? "Acoes afirmativas"
                : reservaPcdAtiva
                  ? "PCD"
                  : "Ampla concorrencia"}
          </strong>
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
          <button type="button" disabled={downloadingPacote} onClick={handleDownloadPacote} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", fontSize: 13, color: "#475569" }}>
            {iconDownload} {downloadingPacote ? "Baixando pacote..." : "Baixar pacote documental"}
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
              {doc.tipo === "COMPROVANTE_PAGAMENTO" && pagamentoAction ? (
                <button
                  type="button"
                  disabled={busyPagamento}
                  onClick={() => handleStatusPagamento(pagamentoAction.nextStatus)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 12px",
                    background: pagamentoAction.background,
                    border: `1px solid ${pagamentoAction.border}`,
                    borderRadius: 6,
                    cursor: "pointer",
                    color: pagamentoAction.color,
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {busyPagamento ? "Atualizando..." : pagamentoAction.label}
                </button>
              ) : null}
              <button type="button" disabled={busyDocId === doc.id} onClick={() => handleDownloadDoc(doc.id, doc.urlArquivo, doc.nomeArquivo)}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", padding: 4, color: "#2563EB", fontSize: 12 }}>
                {iconDownload} {busyDocId === doc.id ? "..." : ""}
              </button>
            </div>
          ))}
          {item.documentos.length === 0 ? <span style={{ fontSize: 13, color: "#94A3B8", padding: "12px 0" }}>Nenhum documento registrado.</span> : null}
        </div>
        <div style={{ fontSize: 12, color: "#64748B" }}>
          {item.statusPagamento === "DISPENSADO"
            ? "Pagamento dispensado automaticamente por isencao final deferida."
            : comprovantePagamento
              ? "A conferencia do comprovante e manual e acontece nesta tela de homologacao."
              : "Sem comprovante de pagamento enviado; a validacao manual so pode ocorrer quando o arquivo estiver disponivel."}
        </div>
      </div>

      {/* Decisao preliminar */}
      <div className="admin-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 className="admin-form-card-title">Resultado preliminar da homologacao</h3>
          {hasPrelim ? <StatusBadge variant={getStatusVariant(homolog?.statusPreliminar ?? "")}>{getStatusLabel(homolog?.statusPreliminar ?? "")}</StatusBadge> : null}
        </div>
        {!item.edicaoHomologacao.podeEditarPreliminar && item.edicaoHomologacao.bloqueioPreliminar ? (
          <PageFeedback type="warning" title="Edicao preliminar bloqueada" description={item.edicaoHomologacao.bloqueioPreliminar} />
        ) : null}
        <form onSubmit={handlePrelim} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-form-row">
            <div className="wiz-field">
              <label className="wiz-field-label">Resultado *</label>
              <select aria-invalid={!!fieldErrors.homologada} disabled={!item.edicaoHomologacao.podeEditarPreliminar || busy} value={prelimResultado} onChange={(e) => { setPrelimResultado(e.target.value as "" | "HOMOLOGADA" | "INDEFERIDA"); setFieldErrors((current) => ({ ...current, homologada: null })); }} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                <option value="">Selecione o resultado preliminar</option>
                <option value="HOMOLOGADA">Homologada</option>
                <option value="INDEFERIDA">Indeferida</option>
              </select>
              {fieldErrorScope === "prelim" && fieldErrors.homologada ? <span className="field-error-text">{fieldErrors.homologada}</span> : null}
            </div>
            <div className="wiz-field" style={{ flex: 2 }}>
              <label className="wiz-field-label">Parecer</label>
              <textarea aria-invalid={!!fieldErrors.parecer} aria-label="Parecer preliminar" disabled={!item.edicaoHomologacao.podeEditarPreliminar || busy} value={prelimParecer} onChange={(e) => { setPrelimParecer(e.target.value); setFieldErrors((current) => ({ ...current, parecer: null })); }} placeholder="Explique de forma objetiva a decisao preliminar." style={{ height: 72, borderRadius: 6, border: "1px solid #CBD5E1", padding: "10px 14px", fontSize: 14, resize: "vertical" }} />
              {fieldErrorScope === "prelim" && fieldErrors.parecer ? <span className="field-error-text">{fieldErrors.parecer}</span> : null}
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
              <select aria-invalid={!!fieldErrors.motivos} disabled={!item.edicaoHomologacao.podeEditarPreliminar || busy} value={selectedMotivo} onChange={(e) => { setSelectedMotivo(e.target.value); setFieldErrors((current) => ({ ...current, motivos: null })); }} style={{ height: 36, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 12 }}>
                {fundamentos.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.titulo}</option>)}
              </select>
              {fieldErrorScope === "prelim" && fieldErrors.motivos ? <span className="field-error-text">{fieldErrors.motivos}</span> : null}
            </div>
            <button type="button" disabled={!item.edicaoHomologacao.podeEditarPreliminar || busy} onClick={() => addMotivo("prelim")} style={{ height: 36, padding: "0 12px", background: "#F1F5F9", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#334155" }}>+ Adicionar</button>
          </div>
          <button type="submit" disabled={busy || !item.edicaoHomologacao.podeEditarPreliminar} className="admin-page-cta" style={{ alignSelf: "flex-start", width: 220 }}>
            {busy ? "Registrando..." : "Registrar homologacao"}
          </button>
        </form>
      </div>

      {/* Decisao final */}
      <div className="admin-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h3 className="admin-form-card-title">Resultado final da homologacao</h3>
          {hasFinal ? <StatusBadge variant={getStatusVariant(homolog?.statusFinal ?? "")}>{getStatusLabel(homolog?.statusFinal ?? "")}</StatusBadge> : null}
        </div>
        {!item.edicaoHomologacao.podeEditarFinal && item.edicaoHomologacao.bloqueioFinal ? (
          <PageFeedback type="warning" title="Edicao final bloqueada" description={item.edicaoHomologacao.bloqueioFinal} />
        ) : null}
        <form onSubmit={handleFinal} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-form-row">
            <div className="wiz-field">
              <label className="wiz-field-label">Resultado *</label>
              <select aria-invalid={!!fieldErrors.homologada} disabled={!item.edicaoHomologacao.podeEditarFinal || busy} value={finalResultado} onChange={(e) => { setFinalResultado(e.target.value as "" | "HOMOLOGADA" | "INDEFERIDA"); setFieldErrors((current) => ({ ...current, homologada: null })); }} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                <option value="">Selecione o resultado final</option>
                <option value="HOMOLOGADA">Homologada</option>
                <option value="INDEFERIDA">Indeferida</option>
              </select>
              {fieldErrorScope === "final" && fieldErrors.homologada ? <span className="field-error-text">{fieldErrors.homologada}</span> : null}
            </div>
            <div className="wiz-field" style={{ flex: 2 }}>
              <label className="wiz-field-label">Parecer</label>
              <textarea aria-invalid={!!fieldErrors.parecer} aria-label="Parecer final" disabled={!item.edicaoHomologacao.podeEditarFinal || busy} value={finalParecer} onChange={(e) => { setFinalParecer(e.target.value); setFieldErrors((current) => ({ ...current, parecer: null })); }} placeholder="Explique de forma objetiva a decisao final." style={{ height: 72, borderRadius: 6, border: "1px solid #CBD5E1", padding: "10px 14px", fontSize: 14, resize: "vertical" }} />
              {fieldErrorScope === "final" && fieldErrors.parecer ? <span className="field-error-text">{fieldErrors.parecer}</span> : null}
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
              <select aria-invalid={!!fieldErrors.motivos} disabled={!item.edicaoHomologacao.podeEditarFinal || busy} value={selectedMotivo} onChange={(e) => { setSelectedMotivo(e.target.value); setFieldErrors((current) => ({ ...current, motivos: null })); }} style={{ height: 36, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 12 }}>
                {fundamentos.map((f) => <option key={f.codigo} value={f.codigo}>{f.codigo} · {f.titulo}</option>)}
              </select>
              {fieldErrorScope === "final" && fieldErrors.motivos ? <span className="field-error-text">{fieldErrors.motivos}</span> : null}
            </div>
            <button type="button" disabled={!item.edicaoHomologacao.podeEditarFinal || busy} onClick={() => addMotivo("final")} style={{ height: 36, padding: "0 12px", background: "#F1F5F9", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#334155" }}>+ Adicionar</button>
          </div>
          <button type="submit" disabled={busy || !item.edicaoHomologacao.podeEditarFinal} className="admin-page-cta" style={{ alignSelf: "flex-start", width: 240 }}>
            {busy ? "Registrando..." : "Registrar homologacao final"}
          </button>
        </form>
      </div>

      {/* Confirmacao de reserva */}
      {(reservaAcoesAtiva || reservaPcdAtiva) ? (
        <div className="admin-form-card">
          <h3 className="admin-form-card-title">Confirmacao operacional de reserva</h3>
          <form onSubmit={handleConfirmacao} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="admin-form-row">
              <div className="wiz-field">
                <label className="wiz-field-label">Acoes afirmativas</label>
                  <select aria-invalid={!!fieldErrors.confirmacaoAcoesAfirmativas} disabled={!reservaAcoesAtiva} value={confirmAA} onChange={(e) => { setConfirmAA(e.target.value as StatusConfirmacaoReserva); setFieldErrors((current) => ({ ...current, confirmacaoAcoesAfirmativas: null })); }} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                  {confirmacaoAcoesOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
                  </select>
                  {fieldErrorScope === "confirmacao" && fieldErrors.confirmacaoAcoesAfirmativas ? <span className="field-error-text">{fieldErrors.confirmacaoAcoesAfirmativas}</span> : null}
                </div>
                <div className="wiz-field">
                  <label className="wiz-field-label">PCD</label>
                  <select aria-invalid={!!fieldErrors.confirmacaoPcd} disabled={!reservaPcdAtiva} value={confirmPCD} onChange={(e) => { setConfirmPCD(e.target.value as StatusConfirmacaoReserva); setFieldErrors((current) => ({ ...current, confirmacaoPcd: null })); }} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                  {confirmacaoPcdOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
                  </select>
                  {fieldErrorScope === "confirmacao" && fieldErrors.confirmacaoPcd ? <span className="field-error-text">{fieldErrors.confirmacaoPcd}</span> : null}
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
