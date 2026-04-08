"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageFeedback } from "@/components/shared/page-feedback";
import { getErrorMessage } from "@/lib/http/api-error";
import { confirmPasswordReset } from "@/modules/auth/api";

type ResetPasswordFormProps = {
  initialToken: string;
};

const iconLock = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const iconArrowLeft = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
  </svg>
);

export function ResetPasswordForm({ initialToken }: ResetPasswordFormProps) {
  const router = useRouter();
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [token, setToken] = useState(initialToken);
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null);
    try {
      await confirmPasswordReset({ token, senha });
      setMessage({ type: "success", text: "Senha redefinida com sucesso. Voce ja pode entrar com a nova credencial." });
      redirectTimeoutRef.current = setTimeout(() => router.replace("/entrar"), 1200);
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  useEffect(() => () => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
  }, []);

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
          <p className="auth-card-desc">Informe o token recebido e a nova senha da conta.</p>
        </div>

        <form className="auth-form auth-form--compact" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field-label">Token</span>
            <textarea className="auth-textarea" onChange={(e) => setToken(e.target.value)} required value={token} />
          </label>

          <label className="auth-field">
            <span className="auth-field-label">Nova senha</span>
            <input className="auth-input" minLength={8} onChange={(e) => setSenha(e.target.value)} required type="password" value={senha} />
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
