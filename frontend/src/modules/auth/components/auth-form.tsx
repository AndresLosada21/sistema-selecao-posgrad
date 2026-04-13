"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/shared/page-states";
import { resolveAuthRedirectPath } from "@/lib/auth/next-path";
import { getErrorMessage, getFirstFormError, pickLabeledFieldErrors } from "@/lib/http/api-error";
import { useSession } from "@/lib/auth/session-provider";
import { login, register } from "@/modules/auth/api";
import { formatCpf, formatPhone, normalizeCpf, normalizeEmail, normalizePhone } from "@/modules/auth/input-format";

type AuthFormProps = {
  mode: "login" | "cadastro";
  nextPath?: string;
};

const iconLogin = (
  <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" />
  </svg>
);

const iconUserPlus = (
  <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);

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

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const session = useSession();

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const resetStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetStatusTimeoutRef.current) {
      clearTimeout(resetStatusTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    if (!session.isAuthenticated) return;
    router.replace(resolveAuthRedirectPath(nextPath));
  }, [nextPath, router, session.isAuthenticated]);

  if (session.isAuthenticated) {
    return (
      <div className="auth-center">
        <div className="auth-card">
          <div className="auth-card-header">
            <strong className="auth-card-title">Sessao ja autenticada</strong>
            <p className="auth-card-desc">Voce ja esta logado. Vamos levar voce para a area correta.</p>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    setFieldErrors({});

    try {
      const response =
        mode === "cadastro"
          ? await register({
              nomeCompleto: nomeCompleto.trim(),
              email: normalizeEmail(email),
              senha,
              telefone: telefone ? normalizePhone(telefone) : undefined,
              cpf: cpf ? normalizeCpf(cpf) : undefined,
            })
          : await login({ email: normalizeEmail(email), senha });

      session.setSessionFromAuthResponse(response);
      router.replace(resolveAuthRedirectPath(nextPath));
    } catch (error) {
      setStatus("error");
      setFieldErrors(pickLabeledFieldErrors(error, {
        nomeCompleto: "o nome completo",
        email: "o e-mail",
        senha: "a senha",
        telefone: "o telefone",
        cpf: "o CPF",
      }));
      setMessage(getFirstFormError(error) ?? getErrorMessage(error));
    } finally {
      if (resetStatusTimeoutRef.current) {
        clearTimeout(resetStatusTimeoutRef.current);
      }
      resetStatusTimeoutRef.current = setTimeout(() => {
        setStatus((current) => current === "loading" ? "idle" : current);
      }, 3000);
    }
  }

  const isLogin = mode === "login";
  const cardClass = isLogin ? "auth-card" : "auth-card auth-card--compact";
  const formClass = isLogin ? "auth-form" : "auth-form auth-form--compact";

  return (
    <div className="auth-center">
    <div className={cardClass}>
      <div className="auth-card-header">
        <span className="auth-card-icon">{isLogin ? iconLogin : iconUserPlus}</span>
        <strong className="auth-card-title">{isLogin ? "Entrar" : "Criar conta"}</strong>
        <p className="auth-card-desc">
          {isLogin
            ? "Entre para acompanhar sua inscricao e acessar seus editais."
            : "Crie sua conta para participar dos editais."}
        </p>
      </div>

      <form id="auth-form-id" className={formClass} onSubmit={handleSubmit}>
        {!isLogin ? (
          <label className="auth-field">
            <span className="auth-field-label">Nome completo *</span>
            <input aria-invalid={!!fieldErrors.nomeCompleto} className="auth-input" autoComplete="name" onChange={(e) => { setNomeCompleto(e.target.value); setMessage(null); setStatus("idle"); setFieldErrors((current) => ({ ...current, nomeCompleto: null })); }} required value={nomeCompleto} />
            {fieldErrors.nomeCompleto ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.nomeCompleto}</span> : null}
          </label>
        ) : null}

        <label className="auth-field">
          <span className="auth-field-label">E-mail {!isLogin ? "*" : ""}</span>
          <input aria-invalid={!!fieldErrors.email} className="auth-input" autoComplete="email" onChange={(e) => { setEmail(e.target.value); setMessage(null); setStatus("idle"); setFieldErrors((current) => ({ ...current, email: null })); }} required type="email" value={email} placeholder={isLogin ? "candidato@email.com" : "maria.pereira@email.com"} />
          {fieldErrors.email ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.email}</span> : null}
        </label>

        <label className="auth-field">
          <span className="auth-field-label">Senha {!isLogin ? "*" : ""}</span>
          <div className="auth-input-wrapper">
            <input aria-invalid={!!fieldErrors.senha} className="auth-input auth-input--with-toggle" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} onChange={(e) => { setSenha(e.target.value); setMessage(null); setStatus("idle"); setFieldErrors((current) => ({ ...current, senha: null })); }} required type={showPassword ? "text" : "password"} value={senha} placeholder="••••••••" />
            <button className="auth-toggle-password" type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar caracteres" : "Mostrar caracteres"}>
              {showPassword ? iconEye : iconEyeOff}
            </button>
          </div>
          {fieldErrors.senha ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.senha}</span> : null}
        </label>

        {!isLogin ? (
          <div className="auth-row">
            <label className="auth-field">
              <span className="auth-field-label">Telefone</span>
              <input aria-invalid={!!fieldErrors.telefone} className="auth-input" autoComplete="tel" inputMode="tel" onChange={(e) => { setTelefone(formatPhone(e.target.value)); setMessage(null); setStatus("idle"); setFieldErrors((current) => ({ ...current, telefone: null })); }} value={telefone} placeholder="(92) 99123-4567" />
              {fieldErrors.telefone ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.telefone}</span> : null}
            </label>
            <label className="auth-field">
              <span className="auth-field-label">CPF</span>
              <input aria-invalid={!!fieldErrors.cpf} className="auth-input" autoComplete="off" inputMode="numeric" onChange={(e) => { setCpf(formatCpf(e.target.value)); setMessage(null); setStatus("idle"); setFieldErrors((current) => ({ ...current, cpf: null })); }} value={cpf} placeholder="000.000.000-00" />
              {fieldErrors.cpf ? <span className="auth-field-hint auth-field-hint--error">{fieldErrors.cpf}</span> : null}
            </label>
          </div>
        ) : null}
      </form>

      <button className="auth-submit" disabled={status === "loading"} type="submit" form="auth-form-id">
        {status === "loading" ? "Processando..." : isLogin ? "Entrar" : "Criar conta"}
      </button>

      {message ? (
        <ErrorState description={message} title={isLogin ? "Falha ao entrar" : "Falha ao criar conta"} />
      ) : null}

      <div className="auth-links">
        {isLogin ? (
          <Link className="auth-link" href="/esqueci-senha">Esqueci minha senha</Link>
        ) : null}

        <div className="auth-divider-row">
          <span className="auth-divider" />
          <span className="auth-divider-text">ou</span>
          <span className="auth-divider" />
        </div>

        <span className="auth-switch-row">
          {isLogin ? "Não tem conta? " : "Já tem conta? "}
          <Link className="auth-link-strong" href={isLogin ? "/criar-conta" : "/entrar"}>
            {isLogin ? "Criar conta" : "Entrar"}
          </Link>
        </span>
      </div>
    </div>
    </div>
  );
}
