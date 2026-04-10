"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listPoliticas } from "@/modules/admin-politicas/api";
import type { PoliticasListResponse } from "@/modules/admin-politicas/types";

const PAGE_SIZE = 20;

export default function AdminPoliticasPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<PoliticasListResponse | null>(null);
  const [draftFilter, setDraftFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useAbortableEffect(async (signal) => {
    if (!token || !filter) { setStatus("ready"); setData(null); return; }
    try {
      const r = await listPoliticas(filter, token, { page, pageSize: PAGE_SIZE });
      if (signal.aborted) return;
      setData(r); setStatus("ready");
    } catch (e) {
      if (signal.aborted) return;
      if (isUnauthorizedError(e)) { signOut(); return; }
      setMessage(getErrorMessage(e)); setStatus("error");
    }
  }, [filter, page, signOut, token]);

  if (status === "loading") return <LoadingState title="Carregando politicas" description="Consultando a fila." />;
  if (status === "error") return <ErrorState title="Falha ao carregar" description={message ?? undefined} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Politicas Afirmativas</h1>
          <p>Encaminhamento e resultado de heteroidentificacao/PCD por edital.</p>
        </div>
      </div>

      <div className="admin-search-bar">
        <span style={{ fontSize: 13, fontWeight: 500, color: "#475569", whiteSpace: "nowrap" }}>Filtrar por edital:</span>
        <AdminEditalCombobox allowEmpty emptyLabel="Selecione o edital" label="" onChange={setDraftFilter} token={token ?? ""} value={draftFilter} />
        <button className="admin-page-cta" onClick={() => { setFilter(draftFilter.trim()); setPage(1); }} type="button">Aplicar</button>
      </div>

      {!filter ? (
        <EmptyState title="Selecione um edital" description="Use o filtro acima para carregar a fila de politicas afirmativas." />
      ) : !data?.items.length ? (
        <EmptyState title="Sem inscricoes" description="Nenhuma inscricao com politicas afirmativas encontrada para este edital." />
      ) : (
        <div className="admin-table">
          <div className="admin-homologacao-table-wrap">
            <table className="admin-homologacao-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Candidato</th>
                  <th style={{ minWidth: 160 }}>Modalidade</th>
                  <th style={{ minWidth: 160, textAlign: "center" }}>Status</th>
                  <th style={{ minWidth: 120, textAlign: "center" }}>Resultado</th>
                  <th style={{ width: 80, textAlign: "center" }}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const resultado = item.resultadoFinal ?? item.resultadoPreliminar ?? null;
                  return (
                    <tr key={item.id}>
                      <td className="admin-homologacao-table-primary">{item.candidato.nomeCompleto}</td>
                      <td className="admin-homologacao-table-muted">{getStatusLabel(item.inscricao?.modalidadeConcorrencia ?? "—")}</td>
                      <td className="admin-homologacao-table-center">
                        <StatusBadge variant={getStatusVariant(item.statusOperacao)}>{getStatusLabel(item.statusOperacao)}</StatusBadge>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {resultado
                          ? <span style={{ fontWeight: 600, color: resultado === "DEFERIDA" ? "#065F46" : "#991B1B" }}>{getStatusLabel(resultado)}</span>
                          : <span style={{ color: "#94A3B8" }}>Pendente</span>}
                      </td>
                      <td className="admin-homologacao-table-center">
                        <Link className="admin-homologacao-table-link" href={`/admin/politicas-afirmativas/${item.inscricao?.id ?? item.id}?editalId=${filter}`}>Abrir</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>Mostrando {((page - 1) * PAGE_SIZE) + 1}–{((page - 1) * PAGE_SIZE) + data.items.length} de {data.total}</span>
            <div className="admin-pagination-controls">
              <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">&lsaquo;</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button className={`admin-pagination-btn${p === page ? " admin-pagination-btn--active" : ""}`} key={p} onClick={() => setPage(p)} type="button">{p}</button>
              ))}
              <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">&rsaquo;</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
