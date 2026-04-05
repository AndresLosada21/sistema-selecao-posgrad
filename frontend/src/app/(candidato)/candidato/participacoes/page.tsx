"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
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
    return (
      <div className="stack-layout">
        <EmptyState title="Sem participacoes" description="Nenhum edital esta vinculado a esta conta no momento." />
        <div className="content-item-links">
          <Link className="nav-link" href="/editais">
            Ver editais publicados
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Participacoes vinculadas a sua conta"
        description="A partir desta tela voce acompanha em qual edital ja existe vinculo operacional, pedido de isencao ou inscricao associada."
      />

      <SectionCard title="Participacoes por edital" description={`Foram encontradas ${data.total} participacao(oes) vinculadas a esta conta.`}>
        <div className="content-list">
          {data.items.map((participacao) => (
            <article className="content-item" key={participacao.id}>
              <div className="content-item-row">
                <strong>{participacao.edital.numero}</strong>
                <StatusBadge variant={getStatusVariant(participacao.status)}>{getStatusLabel(participacao.status)}</StatusBadge>
              </div>
              <p>{participacao.edital.titulo}</p>
              <small>Curso: {getStatusLabel(participacao.edital.cursoNivel)}</small>
              <small>Status do edital: {getStatusLabel(participacao.edital.status)}</small>
              <small>Pedido de isencao: {getStatusLabel(participacao.pedidoIsencao?.status ?? "SEM_PEDIDO")}</small>
              <small>Inscricao: {getStatusLabel(participacao.inscricao?.status ?? "SEM_INSCRICAO")}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={`/candidato/editais/${participacao.edital.id}`}>
                  Ver acompanhamento
                </Link>
                {!participacao.pedidoIsencao ? (
                  <Link className="nav-link" href={`/candidato/editais/${participacao.edital.id}/isencao/nova`}>
                    Solicitar isencao
                  </Link>
                ) : null}
                <Link className="nav-link" href={`/candidato/editais/${participacao.edital.id}/inscricao`}>
                  Abrir inscricao
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
