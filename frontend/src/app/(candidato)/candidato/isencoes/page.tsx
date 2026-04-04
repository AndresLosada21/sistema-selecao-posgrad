"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listIsencoes } from "@/modules/isencao/api";
import type { PedidosIsencaoResponse } from "@/modules/isencao/types";

export default function CandidateIsencoesPage() {
  const session = useSession();
  const [data, setData] = useState<PedidosIsencaoResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) {
      return;
    }

    listIsencoes(session.token)
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
    return <LoadingState title="Carregando pedidos de isencao" description="Consultando os pedidos do candidato." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar isencoes" description={message ?? undefined} />;
  }

  if (!data?.items.length) {
    return <EmptyState title="Sem pedidos de isencao" description="Nenhum pedido de isencao foi registrado por esta conta." />;
  }

  return (
    <SectionCard title="Pedidos de isencao" description="Leitura do historico de pedidos e do resultado administrativo quando disponivel.">
      <div className="content-list">
        {data.items.map((pedido) => (
          <article className="content-item" key={pedido.id}>
            <div className="content-item-row">
              <strong>{pedido.edital.numero}</strong>
              <StatusBadge>{pedido.status}</StatusBadge>
            </div>
            <p>{pedido.edital.titulo}</p>
            <small>Curso: {pedido.cursoNivel}</small>
            <small>CadUnico: {pedido.inscritoCadUnico ? "sim" : "nao"}</small>
            <small>Criado em: {formatIsoDate(pedido.criadoEm)}</small>
            <small>Atualizado em: {formatIsoDate(pedido.atualizadoEm)}</small>
            <small>Parecer final: {pedido.parecerFinal ?? "ainda nao publicado"}</small>
            <div className="content-item-links">
              <Link className="nav-link" href={`/candidato/editais/${pedido.edital.id}`}>
                Abrir acompanhamento do edital
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
