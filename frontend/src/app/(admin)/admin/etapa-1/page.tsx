"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { getEspelhoEtapa1, listEtapa1 } from "@/modules/admin-etapas/api";
import type { Etapa1ListResponse } from "@/modules/admin-etapas/types";

export default function AdminEtapa1Page() {
  const session = useSession();
  const [data, setData] = useState<Etapa1ListResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) return;

    listEtapa1(session.token, filter || undefined)
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
  }, [filter, session]);

  if (status === "loading") return <LoadingState title="Carregando etapa 1" description="Consultando a fila administrativa da etapa 1." />;
  if (status === "error") return <ErrorState title="Falha ao carregar etapa 1" description={message ?? undefined} />;

  return (
    <div className="stack-layout">
      <SectionCard title="Filtro da etapa 1" description="Filtra a fila pelo edital quando necessario.">
        <label className="field-block">
          <span>ID do edital</span>
          <input onChange={(event) => setFilter(event.target.value)} value={filter} />
        </label>
      </SectionCard>

      <SectionCard title="Fila da etapa 1" description="Lista administrativa das inscricoes aptas para avaliacao e leitura do espelho.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row">
                  <strong>{item.candidato.nomeCompleto}</strong>
                  <StatusBadge>{item.status}</StatusBadge>
                </div>
                <small>Edital: {item.edital.numero}</small>
                <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
                <small>Nota atual: {item.avaliacao?.nota ?? "sem nota"}</small>
                <small>Status da avaliacao: {item.avaliacao?.status ?? "sem avaliacao"}</small>
                <small>Espelho solicitado em: {formatIsoDate(item.avaliacao?.espelhoSolicitadoEm ?? null)}</small>
                <small>Espelho liberado em: {formatIsoDate(item.avaliacao?.espelhoLiberadoEm ?? null)}</small>
                <div className="content-item-links">
                  <Link className="nav-link" href={`/admin/etapa-1/${item.id}`}>
                    Abrir detalhe
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem inscricoes para etapa 1" description="Nenhuma inscricao foi retornada para o filtro atual." />
        )}
      </SectionCard>
    </div>
  );
}
