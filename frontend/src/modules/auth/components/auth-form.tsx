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

export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const session = useSession();

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
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
      <div className="auth-card">
        <div className="auth-card-header">
          <strong className="auth-card-title">Sessao ja autenticada</strong>
          <p className="auth-card-desc">Redirecionando para a area adequada.</p>
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

  return (
    <div className="auth-card">
      <div className="auth-card-header">
        <span className="auth-card-icon">{isLogin ? iconLogin : iconUserPlus}</span>
        <strong className="auth-card-title">{isLogin ? "Entrar" : "Criar conta"}</strong>
        <p className="auth-card-desc">
          {isLogin
            ? "Autentique-se para acessar os fluxos do processo."
            : "Cadastre a conta base do candidato para acessar os editais."}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        {!isLogin ? (
          <label className="auth-field">
            <span className="auth-field-label">Nome completo *</span>
            <input className="auth-input" autoComplete="name" onChange={(e) => { setNomeCompleto(e.target.value); setMessage(null); setStatus("idle"); }} required value={nomeCompleto} />
          </label>
        ) : null}

        <label className="auth-field">
          <span className="auth-field-label">E-mail {!isLogin ? "*" : ""}</span>
          <input className="auth-input" autoComplete="email" onChange={(e) => { setEmail(e.target.value); setMessage(null); setStatus("idle"); }} required type="email" value={email} placeholder={isLogin ? "candidato@email.com" : ""} />
        </label>

        <label className="auth-field">
          <span className="auth-field-label">Senha {!isLogin ? "*" : ""}</span>
          <input className="auth-input" autoComplete={isLogin ? "current-password" : "new-password"} minLength={8} onChange={(e) => { setSenha(e.target.value); setMessage(null); setStatus("idle"); }} required type="password" value={senha} />
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

        <button className="auth-submit" disabled={status === "loading"} type="submit">
          {status === "loading" ? "Processando..." : isLogin ? "Entrar" : "Criar conta"}
        </button>
      </form>

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
          {isLogin ? "Nao tem conta? " : "Ja tem conta? "}
          <Link className="auth-link-strong" href={isLogin ? "/criar-conta" : "/entrar"}>
            {isLogin ? "Criar conta" : "Entrar"}
          </Link>
        </span>
      </div>
    </div>
  );
}
