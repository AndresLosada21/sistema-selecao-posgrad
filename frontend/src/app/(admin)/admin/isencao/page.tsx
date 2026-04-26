"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { AdminStatusFilter } from "@/components/shared/admin-status-filter";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { statusIsencaoOptions } from "@/lib/enums";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { listAdminIsencoes } from "@/modules/admin-isencao/api";
import type { AdminIsencoesResponse } from "@/modules/admin-isencao/types";

const iconChevL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
const iconChevR = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;

export default function AdminIsencaoPage() {
  const session = useSession();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AdminIsencoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [draftFilter, setDraftFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");

  useAbortableEffect(async (signal) => {
    if (!session.token) return;
    try {
      const response = await listAdminIsencoes(session.token, { editalId: filter || undefined, status: statusFilter || undefined, page, pageSize: 20 });
      if (signal.aborted) return;
      setData(response); setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error)); setStatus("error");
    }
  }, [filter, page, session.signOut, session.token, statusFilter]);

  if (status === "loading") return <LoadingState title="Carregando isencoes" description="Consultando os pedidos de isencao da fila." />;
  if (status === "error") return <ErrorState title="Nao foi possivel carregar a fila de isencao" description={message ?? undefined} />;

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Isencao de taxa</h1>
          <p>Acompanhe os pedidos de isencao e abra cada um para analise.</p>
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

      <AdminStatusFilter
        ariaLabel="Filtrar isencoes por status"
        onChange={(value) => { setStatusFilter(value); setPage(1); }}
        options={[{ value: "", label: "Todos" }, ...statusIsencaoOptions.filter((value) => value !== "NAO_SOLICITADA").map((value) => ({ value, label: getStatusLabel(value) }))]}
        value={statusFilter}
      />

      {data?.items.length ? (
        <div className="admin-table">
          <div className="admin-homologacao-table-wrap">
            <table className="admin-homologacao-table" style={{ minWidth: 720 }}>
              <caption className="sr-only">Fila administrativa de pedidos de isencao</caption>
              <thead>
                <tr>
                  <th scope="col">Candidato</th>
                  <th scope="col" style={{ minWidth: 140 }}>Edital</th>
                  <th scope="col" style={{ width: 100, textAlign: "center" }}>CadUnico</th>
                  <th scope="col" style={{ width: 120, textAlign: "center" }}>Status</th>
                  <th scope="col" style={{ width: 80, textAlign: "center" }}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="admin-homologacao-table-primary">{item.candidato.nomeCompleto}</td>
                    <td className="admin-homologacao-table-muted">{item.edital.numero}</td>
                    <td className="admin-homologacao-table-center">{item.inscritoCadUnico ? "Sim" : "Nao"}</td>
                    <td className="admin-homologacao-table-center">
                      <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                    </td>
                    <td className="admin-homologacao-table-center">
                      <Link className="admin-homologacao-table-link" href={`/admin/isencao/${item.id}`}>
                        {item.status === "SOLICITADA" ? "Analisar" : "Ver"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      ) : <EmptyState title="Nenhum pedido na fila" description="Nao ha pedidos de isencao aguardando consulta nesta pagina." />}
    </div>
  );
}
