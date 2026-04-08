"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { sanitizePayload } from "@/lib/http/sanitize";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { FileField } from "@/components/shared/file-field";
import { uploadPrivateFile } from "@/modules/upload/api";
import { faseRecursoOptions } from "@/modules/admin-operacao/constants";
import { listCandidateRecursos, createCandidateRecurso } from "@/modules/recurso/api";
import type { CandidateRecursosResponse } from "@/modules/recurso/types";
import type { FaseRecurso } from "@/lib/enums";

const iconChevronDown = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
const iconPaperclip = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;

export default function CandidateRecursosPage() {
  const session = useSession();
  const searchParams = useSearchParams();
  const preEditalId = searchParams?.get("editalId") ?? "";

  const [dashboard, setDashboard] = useState<CandidateDashboardResponse | null>(null);
  const [recursos, setRecursos] = useState<CandidateRecursosResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  // form state
  const [formEditalId, setFormEditalId] = useState(preEditalId);
  const [formFase, setFormFase] = useState<string>(faseRecursoOptions[0]);
  const [formFundamentacao, setFormFundamentacao] = useState("");
  const [formAnexoUrl, setFormAnexoUrl] = useState("");
  const [formAnexoNome, setFormAnexoNome] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!session.token) return;
    setStatus("loading");
    try {
      const [d, r] = await Promise.all([getCandidateDashboard(session.token), listCandidateRecursos(session.token)]);
      setDashboard(d); setRecursos(r); setStatus("ready");
      if (!formEditalId && d.items.length) setFormEditalId(d.items[0].edital.id);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error)); setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.signOut, session.token]);

  useAbortableEffect(async (signal) => { await load(); if (signal.aborted) return; }, [load]);

  const editais = useMemo(() => dashboard?.items.map((i) => i.edital) ?? [], [dashboard]);

  async function handleUpload(file: File) {
    if (!session.token) return;
    setUploading(true); setMessage(null);
    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      setFormAnexoUrl(uploaded.urlArquivo); setFormAnexoNome(uploaded.nomeArquivo);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setUploading(false); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session.token || !formEditalId || !formFundamentacao.trim()) return;
    setSubmitting(true); setMessage(null);
    try {
      await createCandidateRecurso(sanitizePayload({
        editalId: formEditalId,
        fase: formFase as FaseRecurso,
        fundamentacao: formFundamentacao,
        anexoUrl: formAnexoUrl || undefined,
      }), session.token);
      setFormFundamentacao(""); setFormAnexoUrl(""); setFormAnexoNome("");
      const r = await listCandidateRecursos(session.token);
      setRecursos(r);
      setMessage(null);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setSubmitting(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando recursos" description="Consultando recursos do candidato." />;
  if (status === "error") return <ErrorState title="Falha ao carregar recursos" description={message ?? undefined} />;

  const items = recursos?.items ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="part-header"><h1>Recursos</h1><p>Interpor novo recurso ou acompanhar recursos ja interpostos.</p></div>

      {message ? <div style={{ padding: "12px 16px", background: "#FEF2F2", borderRadius: 6, color: "#991B1B", fontSize: 13 }}>{message}</div> : null}

      {/* Form card */}
      <div className="part-card" style={{ padding: "24px 28px" }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Novo recurso</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 20 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div className="wiz-field" style={{ flex: 1 }}>
              <label className="wiz-field-label">Edital *</label>
              <select value={formEditalId} onChange={(e) => setFormEditalId(e.target.value)} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                {editais.map((ed) => <option key={ed.id} value={ed.id}>{ed.numero}</option>)}
              </select>
            </div>
            <div className="wiz-field" style={{ flex: 1 }}>
              <label className="wiz-field-label">Fase *</label>
              <select value={formFase} onChange={(e) => setFormFase(e.target.value)} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }}>
                {faseRecursoOptions.map((f) => <option key={f} value={f}>{getStatusLabel(f)}</option>)}
              </select>
            </div>
          </div>
          <div className="wiz-field">
            <label className="wiz-field-label">Fundamentacao *</label>
            <textarea placeholder="Descreva os fundamentos do recurso..." value={formFundamentacao} onChange={(e) => setFormFundamentacao(e.target.value)}
              style={{ height: 100, borderRadius: 6, border: "1px solid #CBD5E1", padding: "10px 14px", fontSize: 14, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <FileField disabled={uploading} hint={formAnexoNome || "Anexo PDF (opcional)"} label="" onFileSelect={handleUpload} />
            <span style={{ flex: 1 }} />
            <button type="submit" disabled={submitting || !formFundamentacao.trim()} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: submitting ? 0.5 : 1 }}>
              {submitting ? "Enviando..." : "Enviar recurso"}
            </button>
          </div>
        </form>
      </div>

      {/* History card */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", flex: 1 }}>Recursos interpostos</span>
          <span style={{ fontSize: 13, color: "#94A3B8" }}>{items.length === 1 ? "1 recurso" : `${items.length} recursos`}</span>
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />
        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Nenhum recurso interposto ainda.</div>
        ) : items.map((rec) => (
          <div key={rec.id} style={{ padding: "14px 24px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>Recurso — {getStatusLabel(rec.fase)}</span>
              <StatusBadge variant={getStatusVariant(rec.status)}>{getStatusLabel(rec.status)}</StatusBadge>
            </div>
            <p style={{ fontSize: 13, color: "#64748B", margin: "4px 0 0" }}>{rec.fundamentacao}</p>
            <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 12, color: "#94A3B8" }}>
              <span>{rec.edital.numero}</span>
              <span>Enviado: {formatIsoDate(rec.criadoEm)}</span>
              {rec.respondidoEm ? <span>Respondido: {formatIsoDate(rec.respondidoEm)}</span> : null}
            </div>
{/* decisao refletida apenas pelo badge de status */}
          </div>
        ))}
      </div>
    </div>
  );
}
