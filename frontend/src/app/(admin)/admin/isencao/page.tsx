"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listAdminIsencoes } from "@/modules/admin-isencao/api";
import { formatIsoDate } from "@/modules/edital/formatters";
import type { AdminIsencoesResponse } from "@/modules/admin-isencao/types";

export default function AdminIsencaoPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<AdminIsencoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [fetchKey, setFetchKey] = useState(0);

  useAbortableEffect(async (signal) => {
    if (!token) return;
    try {
      const response = await listAdminIsencoes(token, { page, pageSize: 20 });
      if (signal.aborted) return;
      setData(response);
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [fetchKey, page, signOut, token]);

  function retryLoad() {
    setMessage(null);
    setStatus("loading");
    setFetchKey((current) => current + 1);
  }

  if (status === "loading") return <LoadingState title="Carregando isencoes" description="Consultando a fila administrativa de isencao." />;
  if (status === "error") {
    return (
      <div className="stack-layout">
        <ErrorState title="Falha ao carregar isencoes" description={message ?? undefined} />
        <div className="content-item-links">
          <ActionButton onClick={retryLoad} type="button" variant="secondary">Tentar novamente</ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <PageFeedback type="info" title="Fila administrativa de isencao" description="Analise os pedidos de isencao, consulte comprovantes e registre as decisoes preliminar e final dentro do ciclo do edital." />
      <SectionCard title="Pedidos de isencao" description={`Foram encontrados ${data?.total ?? 0} pedido(s) na fila administrativa.`}>
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.candidato.nomeCompleto}</strong><StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge></div>
                <small>Edital: {item.edital.numero}</small>
                <small>Curso: {getStatusLabel(item.cursoNivel)}</small>
                <small>CadUnico: {item.inscritoCadUnico ? "sim" : "nao"}</small>
                <small>Criado em: {formatIsoDate(item.criadoEm)}</small>
                <div className="content-item-links"><Link className="nav-link" href={`/admin/isencao/${item.id}`}>Abrir detalhe</Link></div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem pedidos" description="Nenhum pedido de isencao foi localizado na fila administrativa." />}
        <div className="content-item-links">
          <ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="ghost">Pagina anterior</ActionButton>
          <small>{`Pagina ${data?.page ?? page}`}</small>
          <ActionButton disabled={(data?.page ?? page) * (data?.pageSize ?? 20) >= (data?.total ?? 0)} onClick={() => setPage((current) => current + 1)} type="button" variant="ghost">Proxima pagina</ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}
