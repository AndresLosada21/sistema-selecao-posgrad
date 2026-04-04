"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listPoliticas } from "@/modules/admin-politicas/api";
import type { PoliticasListResponse } from "@/modules/admin-politicas/types";

export default function AdminPoliticasPage() {
  const session = useSession();
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<PoliticasListResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token || !filter) return;
    setStatus("loading");
    listPoliticas(filter, session.token)
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

  return (
    <div className="stack-layout">
      <SectionCard title="Filtro de politicas afirmativas" description="Informe o ID do edital para consultar as etapas vinculadas.">
        <label className="field-block"><span>ID do edital</span><input onChange={(e) => setFilter(e.target.value)} value={filter} /></label>
      </SectionCard>
      {status === "loading" ? <LoadingState title="Carregando etapas" description="Consultando a fila de politicas afirmativas." /> : null}
      {status === "error" ? <ErrorState title="Falha ao carregar politicas afirmativas" description={message ?? undefined} /> : null}
      {status === "ready" ? (
        <SectionCard title="Fila de politicas afirmativas" description="Leitura administrativa da etapa e acesso ao detalhe por inscricao.">
          {data?.items.length ? (
            <div className="content-list">
              {data.items.map((item) => (
                <article className="content-item" key={item.id}>
                  <div className="content-item-row"><strong>{item.candidato.nomeCompleto}</strong><StatusBadge>{item.statusOperacao}</StatusBadge></div>
                  <small>Tipo: {item.tipo}</small>
                  <small>Edital: {item.edital.numero}</small>
                  <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
                  <small>Resultado preliminar: {item.resultadoPreliminar}</small>
                  <small>Resultado final: {item.resultadoFinal}</small>
                  <small>Convocado em: {formatIsoDate(item.convocadoEm)}</small>
                  <div className="content-item-links"><Link className="nav-link" href={`/admin/politicas-afirmativas/${item.inscricao.id}`}>Abrir detalhe</Link></div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="Sem etapas vinculadas" description="Nenhuma etapa de politicas afirmativas foi retornada para o edital informado." />}
        </SectionCard>
      ) : null}
    </div>
  );
}
