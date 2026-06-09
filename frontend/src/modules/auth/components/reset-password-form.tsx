"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageFeedback } from "@/components/shared/page-feedback";
import { getErrorMessage, getFirstFormError, pickLabeledFieldErrors } from "@/lib/http/api-error";
import { confirmPasswordReset } from "@/modules/auth/api";

type ResetPasswordFormProps = {
  initialToken: string;
};

const iconLock = (
  <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const iconArrowLeft = (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
  </svg>
);

export function ResetPasswordForm({ initialToken }: ResetPasswordFormProps) {
  const router = useRouter();
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [token, setToken] = useState(initialToken);
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ token?: string | null; senha?: string | null }>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null); setFieldErrors({});
    try {
      await confirmPasswordReset({ token, senha });
      setMessage({ type: "success", text: "Senha redefinida. Você já pode entrar com a nova senha." });
      redirectTimeoutRef.current = setTimeout(() => router.replace("/entrar"), 1200);
    } catch (error) {
      setFieldErrors(pickLabeledFieldErrors(error, {
        token: "o token",
        senha: "a nova senha",
      }));
      setMessage({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  useEffect(() => () => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
  }, []);

  const iconEyeOff = (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );

  const iconEye = (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );

  return (
    <div className="auth-center">
      {message ? (
        <div style={{ width: 440, maxWidth: "100%" }}>
          <PageFeedback type={message.type} title="Redefinir senha" description={message.text} />
        </div>
      ) : null}

      <div className="auth-card auth-card--compact">
        <div className="auth-card-header">
          <span className="auth-card-icon-raw">{iconLock}</span>
          <strong className="auth-card-title">Redefinir senha</strong>
          <p className="auth-card-desc">Cole o token recebido e escolha uma nova senha para entrar novamente.</p>
        </div>

        <form className="auth-form auth-form--compact" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field-label">Token</span>
            <textarea aria-invalid={!!fieldErrors.token} className="auth-textarea" onChange={(e) => { setToken(e.target.value); setFieldErrors((current) => ({ ...current, token: null })); }} required value={token} />
            {fieldErrors.token ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.token}</span> : null}
          </label>

          <label className="auth-field">
            <span className="auth-field-label">Nova senha</span>
            <div className="auth-input-wrapper">
              <input aria-invalid={!!fieldErrors.senha} className="auth-input auth-input--with-toggle" minLength={8} onChange={(e) => { setSenha(e.target.value); setFieldErrors((current) => ({ ...current, senha: null })); }} required type={showPassword ? "text" : "password"} value={senha} placeholder="••••••••" />
              <button className="auth-toggle-password" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar caracteres" : "Mostrar caracteres"}>
                {showPassword ? iconEye : iconEyeOff}
              </button>
            </div>
            {fieldErrors.senha ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.senha}</span> : null}
          </label>

          <button className="auth-submit" disabled={busy} type="submit">
            {busy ? "Processando..." : "Redefinir senha"}
          </button>
        </form>

        <Link className="auth-back-link" href="/entrar">
          {iconArrowLeft} Voltar ao login
        </Link>
      </div>
    </div>
  );
}
