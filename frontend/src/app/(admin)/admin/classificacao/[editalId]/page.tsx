"use client";

import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { listClassificacaoAdmin, recalcularClassificacaoAdmin } from "@/modules/admin-classificacao/api";
import type { ClassificacaoAdminResponse } from "@/modules/admin-classificacao/types";

type Props = { params: Promise<{ editalId: string }> };

export default function AdminClassificacaoDetailPage({ params }: Props) {
  const session = useSession();
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<ClassificacaoAdminResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { params.then((resolved) => setEditalId(resolved.editalId)); }, [params]);

  useEffect(() => {
    if (!session.token || !editalId) return;
    listClassificacaoAdmin(editalId, session.token)
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) { session.signOut(); return; }
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [editalId, session]);

  async function recalculate(publicacao: "PRELIMINAR" | "FINAL") {
    if (!session.token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      await recalcularClassificacaoAdmin(editalId, publicacao, session.token);
      setMessage(`Classificacao recalculada em modo ${publicacao}.`);
      const response = await listClassificacaoAdmin(editalId, session.token);
      setData(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando classificacao" description="Consultando a classificacao do edital." />;
  if (status === "error") return <ErrorState title="Falha ao carregar classificacao" description={message ?? undefined} />;

  return (
    <div className="stack-layout">
      <SectionCard title={`Classificacao do edital ${editalId ?? ""}`} description="Lista consolidada e operacoes de recalculo no contexto admin.">
        <div className="content-item-links">
          <button className="secondary-button" disabled={busy} onClick={() => recalculate("PRELIMINAR")} type="button">Recalcular preliminar</button>
          <button className="action-button" disabled={busy} onClick={() => recalculate("FINAL")} type="button">Recalcular final</button>
        </div>
      </SectionCard>
      <SectionCard title="Lista de classificacao" description="Leitura do contrato administrativo de classificacao final por edital.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.candidato.nomeCompleto}</strong><StatusBadge>{item.status}</StatusBadge></div>
                <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
                <small>Modalidade: {item.modalidadeConcorrencia}</small>
                <small>Nota etapa 1: {item.notaEtapa1 ?? "-"}</small>
                <small>Nota etapa 2: {item.notaEtapa2 ?? "-"}</small>
                <small>Nota final: {item.notaFinal ?? "-"}</small>
                <small>Posicao geral: {item.posicaoGeral ?? "-"}</small>
                <small>Posicao na linha: {item.posicaoLinha ?? "-"}</small>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem classificacao" description="Nenhum item de classificacao foi retornado para este edital." />}
      </SectionCard>
      {message ? <ErrorState title="Retorno operacional" description={message} /> : null}
    </div>
  );
}
