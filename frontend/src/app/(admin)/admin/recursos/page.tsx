"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { faseRecursoOptions } from "@/lib/enums";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listRecursosAdmin } from "@/modules/admin-recursos/api";
import type { AdminRecursosResponse } from "@/modules/admin-recursos/types";

const PAGE_SIZE = 20;

export default function AdminRecursosPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<AdminRecursosResponse | null>(null);
  const [draftEdital, setDraftEdital] = useState("");
  const [editalFilter, setEditalFilter] = useState("");
  const [faseFilter, setFaseFilter] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useAbortableEffect(async (signal) => {
    if (!token) return;
    try {
      const r = await listRecursosAdmin(token, { editalId: editalFilter || undefined, fase: faseFilter || undefined, page, pageSize: PAGE_SIZE });
      if (signal.aborted) return;
      setData(r); setStatus("ready");
    } catch (e) {
      if (signal.aborted) return;
      if (isUnauthorizedError(e)) { signOut(); return; }
      setMessage(getErrorMessage(e)); setStatus("error");
    }
  }, [editalFilter, faseFilter, page, signOut, token]);

  if (status === "loading") return <LoadingState title="Carregando recursos" description="Consultando a fila de recursos." />;
  if (status === "error") return <ErrorState title="Falha ao carregar recursos" description={message ?? undefined} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Recursos</h1>
          <p>Fila de recursos interpostos com filtro por edital e fase.</p>
        </div>
      </div>

      <div className="admin-search-bar">
        <span style={{ fontSize: 13, fontWeight: 500, color: "#475569", whiteSpace: "nowrap" }}>Edital:</span>
        <AdminEditalCombobox allowEmpty emptyLabel="Todos" label="" onChange={setDraftEdital} token={token ?? ""} value={draftEdital} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "#475569", whiteSpace: "nowrap" }}>Fase:</span>
        <select className="select-field" onChange={(e) => { setFaseFilter(e.target.value); setPage(1); }} style={{ width: 180 }} value={faseFilter}>
          <option value="">Todas as fases</option>
          {faseRecursoOptions.map((f) => <option key={f} value={f}>{getStatusLabel(f)}</option>)}
        </select>
        <button className="admin-page-cta" onClick={() => { setEditalFilter(draftEdital.trim()); setPage(1); }} type="button">Aplicar</button>
      </div>

      <div className="admin-table">
        <div className="admin-homologacao-table-wrap">
          <table className="admin-homologacao-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Candidato</th>
                <th style={{ minWidth: 120 }}>Edital</th>
                <th style={{ minWidth: 140 }}>Fase</th>
                <th style={{ minWidth: 120, textAlign: "center" }}>Status</th>
                <th style={{ width: 80, textAlign: "center" }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length ? data.items.map((item) => (
                <tr key={item.id}>
                  <td className="admin-homologacao-table-primary">{item.candidato?.nomeCompleto ?? "—"}</td>
                  <td className="admin-homologacao-table-muted">{item.edital?.numero ?? "—"}</td>
                  <td className="admin-homologacao-table-muted">{getStatusLabel(item.fase)}</td>
                  <td className="admin-homologacao-table-center">
                    <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                  </td>
                  <td className="admin-homologacao-table-center">
                    <Link className="admin-homologacao-table-link" href={`/admin/recursos/${item.id}`}>Decidir</Link>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "#64748B" }}>Nenhum recurso encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span>Mostrando {((page - 1) * PAGE_SIZE) + 1}–{((page - 1) * PAGE_SIZE) + (data?.items.length ?? 0)} de {data?.total ?? 0} recursos</span>
          <div className="admin-pagination-controls">
            <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">&lsaquo;</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button className={`admin-pagination-btn${p === page ? " admin-pagination-btn--active" : ""}`} key={p} onClick={() => setPage(p)} type="button">{p}</button>
            ))}
            <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">&rsaquo;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
