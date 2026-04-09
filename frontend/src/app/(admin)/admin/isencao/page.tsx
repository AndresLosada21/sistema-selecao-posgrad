"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { listAdminIsencoes } from "@/modules/admin-isencao/api";
import type { AdminIsencoesResponse } from "@/modules/admin-isencao/types";

const iconChevL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
const iconChevR = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;

export default function AdminIsencaoPage() {
  const session = useSession();
  const [data, setData] = useState<AdminIsencoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [draftFilter, setDraftFilter] = useState("");

  useAbortableEffect(async (signal) => {
    if (!session.token) return;
    try {
      const response = await listAdminIsencoes(session.token, { page, pageSize: 20 });
      if (signal.aborted) return;
      setData(response); setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error)); setStatus("error");
    }
  }, [page, session.signOut, session.token]);

  if (status === "loading") return <LoadingState title="Carregando isencoes" description="Consultando a fila administrativa." />;
  if (status === "error") return <ErrorState title="Falha ao carregar isencoes" description={message ?? undefined} />;

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Isencao de taxa</h1>
          <p>Fila de pedidos de isencao por edital.</p>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Edital:</span>
        <div style={{ width: 280 }}>
          <AdminEditalCombobox allowEmpty emptyLabel="Todos" label="" onChange={setDraftFilter} token={session.token ?? ""} value={draftFilter} />
        </div>
        <button type="button" className="admin-page-cta" style={{ height: 38, padding: "0 14px", fontSize: 13 }} onClick={() => { setFilter(draftFilter); setPage(1); }}>Aplicar</button>
      </div>

      {data?.items.length ? (
        <div className="admin-table">
          <div className="admin-table-head">
            <span className="admin-table-cell admin-table-cell--grow">Candidato</span>
            <span className="admin-table-cell" style={{ width: 140 }}>Edital</span>
            <span className="admin-table-cell admin-table-cell--center" style={{ width: 100 }}>CadUnico</span>
            <span className="admin-table-cell admin-table-cell--center" style={{ width: 120 }}>Status</span>
            <span className="admin-table-cell admin-table-cell--center" style={{ width: 80 }}>Acao</span>
          </div>
          {data.items.map((item) => (
            <div key={item.id} className="admin-table-row">
              <span className="admin-table-cell admin-table-cell--grow admin-table-cell--bold">{item.candidato.nomeCompleto}</span>
              <span className="admin-table-cell admin-table-cell--muted" style={{ width: 140 }}>{item.edital.numero}</span>
              <span className="admin-table-cell admin-table-cell--center" style={{ width: 100 }}>{item.inscritoCadUnico ? "Sim" : "Nao"}</span>
              <span className="admin-table-cell admin-table-cell--center" style={{ width: 120 }}>
                <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
              </span>
              <span className="admin-table-cell admin-table-cell--center" style={{ width: 80 }}>
                <Link href={`/admin/isencao/${item.id}`} style={{ fontSize: 13, fontWeight: 600, color: "#2563EB", textDecoration: "none" }}>
                  {item.status === "SOLICITADA" ? "Analisar" : "Ver"}
                </Link>
              </span>
            </div>
          ))}
          <div className="admin-pagination">
            <span>Mostrando {((page - 1) * 20) + 1}-{Math.min(page * 20, data.total)} de {data.total} pedidos</span>
            <div className="admin-pagination-controls">
              <button type="button" className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{iconChevL}</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} type="button" className={`admin-pagination-btn${page === i + 1 ? " admin-pagination-btn--active" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{iconChevR}</button>
            </div>
          </div>
        </div>
      ) : <EmptyState title="Sem pedidos" description="Nenhum pedido de isencao na fila." />}
    </div>
  );
}
