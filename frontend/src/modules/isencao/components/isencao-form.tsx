"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PageFeedback } from "@/components/shared/page-feedback";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, getFirstFormError, pickLabeledFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { sanitizePayload } from "@/lib/http/sanitize";
import { FileField } from "@/components/shared/file-field";
import { createIsencao } from "@/modules/isencao/api";
import { uploadPrivateFile } from "@/modules/upload/api";

type IsencaoFormProps = {
  editalId: string;
  editalNumero?: string;
  cursoNivel: "MESTRADO" | "DOUTORADO";
};

const iconArrowLeft = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>;

export function IsencaoForm({ editalId, editalNumero, cursoNivel }: IsencaoFormProps) {
  const router = useRouter();
  const session = useSession();
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inscritoCadUnico, setInscritoCadUnico] = useState(false);
  const [nis, setNis] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [comprovanteNomeArquivo, setComprovanteNomeArquivo] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ justificativa?: string | null; comprovanteUrl?: string | null }>({});

  const justificativaValida = inscritoCadUnico || justificativa.trim().length >= 10;
  const comprovanteValido = inscritoCadUnico || Boolean(comprovanteUrl && comprovanteNomeArquivo);
  const canSubmit = status !== "loading" && justificativaValida && comprovanteValido;

  const cursoLabel = cursoNivel === "MESTRADO" ? "Mestrado em Engenharia Elétrica" : "Doutorado em Engenharia Elétrica";

  async function handleComprovanteSelect(file: File) {
    if (!session.token) return;
    setStatus("loading"); setMessage(null); setFieldErrors((current) => ({ ...current, comprovanteUrl: null }));
    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      setComprovanteUrl(uploaded.urlArquivo);
      setComprovanteNomeArquivo(uploaded.nomeArquivo);
      setStatus("idle");
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setStatus("error"); setMessage({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.token) return;
    setStatus("loading"); setMessage(null); setFieldErrors({});
    try {
      await createIsencao(editalId, sanitizePayload({
        cursoNivel,
        inscritoCadUnico,
        nis: nis || undefined,
        justificativa: inscritoCadUnico ? undefined : justificativa || undefined,
        comprovanteUrl: inscritoCadUnico ? undefined : comprovanteUrl || undefined,
        comprovanteNomeArquivo: inscritoCadUnico ? undefined : comprovanteNomeArquivo || undefined,
      }), session.token);
      setStatus("idle");
      setMessage({ type: "success", text: "Pedido de isenção enviado. Você será redirecionado para acompanhar o status." });
      redirectTimeoutRef.current = setTimeout(() => router.replace(`/candidato/editais/${editalId}`), 900);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setFieldErrors(pickLabeledFieldErrors(error, {
        justificativa: "a justificativa",
        comprovanteUrl: "o comprovante em PDF",
      }));
      setStatus("error"); setMessage({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    }
  }

  useEffect(() => () => { if (redirectTimeoutRef.current) clearTimeout(redirectTimeoutRef.current); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 24 }}>
      {message ? (
        <div style={{ width: 560, maxWidth: "100%" }}>
          <PageFeedback type={message.type} title={message.type === "success" ? "Pedido registrado" : "Falha ao registrar"} description={message.text} />
        </div>
      ) : null}

      <div style={{ width: 560, maxWidth: "100%", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", padding: 36, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Solicitar isenção da taxa</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>Edital {editalNumero ?? ""} — {cursoLabel}</p>
        </div>

        <div style={{ height: 1, background: "#F1F5F9" }} />

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Curso */}
          <div className="wiz-field">
            <label className="wiz-field-label">Curso *</label>
            <input disabled value={cursoLabel} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14, color: "#1E293B", background: "#F8FAFC" }} />
          </div>

          {/* CadUnico */}
          <div className="wiz-field">
            <label className="wiz-field-label">Inscrito no CadUnico?</label>
            <div style={{ display: "flex", gap: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", border: inscritoCadUnico ? "none" : "2px solid #CBD5E1", background: inscritoCadUnico ? "#2563EB" : "#fff", display: "inline-block" }} />
                <input type="radio" name="cadUnico" checked={inscritoCadUnico} onChange={() => setInscritoCadUnico(true)} style={{ display: "none" }} />
                <span style={{ fontSize: 14, color: "#334155" }}>Sim</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", border: !inscritoCadUnico ? "none" : "2px solid #CBD5E1", background: !inscritoCadUnico ? "#2563EB" : "#fff", display: "inline-block" }} />
                <input type="radio" name="cadUnico" checked={!inscritoCadUnico} onChange={() => setInscritoCadUnico(false)} style={{ display: "none" }} />
                 <span style={{ fontSize: 14, color: "#334155" }}>Não</span>
              </label>
            </div>
          </div>

          {/* NIS */}
          <div className="wiz-field">
            <label className="wiz-field-label">NIS (opcional)</label>
            <input aria-invalid={false} placeholder="12345678901" value={nis} onChange={(e) => setNis(e.target.value)} style={{ height: 42, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 14 }} />
          </div>

          {/* Justificativa + Comprovante (apenas quando não CadÚnico) */}
          {!inscritoCadUnico ? (
            <>
              <div className="wiz-field">
                <label className="wiz-field-label">Justificativa *</label>
                <textarea aria-invalid={!!fieldErrors.justificativa} aria-label="Justificativa" minLength={10} value={justificativa} onChange={(e) => { setJustificativa(e.target.value); setFieldErrors((current) => ({ ...current, justificativa: null })); }}
                  style={{ minHeight: 80, borderRadius: 6, border: "1px solid #CBD5E1", padding: "12px 14px", fontSize: 14, resize: "vertical" }}
                  placeholder="Justifique o pedido de isenção (mínimo 10 caracteres)"
                />
                {fieldErrors.justificativa ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.justificativa}</span> : null}
              </div>
              <div className="wiz-field">
                <label className="wiz-field-label">Comprovante (PDF) *</label>
                <FileField
                  disabled={status === "loading"}
                  error={fieldErrors.comprovanteUrl ?? undefined}
                  hint={comprovanteNomeArquivo ? `Arquivo: ${comprovanteNomeArquivo}` : "Arraste ou clique para enviar PDF"}
                  label=""
                  onFileSelect={handleComprovanteSelect}
                />
              </div>
            </>
          ) : null}

          {/* Submit */}
          <button type="submit" disabled={!canSubmit}
            style={{ height: 44, borderRadius: 8, background: canSubmit ? "#2563EB" : "#94A3B8", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed", width: "100%" }}>
            {status === "loading" ? "Enviando..." : "Solicitar isenção"}
          </button>
        </form>

        <Link href={`/candidato/editais/${editalId}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 13, fontWeight: 500, color: "#2563EB", textDecoration: "none" }}>
          {iconArrowLeft} Voltar ao edital
        </Link>
      </div>
    </div>
  );
}
