"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { PageFeedback } from "@/components/shared/page-feedback";
import { getErrorMessage, getFirstFormError, pickLabeledFieldErrors } from "@/lib/http/api-error";
import { requestPasswordReset } from "@/modules/auth/api";
import { normalizeEmail } from "@/modules/auth/input-format";

const iconKey = (
  <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const iconArrowLeft = (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
  </svg>
);

export default function ForgotPasswordPage() {
  const canShowTokenPreview = process.env.NEXT_PUBLIC_SHOW_DEV_TOOLS === "true";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null); setTokenPreview(null); setEmailError(null);
    try {
      const response = await requestPasswordReset({ email: normalizeEmail(email) });
      setMessage({ type: "success", text: "Se o e-mail estiver apto para recuperacao, enviaremos as orientacoes para redefinir a senha." });
      setTokenPreview(response.resetTokenPreview ?? null);
    } catch (error) {
      setEmailError(pickLabeledFieldErrors(error, { email: "o e-mail" }).email);
      setMessage({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-center">
      {message ? (
        <div style={{ width: 440, maxWidth: "100%" }}>
          <PageFeedback type={message.type} title="Recuperacao de senha" description={message.text} />
        </div>
      ) : null}

      <div className="auth-card">
        <div className="auth-card-header">
          <span className="auth-card-icon-raw">{iconKey}</span>
          <strong className="auth-card-title">Esqueci minha senha</strong>
          <p className="auth-card-desc">Informe seu e-mail para receber as instrucoes de redefinicao de senha.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field-label">E-mail</span>
            <input aria-invalid={!!emailError} className="auth-input" onChange={(e) => { setEmail(e.target.value); setEmailError(null); }} required type="email" value={email} placeholder="seu@email.com" />
            {emailError ? <span className="auth-field-hint auth-field-hint--error">{emailError}</span> : null}
          </label>

          <button className="auth-submit" disabled={busy} type="submit">
            {busy ? "Processando..." : "Solicitar recuperação"}
          </button>
        </form>

        {tokenPreview && canShowTokenPreview ? (
          <div className="auth-token-preview">
            <small>Preview de desenvolvimento:</small>
            <code>{tokenPreview}</code>
            <Link className="auth-link" href={`/redefinir-senha?token=${encodeURIComponent(tokenPreview)}`}>
              Abrir redefinicao com este token
            </Link>
          </div>
        ) : null}

        <Link className="auth-back-link" href="/entrar">
          {iconArrowLeft} Voltar ao login
        </Link>
      </div>
    </div>
  );
}
