"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionButton } from "@/components/shared/action-button";
import { FileField } from "@/components/shared/file-field";
import { ErrorState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { sanitizePayload } from "@/lib/http/sanitize";
import { createIsencao } from "@/modules/isencao/api";
import { uploadPrivateFile } from "@/modules/upload/api";

type IsencaoFormProps = {
  editalId: string;
  cursoNivel: "MESTRADO" | "DOUTORADO";
};

export function IsencaoForm({ editalId, cursoNivel }: IsencaoFormProps) {
  const router = useRouter();
  const session = useSession();
  const signOut = session.signOut;
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [inscritoCadUnico, setInscritoCadUnico] = useState(false);
  const [nis, setNis] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [comprovanteNomeArquivo, setComprovanteNomeArquivo] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const justificativaValida = inscritoCadUnico || justificativa.trim().length >= 10;
  const comprovanteValido = inscritoCadUnico || Boolean(comprovanteUrl && comprovanteNomeArquivo);
  const canSubmit = status !== "loading" && justificativaValida && comprovanteValido;

  async function handleComprovanteSelect(file: File) {
    if (!session.token) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      setComprovanteUrl(uploaded.urlArquivo);
      setComprovanteNomeArquivo(uploaded.nomeArquivo);
      setStatus("idle");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setStatus("error");
      setMessage({ type: "error", text: getErrorMessage(error) });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session.token) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      await createIsencao(
        editalId,
        sanitizePayload({
          cursoNivel,
          inscritoCadUnico,
          nis: nis || undefined,
          justificativa: inscritoCadUnico ? undefined : justificativa || undefined,
          comprovanteUrl: inscritoCadUnico ? undefined : comprovanteUrl || undefined,
          comprovanteNomeArquivo: inscritoCadUnico ? undefined : comprovanteNomeArquivo || undefined,
        }),
        session.token,
      );

      setStatus("idle");
      setMessage({ type: "success", text: "Pedido registrado com sucesso. Redirecionando para o acompanhamento do edital." });
      redirectTimeoutRef.current = setTimeout(() => router.replace(`/candidato/editais/${editalId}`), 900);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setStatus("error");
      setMessage({ type: "error", text: getErrorMessage(error) });
    }
  }

  useEffect(() => () => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
  }, []);

  return (
    <SectionCard title="Novo pedido de isencao" description="Formulario alinhado ao contrato backend do pedido de isencao por edital.">
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field-block">
          <span>Curso vinculado ao edital</span>
          <input disabled value={cursoNivel} />
        </label>

        <label className="field-inline">
          <input checked={inscritoCadUnico} onChange={(event) => setInscritoCadUnico(event.target.checked)} type="checkbox" />
          <span>Inscrito no CadUnico</span>
        </label>

        <label className="field-block">
          <span>NIS</span>
          <input onChange={(event) => setNis(event.target.value)} value={nis} />
        </label>

        {!inscritoCadUnico ? (
          <>
            <label className="field-block">
              <span>Justificativa</span>
              <textarea className="text-area" minLength={10} onChange={(event) => setJustificativa(event.target.value)} value={justificativa} />
            </label>

            <FileField
              disabled={status === "loading"}
              hint={comprovanteNomeArquivo ? `Arquivo selecionado: ${comprovanteNomeArquivo}` : "Envie o comprovante em PDF."}
              label="Comprovante"
              onFileSelect={handleComprovanteSelect}
            />
          </>
        ) : null}

        <ActionButton disabled={!canSubmit} loading={status === "loading"} type="submit">
          {status === "loading" ? "Enviando..." : "Registrar pedido de isencao"}
        </ActionButton>
      </form>

      {message ? message.type === "success" ? <PageFeedback type="success" title="Pedido de isencao registrado" description={message.text} /> : <ErrorState title="Falha ao registrar isencao" description={message.text} /> : null}
    </SectionCard>
  );
}
