"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listIsencoes } from "@/modules/isencao/api";
import type { PedidosIsencaoResponse } from "@/modules/isencao/types";

export default function CandidateIsencoesPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<PedidosIsencaoResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setStatus("loading");
    try {
      const response = await listIsencoes(token);
      setData(response);
      setStatus("ready");
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [signOut, token]);

  useAbortableEffect(async (signal) => {
    await load();
    if (signal.aborted) return;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchKey drives manual retry
  }, [load, fetchKey]);

  if (status === "loading") {
    return <LoadingState title="Carregando pedidos de isencao" description="Consultando os pedidos do candidato." />;
  }

  if (status === "error") {
    return (
      <div className="stack-layout">
        <ErrorState title="Falha ao carregar isencoes" description={message ?? undefined} />
        <div className="content-item-links">
          <ActionButton onClick={() => { setMessage(null); setFetchKey((k) => k + 1); }} type="button" variant="secondary">Tentar novamente</ActionButton>
        </div>
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="stack-layout">
        <EmptyState title="Sem pedidos de isencao" description="Nenhum pedido de isencao foi registrado por esta conta." />
        <div className="content-item-links">
          <Link className="nav-link" href="/candidato/participacoes">
            Ver participacoes e iniciar fluxo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Historico de pedidos de isencao"
        description="Consulte o resultado administrativo e volte ao acompanhamento do edital para continuar o fluxo correspondente."
      />

      <SectionCard title="Pedidos de isencao" description={`Foram encontrados ${data.total} pedido(s) vinculados a esta conta.`}>
        <div className="content-list">
          {data.items.map((pedido) => (
            <article className="content-item" key={pedido.id}>
              <div className="content-item-row">
                <strong>{pedido.edital.numero}</strong>
                <StatusBadge variant={getStatusVariant(pedido.status)}>{getStatusLabel(pedido.status)}</StatusBadge>
              </div>
              <p>{pedido.edital.titulo}</p>
              <small>Curso: {getStatusLabel(pedido.cursoNivel)}</small>
              <small>CadUnico: {pedido.inscritoCadUnico ? "sim" : "nao"}</small>
              <small>Criado em: {formatIsoDate(pedido.criadoEm)}</small>
              <small>Atualizado em: {formatIsoDate(pedido.atualizadoEm)}</small>
              <small>Parecer final: {pedido.parecerFinal ?? "ainda nao publicado"}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={`/candidato/editais/${pedido.edital.id}`}>
                  Abrir acompanhamento do edital
                </Link>
                <Link className="nav-link" href={`/candidato/editais/${pedido.edital.id}/inscricao`}>
                  Ir para inscricao do edital
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
