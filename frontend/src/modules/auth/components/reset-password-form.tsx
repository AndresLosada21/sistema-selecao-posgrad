"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ActionButton } from "@/components/shared/action-button";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { getErrorMessage } from "@/lib/http/api-error";
import { confirmPasswordReset } from "@/modules/auth/api";

type ResetPasswordFormProps = {
  initialToken: string;
};

export function ResetPasswordForm({ initialToken }: ResetPasswordFormProps) {
  const router = useRouter();
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
      setTimeout(() => router.replace("/entrar"), 1200);
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Redefinir senha" description={message.text} /> : null}
      <SectionCard title="Redefinir senha" description="Informe o token recebido e a nova senha da conta.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field-block"><span>Token</span><textarea className="text-area" onChange={(e) => setToken(e.target.value)} required value={token} /></label>
          <label className="field-block"><span>Nova senha</span><input minLength={8} onChange={(e) => setSenha(e.target.value)} required type="password" value={senha} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Redefinir senha</ActionButton>
        </form>
      </SectionCard>
    </div>
  );
}
