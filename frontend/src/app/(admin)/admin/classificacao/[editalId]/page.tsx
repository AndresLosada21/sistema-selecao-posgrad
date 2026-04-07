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
import { listClassificacaoAdmin, recalcularClassificacaoAdmin } from "@/modules/admin-classificacao/api";
import type { ClassificacaoAdminResponse } from "@/modules/admin-classificacao/types";

type Props = { params: Promise<{ editalId: string }> };

export default function AdminClassificacaoDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<ClassificacaoAdminResponse | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { let cancelled = false; params.then((resolved) => { if (!cancelled) setEditalId(resolved.editalId); }); return () => { cancelled = true; }; }, [params]);

  useEffect(() => {
    if (!token || !editalId) return;
    listClassificacaoAdmin(editalId, token, { page, pageSize: 20 })
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage({ type: "error", text: getErrorMessage(error) });
        setStatus("error");
      });
  }, [editalId, page, signOut, token]);

  async function recalculate(publicacao: "PRELIMINAR" | "FINAL") {
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      await recalcularClassificacaoAdmin(editalId, publicacao, token);
      setMessage({ type: "success", text: `Classificacao recalculada em modo ${publicacao}.` });
      const response = await listClassificacaoAdmin(editalId, token, { page, pageSize: 20 });
      setData(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando classificacao" description="Consultando a classificacao do edital." />;
  if (status === "error") return <ErrorState title="Falha ao carregar classificacao" description={message?.text} />;

  const total = data?.total ?? 0;
  const pageItemCount = data?.items.length ?? 0;
  const classificados = data?.items.filter((item) => item.posicaoGeral !== null).length ?? 0;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback description={message.text} title="Retorno operacional" type={message.type} /> : null}

      <SectionCard title={`Classificacao do edital ${editalId ?? ""}`} description="Lista consolidada e operacoes de recalculo no contexto admin.">
        <div className="summary-grid">
          <article className="summary-card"><span>Total no edital</span><strong>{total}</strong></article>
          <article className="summary-card"><span>{`Com posicao na pagina (${pageItemCount} itens)`}</span><strong>{classificados}</strong></article>
        </div>
        <div className="content-item-links">
          <ActionButton disabled={busy} onClick={() => recalculate("PRELIMINAR")} type="button" variant="secondary">Recalcular preliminar</ActionButton>
          <ActionButton disabled={busy} onClick={() => recalculate("FINAL")} type="button">Recalcular final</ActionButton>
          <Link className="nav-link" href={`/admin/publicacoes/${editalId}`}>Abrir publicacoes deste edital</Link>
        </div>
      </SectionCard>
      <SectionCard title="Lista de classificacao" description="Leitura do contrato administrativo de classificacao final por edital.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.candidato.nomeCompleto}</strong><StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge></div>
                <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
                <small>Modalidade: {getStatusLabel(item.modalidadeConcorrencia)}</small>
                <small>Confirmacao acoes afirmativas: {getStatusLabel(item.confirmacaoAcoesAfirmativas ?? "NAO_SE_APLICA")}</small>
                <small>Confirmacao PCD: {getStatusLabel(item.confirmacaoPcd ?? "NAO_SE_APLICA")}</small>
                <small>Nota etapa 1: {item.notaEtapa1 ?? "-"}</small>
                <small>Nota etapa 2: {item.notaEtapa2 ?? "-"}</small>
                <small>Nota final: {item.notaFinal ?? "-"}</small>
                <small>Posicao geral: {item.posicaoGeral ?? "-"}</small>
                <small>Posicao na linha: {item.posicaoLinha ?? "-"}</small>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem classificacao" description="Nenhum item de classificacao foi retornado para este edital." />}
        <div className="content-item-links">
          <ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="ghost">Pagina anterior</ActionButton>
          <small>{`Pagina ${data?.page ?? page}`}</small>
          <ActionButton disabled={(data?.items.length ?? 0) < (data?.pageSize ?? 20)} onClick={() => setPage((current) => current + 1)} type="button" variant="ghost">Proxima pagina</ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}
