"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { listParticipacoes } from "@/modules/participacao/api";
import type { ParticipacoesResponse } from "@/modules/participacao/types";

export default function CandidateParticipacoesPage() {
  const session = useSession();
  const [data, setData] = useState<ParticipacoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) {
      return;
    }

    listParticipacoes(session.token)
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
    return <LoadingState title="Carregando participacoes" description="Consultando os vinculos do candidato com editais." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar participacoes" description={message ?? undefined} />;
  }

  if (!data?.items.length) {
    return <EmptyState title="Sem participacoes" description="Nenhum edital esta vinculado a esta conta no momento." />;
  }

  return (
    <SectionCard title="Participacoes por edital" description="Leitura dedicada do contrato de participacoes do candidato.">
      <div className="content-list">
        {data.items.map((participacao) => (
          <article className="content-item" key={participacao.id}>
            <div className="content-item-row">
              <strong>{participacao.edital.numero}</strong>
              <StatusBadge>{participacao.status}</StatusBadge>
            </div>
            <p>{participacao.edital.titulo}</p>
            <small>Curso: {participacao.edital.cursoNivel}</small>
            <small>Status do edital: {participacao.edital.status}</small>
            <small>Pedido de isencao: {participacao.pedidoIsencao?.status ?? "SEM_PEDIDO"}</small>
            <small>Inscricao: {participacao.inscricao?.status ?? "SEM_INSCRICAO"}</small>
            <div className="content-item-links">
              <Link className="nav-link" href={`/candidato/editais/${participacao.edital.id}`}>
                Ver acompanhamento
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
