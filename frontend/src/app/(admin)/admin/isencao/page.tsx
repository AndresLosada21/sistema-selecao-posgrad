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
import { listAdminIsencoes } from "@/modules/admin-isencao/api";
import { formatIsoDate } from "@/modules/edital/formatters";
import type { AdminIsencoesResponse } from "@/modules/admin-isencao/types";

export default function AdminIsencaoPage() {
  const session = useSession();
  const [data, setData] = useState<AdminIsencoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) return;
    listAdminIsencoes(session.token)
      .then((response) => { setData(response); setStatus("ready"); })
      .catch((error) => {
        if (isUnauthorizedError(error)) { session.signOut(); return; }
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [session]);

  if (status === "loading") return <LoadingState title="Carregando isencoes" description="Consultando a fila administrativa de isencao." />;
  if (status === "error") return <ErrorState title="Falha ao carregar isencoes" description={message ?? undefined} />;

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
      </SectionCard>
    </div>
  );
}
