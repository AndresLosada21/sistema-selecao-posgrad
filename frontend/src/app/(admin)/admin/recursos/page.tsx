"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { faseRecursoOptions } from "@/modules/admin-operacao/constants";
import { listRecursosAdmin } from "@/modules/admin-recursos/api";
import type { AdminRecursosResponse } from "@/modules/admin-recursos/types";

export default function AdminRecursosPage() {
  const session = useSession();
  const [data, setData] = useState<AdminRecursosResponse | null>(null);
  const [editalId, setEditalId] = useState("");
  const [fase, setFase] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) return;
    listRecursosAdmin(session.token, { editalId: editalId || undefined, fase: fase || undefined })
      .then((response) => { setData(response); setStatus("ready"); })
      .catch((error) => {
        if (isUnauthorizedError(error)) { session.signOut(); return; }
        setMessage(getErrorMessage(error)); setStatus("error");
      });
  }, [editalId, fase, session]);

  if (status === "loading") return <LoadingState title="Carregando recursos" description="Consultando a fila administrativa de recursos." />;
  if (status === "error") return <ErrorState title="Falha ao carregar recursos" description={message ?? undefined} />;

  return (
    <div className="stack-layout">
      <SectionCard title="Filtros de recursos" description="Filtra a fila administrativa por edital e fase.">
        <div className="form-grid">
          <label className="field-block"><span>ID do edital</span><input onChange={(e) => setEditalId(e.target.value)} value={editalId} /></label>
          <label className="field-block"><span>Fase</span><select className="select-field" onChange={(e) => setFase(e.target.value)} value={fase}><option value="">todas</option>{faseRecursoOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
      </SectionCard>

      <SectionCard title="Fila de recursos" description="Lista administrativa e acesso ao detalhe de decisao do recurso.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.candidato.nomeCompleto}</strong><StatusBadge>{item.status}</StatusBadge></div>
                <small>Fase: {item.fase}</small>
                <small>Edital: {item.edital.numero}</small>
                <small>Criado em: {formatIsoDate(item.criadoEm)}</small>
                <small>Respondido em: {formatIsoDate(item.respondidoEm)}</small>
                <div className="content-item-links"><Link className="nav-link" href={`/admin/recursos/${item.id}`}>Abrir detalhe</Link></div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem recursos" description="Nenhum recurso foi retornado para os filtros atuais." />}
      </SectionCard>
    </div>
  );
}
