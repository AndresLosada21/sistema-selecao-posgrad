"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/shared/page-states";
import { resolveAuthRedirectPath } from "@/lib/auth/next-path";
import { getErrorMessage } from "@/lib/http/api-error";
import { useSession } from "@/lib/auth/session-provider";
import { login, register } from "@/modules/auth/api";

type AuthFormProps = {
  mode: "login" | "cadastro";
  nextPath?: string;
};

const iconLogin = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" x2="3" y1="12" y2="12" />
  </svg>
);

const iconUserPlus = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);

const iconEyeOff = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const iconEye = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <p className="auth-card-desc">Redirecionando para a area adequada.</p>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const response =
        mode === "cadastro"
          ? await register({ nomeCompleto, email, senha, telefone, cpf })
          : await login({ email, senha });

      session.setSessionFromAuthResponse(response);
      router.replace(resolveAuthRedirectPath(nextPath));
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
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
            ? "Autentique-se para acessar os fluxos do processo."
            : "Cadastre a conta base do candidato para acessar os editais."}
        </p>
      </div>

      <form id="auth-form-id" className={formClass} onSubmit={handleSubmit}>
        {!isLogin ? (
          <label className="auth-field">
            <span className="auth-field-label">Nome completo *</span>
            <input className="auth-input" autoComplete="name" onChange={(e) => { setNomeCompleto(e.target.value); setMessage(null); setStatus("idle"); }} required value={nomeCompleto} />
          </label>
        ) : null}

        <label className="auth-field">
          <span className="auth-field-label">E-mail {!isLogin ? "*" : ""}</span>
          <input className="auth-input" autoComplete="email" onChange={(e) => { setEmail(e.target.value); setMessage(null); setStatus("idle"); }} required type="email" value={email} placeholder={isLogin ? "candidato@email.com" : "maria.pereira@email.com"} />
        </label>

        <label className="auth-field">
          <span className="auth-field-label">Senha {!isLogin ? "*" : ""}</span>
          <div className="auth-input-wrapper">
            <input className="auth-input auth-input--with-toggle" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} onChange={(e) => { setSenha(e.target.value); setMessage(null); setStatus("idle"); }} required type={showPassword ? "text" : "password"} value={senha} placeholder="••••••••" />
            <button className="auth-toggle-password" type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar caracteres" : "Mostrar caracteres"}>
              {showPassword ? iconEye : iconEyeOff}
            </button>
          </div>
        </label>

        {!isLogin ? (
          <div className="auth-row">
            <label className="auth-field">
              <span className="auth-field-label">Telefone</span>
              <input className="auth-input" autoComplete="tel" onChange={(e) => { setTelefone(e.target.value); setMessage(null); setStatus("idle"); }} value={telefone} placeholder="(92) 99123-4567" />
            </label>
            <label className="auth-field">
              <span className="auth-field-label">CPF</span>
              <input className="auth-input" autoComplete="off" inputMode="numeric" onChange={(e) => { setCpf(e.target.value); setMessage(null); setStatus("idle"); }} value={cpf} placeholder="000.000.000-00" />
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
