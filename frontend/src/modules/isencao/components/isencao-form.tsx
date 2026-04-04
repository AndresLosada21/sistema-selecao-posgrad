"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { createIsencao } from "@/modules/isencao/api";

type IsencaoFormProps = {
  editalId: string;
  cursoNivel: "MESTRADO" | "DOUTORADO";
};

export function IsencaoForm({ editalId, cursoNivel }: IsencaoFormProps) {
  const router = useRouter();
  const session = useSession();

  const [inscritoCadUnico, setInscritoCadUnico] = useState(false);
  const [nis, setNis] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [comprovanteNomeArquivo, setComprovanteNomeArquivo] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

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
        {
          cursoNivel,
          inscritoCadUnico,
          nis: nis || undefined,
          justificativa: inscritoCadUnico ? undefined : justificativa || undefined,
          comprovanteUrl: inscritoCadUnico ? undefined : comprovanteUrl || undefined,
          comprovanteNomeArquivo: inscritoCadUnico ? undefined : comprovanteNomeArquivo || undefined,
        },
        session.token,
      );

      router.replace("/candidato/isencoes");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        session.signOut();
        return;
      }

      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }

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
              <textarea className="text-area" onChange={(event) => setJustificativa(event.target.value)} value={justificativa} />
            </label>

            <label className="field-block">
              <span>URL do comprovante</span>
              <input onChange={(event) => setComprovanteUrl(event.target.value)} value={comprovanteUrl} />
            </label>

            <label className="field-block">
              <span>Nome do arquivo do comprovante</span>
              <input onChange={(event) => setComprovanteNomeArquivo(event.target.value)} value={comprovanteNomeArquivo} />
            </label>
          </>
        ) : null}

        <button className="action-button" disabled={status === "loading"} type="submit">
          {status === "loading" ? "Enviando..." : "Registrar pedido de isencao"}
        </button>
      </form>

      {message ? <ErrorState title="Falha ao registrar isencao" description={message} /> : null}
    </SectionCard>
  );
}
