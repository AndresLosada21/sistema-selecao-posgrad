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
import { formatIsoDate } from "@/modules/edital/formatters";
import { faseRecursoOptions } from "@/modules/admin-operacao/constants";
import { listRecursosAdmin } from "@/modules/admin-recursos/api";
import type { AdminRecursosResponse } from "@/modules/admin-recursos/types";

export default function AdminRecursosPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<AdminRecursosResponse | null>(null);
  const [draftEditalId, setDraftEditalId] = useState("");
  const [draftFase, setDraftFase] = useState("");
  const [editalId, setEditalId] = useState("");
  const [fase, setFase] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    listRecursosAdmin(token, { editalId: editalId || undefined, fase: fase || undefined, page, pageSize: 20 })
      .then((response) => { setData(response); setStatus("ready"); })
      .catch((error) => {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage(getErrorMessage(error)); setStatus("error");
      });
  }, [editalId, fase, page, signOut, token]);

  if (status === "loading") return <LoadingState title="Carregando recursos" description="Consultando a fila administrativa de recursos." />;
  if (status === "error") return <ErrorState title="Falha ao carregar recursos" description={message ?? undefined} />;

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Fila administrativa de recursos"
        description="Use filtros apenas quando precisar restringir a consulta. Sem filtros aplicados, a pagina busca a fila administrativa completa de recursos."
      />

      <SectionCard title="Filtros de recursos" description="Filtra a fila administrativa por edital e fase.">
        <div className="form-grid">
          <label className="field-block"><span>ID do edital</span><input onChange={(e) => setDraftEditalId(e.target.value)} value={draftEditalId} /></label>
          <label className="field-block"><span>Fase</span><select className="select-field" onChange={(e) => setDraftFase(e.target.value)} value={draftFase}><option value="">todas</option>{faseRecursoOptions.map((value) => <option key={value} value={value}>{getStatusLabel(value)}</option>)}</select></label>
        </div>
        <div className="content-item-links">
          <ActionButton onClick={() => { setEditalId(draftEditalId.trim()); setFase(draftFase); }} type="button" variant="secondary">Aplicar filtros</ActionButton>
          <ActionButton onClick={() => { setDraftEditalId(""); setDraftFase(""); setEditalId(""); setFase(""); setPage(1); }} type="button" variant="ghost">Limpar filtros</ActionButton>
          <Link className="nav-link" href="/editais">Consultar editais publicados</Link>
        </div>
      </SectionCard>

      <SectionCard title="Fila de recursos" description="Lista administrativa e acesso ao detalhe de decisao do recurso.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.candidato.nomeCompleto}</strong><StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge></div>
                <small>Fase: {getStatusLabel(item.fase)}</small>
                <small>Edital: {item.edital.numero}</small>
                <small>Criado em: {formatIsoDate(item.criadoEm)}</small>
                <small>Respondido em: {formatIsoDate(item.respondidoEm)}</small>
                <div className="content-item-links"><Link className="nav-link" href={`/admin/recursos/${item.id}`}>Abrir detalhe</Link></div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem recursos" description="Nenhum recurso foi retornado para os filtros atuais." />}
        <div className="content-item-links">
          <ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="ghost">Pagina anterior</ActionButton>
          <small>{`Pagina ${data?.page ?? page}`}</small>
          <ActionButton disabled={(data?.items.length ?? 0) < (data?.pageSize ?? 20)} onClick={() => setPage((current) => current + 1)} type="button" variant="ghost">Proxima pagina</ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}
