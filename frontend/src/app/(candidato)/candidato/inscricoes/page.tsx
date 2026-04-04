"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listInscricoes } from "@/modules/inscricao/api";
import type { CandidateInscricoesResponse } from "@/modules/inscricao/types";

export default function CandidateInscricoesPage() {
  const session = useSession();
  const [data, setData] = useState<CandidateInscricoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) {
      return;
    }

    listInscricoes(session.token)
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          session.signOut();
          return;
        }

        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [session]);

  if (status === "loading") {
    return <LoadingState title="Carregando inscricoes" description="Consultando o historico de inscricoes do candidato." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar inscricoes" description={message ?? undefined} />;
  }

  if (!data?.items.length) {
    return <EmptyState title="Sem inscricoes" description="Nenhuma inscricao foi registrada por esta conta." />;
  }

  return (
    <SectionCard title="Inscricoes do candidato" description="Leitura dedicada do contrato de inscricoes e acesso aos artefatos operacionais retornados pelo backend.">
      <div className="content-list">
        {data.items.map((inscricao) => (
          <article className="content-item" key={inscricao.id}>
            <div className="content-item-row">
              <strong>{inscricao.edital.numero}</strong>
              <StatusBadge>{inscricao.status}</StatusBadge>
            </div>
            <p>{inscricao.edital.titulo}</p>
            <small>Status do pagamento: {inscricao.statusPagamento}</small>
            <small>Linha: {inscricao.linhaPesquisa?.nome ?? "nao definida"}</small>
            <small>Documentos: {inscricao.documentosTotal}</small>
            <small>Submetida em: {formatIsoDate(inscricao.submetidaEm)}</small>
            <div className="content-item-links">
              <Link className="nav-link" href={`/candidato/editais/${inscricao.edital.id}/inscricao`}>
                Abrir inscricao
              </Link>
              <Link className="nav-link" href={inscricao.anexoIvGeradoUrl} target="_blank">
                Link do Anexo IV
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
