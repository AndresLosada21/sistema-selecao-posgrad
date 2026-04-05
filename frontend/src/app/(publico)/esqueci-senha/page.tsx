"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { getErrorMessage } from "@/lib/http/api-error";
import { requestPasswordReset } from "@/modules/auth/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(null); setTokenPreview(null);
    try {
      const response = await requestPasswordReset({ email });
      setMessage({ type: "success", text: "Se a conta existir e estiver apta, a recuperacao foi solicitada." });
      setTokenPreview(response.resetTokenPreview ?? null);
    } catch (error) {
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Recuperacao de senha" description={message.text} /> : null}
      <SectionCard title="Esqueci minha senha" description="Solicite um token temporario para redefinir a senha da sua conta.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field-block"><span>E-mail</span><input onChange={(e) => setEmail(e.target.value)} required type="email" value={email} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Solicitar recuperacao</ActionButton>
        </form>
        {tokenPreview ? <div className="content-item"><small>Preview de desenvolvimento:</small><code>{tokenPreview}</code><div className="content-item-links"><Link className="nav-link" href={`/redefinir-senha?token=${encodeURIComponent(tokenPreview)}`}>Abrir redefinicao com este token</Link></div></div> : null}
      </SectionCard>
    </div>
  );
}
