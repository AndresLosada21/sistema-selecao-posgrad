"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
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
      router.replace(nextPath ?? "/candidato");
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
            <input onChange={(event) => setNomeCompleto(event.target.value)} value={nomeCompleto} />
          </label>
        ) : null}

        <label className="field-block">
          <span>E-mail</span>
          <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
        </label>

        <label className="field-block">
          <span>Senha</span>
          <input onChange={(event) => setSenha(event.target.value)} type="password" value={senha} />
        </label>

        {mode === "cadastro" ? (
          <>
            <label className="field-block">
              <span>Telefone</span>
              <input onChange={(event) => setTelefone(event.target.value)} value={telefone} />
            </label>
            <label className="field-block">
              <span>CPF</span>
              <input onChange={(event) => setCpf(event.target.value)} value={cpf} />
            </label>
          </>
        ) : null}

        <button className="action-button" disabled={status === "loading"} type="submit">
          {status === "loading" ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      {message ? <ErrorState description={message} title="Falha na autenticacao" /> : null}
    </SectionCard>
  );
}
