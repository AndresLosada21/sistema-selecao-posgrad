"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ActionButton } from "@/components/shared/action-button";
import { ErrorState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { resolveAuthRedirectPath } from "@/lib/auth/next-path";
import { getErrorMessage } from "@/lib/http/api-error";
import { useSession } from "@/lib/auth/session-provider";
import { login, register } from "@/modules/auth/api";

type AuthFormProps = {
  mode: "login" | "cadastro";
  nextPath?: string;
};

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

  useEffect(() => {
    if (!session.isAuthenticated) {
      return;
    }

    router.replace(resolveAuthRedirectPath(nextPath));
  }, [nextPath, router, session.isAuthenticated]);

  if (session.isAuthenticated) {
    return (
      <SectionCard
        title={mode === "login" ? "Sessao ja autenticada" : "Conta ja autenticada"}
        description="Voce ja esta autenticado. Redirecionando para a area adequada."
      >
        <p className="muted-text">A navegação sera atualizada automaticamente.</p>
      </SectionCard>
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
    }
  }

  return (
    <SectionCard
      title={mode === "login" ? "Entrar" : "Criar conta"}
      description={mode === "login" ? "Autentique-se para acessar os fluxos do processo." : "Cadastre a conta base do candidato para acessar os editais."}
    >
      <form className="form-grid" onSubmit={handleSubmit}>
        {mode === "cadastro" ? (
          <label className="field-block">
            <span>Nome completo</span>
            <input autoComplete="name" onChange={(event) => { setNomeCompleto(event.target.value); setMessage(null); setStatus("idle"); }} required value={nomeCompleto} />
          </label>
        ) : null}

        <label className="field-block">
          <span>E-mail</span>
          <input autoComplete="email" onChange={(event) => { setEmail(event.target.value); setMessage(null); setStatus("idle"); }} required type="email" value={email} />
        </label>

        <label className="field-block">
          <span>Senha</span>
          <input autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} onChange={(event) => { setSenha(event.target.value); setMessage(null); setStatus("idle"); }} required type="password" value={senha} />
        </label>

        {mode === "cadastro" ? (
          <>
            <label className="field-block">
              <span>Telefone</span>
              <input autoComplete="tel" onChange={(event) => { setTelefone(event.target.value); setMessage(null); setStatus("idle"); }} required value={telefone} />
            </label>
            <label className="field-block">
              <span>CPF</span>
              <input autoComplete="off" inputMode="numeric" onChange={(event) => { setCpf(event.target.value); setMessage(null); setStatus("idle"); }} required value={cpf} />
            </label>
          </>
        ) : null}

        <ActionButton disabled={status === "loading"} loading={status === "loading"} loadingText="Processando..." type="submit">
          {status === "loading" ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
        </ActionButton>
        {mode === "login" ? (
          <div className="content-item-links">
            <Link className="nav-link" href="/esqueci-senha">
              Esqueci minha senha
            </Link>
          </div>
        ) : null}
      </form>

      {message ? <ErrorState description={message} title={mode === "login" ? "Falha ao entrar" : "Falha ao criar conta"} /> : null}
    </SectionCard>
  );
}
