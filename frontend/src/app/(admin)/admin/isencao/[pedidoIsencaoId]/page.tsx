"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { AdminBreadcrumb } from "@/components/shared/admin-breadcrumb";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, getFirstFormError, pickLabeledFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { decidirIsencaoFinalAdmin, decidirIsencaoPreliminarAdmin, getAdminIsencaoById } from "@/modules/admin-isencao/api";
import type { AdminIsencaoItem } from "@/modules/admin-isencao/types";
import { formatIsoDate } from "@/modules/edital/formatters";

const iconDownload = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;
const iconInfo = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>;

type Props = { params: Promise<{ pedidoIsencaoId: string }> };

export default function AdminIsencaoDetailPage({ params }: Props) {
  const session = useSession();
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminIsencaoItem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingComprovante, setDownloadingComprovante] = useState(false);
  const [preliminar, setPreliminar] = useState({ deferida: true, parecer: "" });
  const [finalDecision, setFinalDecision] = useState({ deferida: true, parecer: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => { let c = false; params.then((r) => { if (!c) setPedidoId(r.pedidoIsencaoId); }); return () => { c = true; }; }, [params]);

  const load = useCallback(async () => {
    if (!session.token || !pedidoId) return;
    const response = await getAdminIsencaoById(pedidoId, session.token);
    setItem(response);
    setPreliminar((c) => ({ ...c, parecer: response.parecerPreliminar ?? c.parecer }));
    setFinalDecision((c) => ({ ...c, parecer: response.parecerFinal ?? c.parecer }));
  }, [pedidoId, session.token]);

  useAbortableEffect(async (signal) => {
    if (!session.token || !pedidoId) return;
    try { await load(); if (signal.aborted) return; setStatus("ready"); }
    catch (error) { if (signal.aborted) return; if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); setStatus("error"); }
  }, [load, pedidoId, session.signOut, session.token]);

  async function handlePreliminar(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !pedidoId) return;
    setBusy(true); setMessage(null); setFieldErrors({});
    try { await decidirIsencaoPreliminarAdmin(pedidoId, preliminar, session.token); await load(); setMessage({ type: "success", text: "Decisão preliminar registrada." }); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setFieldErrors(pickLabeledFieldErrors(error, { deferida: "o resultado", parecer: "o parecer" })); setMessage({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleFinal(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !pedidoId) return;
    setBusy(true); setMessage(null); setFieldErrors({});
    try { await decidirIsencaoFinalAdmin(pedidoId, finalDecision, session.token); await load(); setMessage({ type: "success", text: "Decisão final registrada." }); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setFieldErrors(pickLabeledFieldErrors(error, { deferida: "o resultado final", parecer: "o parecer final" })); setMessage({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleDownloadComprovante() {
    if (!session.token || !item?.comprovanteUrl) return;
    setDownloadingComprovante(true);
    try { await downloadAuthenticatedFile(item.comprovanteUrl, session.token, item.comprovanteNomeArquivo ?? "comprovante.pdf"); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setDownloadingComprovante(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando pedido de isenção" description="Consultando detalhe administrativo." />;
  if (status === "error") return <ErrorState title="Falha ao carregar pedido" description={message?.text} />;
  if (!item) return <EmptyState title="Pedido indisponível" description="O pedido de isenção não foi encontrado." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {message ? <PageFeedback type={message.type} title={message.type === "success" ? "Sucesso" : "Erro"} description={message.text} /> : null}

      <AdminBreadcrumb items={[{ label: "Isenção", href: "/admin/isencao" }, { label: item.edital.numero }, { label: item.candidato.nomeCompleto }]} />

      {/* Header */}
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Isenção — {item.candidato.nomeCompleto}</h1>
          <p>Edital {item.edital.numero} · Analise administrativa do pedido</p>
        </div>
      </div>

      {/* Card 1: Dados do pedido */}
      <div className="admin-form-card">
        <h3 className="admin-form-card-title">Dados do pedido</h3>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>Curso</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#1E293B" }}>{getStatusLabel(item.cursoNivel)}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>CadUnico</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{item.inscritoCadUnico ? "Sim" : "Não"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>NIS</span>
            <span style={{ fontSize: 13, color: "#1E293B" }}>{item.nis ?? "Não informado"}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>Comprovante</span>
            {item.comprovanteUrl ? (
              <button type="button" onClick={handleDownloadComprovante} disabled={downloadingComprovante}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 500, color: "#2563EB", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {iconDownload} {downloadingComprovante ? "Baixando..." : "Baixar PDF"}
              </button>
            ) : <span style={{ fontSize: 13, color: "#94A3B8" }}>Sem comprovante</span>}
          </div>
        </div>
        {item.justificativa ? (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>Justificativa</span>
            <p style={{ fontSize: 13, color: "#334155", margin: "4px 0 0", lineHeight: 1.6 }}>{item.justificativa}</p>
          </div>
        ) : null}
{/* metadata inline removido para alinhar ao Pencil */}
      </div>

      {/* Alert CadUnico */}
      {item.inscritoCadUnico ? (
        <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "#DBEAFE", border: "1px solid #93C5FD", borderRadius: 8, alignItems: "flex-start" }}>
          {iconInfo}
          <span style={{ fontSize: 13, color: "#1E40AF" }}>
            Candidato informou inscricao ativa no CadUnico{item.nis ? ` (NIS: ${item.nis})` : ""}. Verificacao manual pode ser necessaria.
          </span>
        </div>
      ) : null}

      {/* Card 2: Decisao preliminar */}
      <div className="admin-form-card">
        <h3 className="admin-form-card-title">Decisao preliminar</h3>
        <form onSubmit={handlePreliminar} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-form-row">
            <div className="wiz-field">
              <label className="wiz-field-label">Resultado *</label>
              <select value={preliminar.deferida ? "DEFERIDA_PRELIMINAR" : "INDEFERIDA_PRELIMINAR"} onChange={(e) => setPreliminar((c) => ({ ...c, deferida: e.target.value === "DEFERIDA_PRELIMINAR" }))}
                aria-invalid={!!fieldErrors.deferida} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                <option value="DEFERIDA_PRELIMINAR">Deferida</option>
                <option value="INDEFERIDA_PRELIMINAR">Indeferida</option>
              </select>
              {fieldErrors.deferida ? <span className="field-error-text">{fieldErrors.deferida}</span> : null}
            </div>
            <div className="wiz-field">
              <label className="wiz-field-label">Parecer *</label>
              <textarea aria-invalid={!!fieldErrors.parecer} aria-label="Parecer preliminar" placeholder="Explique de forma objetiva a decisão preliminar." value={preliminar.parecer} onChange={(e) => { setPreliminar((c) => ({ ...c, parecer: e.target.value })); setFieldErrors((current) => ({ ...current, parecer: null })); }}
                style={{ height: 72, borderRadius: 6, border: "1px solid #CBD5E1", padding: "10px 14px", fontSize: 14, resize: "vertical" }} />
              {fieldErrors.parecer ? <span className="field-error-text">{fieldErrors.parecer}</span> : null}
            </div>
          </div>
          <button type="submit" disabled={busy} className="admin-page-cta" style={{ alignSelf: "flex-start", width: 200 }}>
            {busy ? "Registrando..." : "Registrar decisão"}
          </button>
        </form>
      </div>

      {/* Card 3: Decisão final */}
      <div className="admin-form-card">
        <h3 className="admin-form-card-title">Decisão final</h3>
        <form onSubmit={handleFinal} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-form-row">
            <div className="wiz-field">
              <label className="wiz-field-label">Resultado *</label>
              <select value={finalDecision.deferida ? "DEFERIDA_FINAL" : "INDEFERIDA_FINAL"} onChange={(e) => setFinalDecision((c) => ({ ...c, deferida: e.target.value === "DEFERIDA_FINAL" }))}
                aria-invalid={!!fieldErrors.deferida} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                <option value="">Selecione o resultado final</option>
                <option value="DEFERIDA_FINAL">Deferida final</option>
                <option value="INDEFERIDA_FINAL">Indeferida final</option>
              </select>
              {fieldErrors.deferida ? <span className="field-error-text">{fieldErrors.deferida}</span> : null}
            </div>
            <div className="wiz-field">
              <label className="wiz-field-label">Parecer *</label>
              <textarea aria-invalid={!!fieldErrors.parecer} aria-label="Parecer final" placeholder="Explique de forma objetiva a decisão final." value={finalDecision.parecer} onChange={(e) => { setFinalDecision((c) => ({ ...c, parecer: e.target.value })); setFieldErrors((current) => ({ ...current, parecer: null })); }}
                style={{ height: 72, borderRadius: 6, border: "1px solid #CBD5E1", padding: "10px 14px", fontSize: 14, resize: "vertical" }} />
              {fieldErrors.parecer ? <span className="field-error-text">{fieldErrors.parecer}</span> : null}
            </div>
          </div>
          <button type="submit" disabled={busy} className="admin-page-cta" style={{ alignSelf: "flex-start", width: 200 }}>
            {busy ? "Registrando..." : "Registrar decisão final"}
          </button>
        </form>
      </div>
    </div>
  );
}
