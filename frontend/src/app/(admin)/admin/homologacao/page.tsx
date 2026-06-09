"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { AdminStatusFilter } from "@/components/shared/admin-status-filter";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listInscricoesParaHomologacao } from "@/modules/admin-homologacao/api";
import type { AdminInscricoesHomologacaoResponse } from "@/modules/admin-homologacao/types";

const iconChevL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
const iconChevR = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;
const homologacaoStatusOptions = [
  { value: "", label: "Todos" },
  { value: "PENDENTE", label: "Pendentes" },
  { value: "HOMOLOGADA", label: "Homologadas" },
  { value: "INDEFERIDA", label: "Indeferidas" },
];

export default function AdminHomologacaoPage() {
  const session = useSession();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AdminInscricoesHomologacaoResponse | null>(null);
  const [filter, setFilter] = useState("");
  const [draftFilter, setDraftFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useAbortableEffect(async (signal) => {
    if (!session.token) return;
    try {
      const response = await listInscricoesParaHomologacao(session.token, { editalId: filter || undefined, status: statusFilter || undefined, page, pageSize: 20 });
      if (signal.aborted) return;
      setData(response); setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error)); setStatus("error");
    }
  }, [filter, page, session.signOut, session.token, statusFilter]);

  const stats = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: data?.total ?? 0,
      pendentes: items.filter((i) => !i.homologacao?.statusPreliminar).length,
      homologadas: items.filter((i) => i.homologacao?.statusFinal === "HOMOLOGADA_FINAL").length,
    };
  }, [data]);

  if (status === "loading") return <LoadingState title="Carregando homologacao" description="Consultando a fila de inscricoes para analise." />;
  if (status === "error") return <ErrorState title="Não foi possível carregar a fila de homologação" description={message ?? undefined} />;

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Homologacao</h1>
          <p>Acompanhe as inscricoes prontas para homologacao preliminar e final.</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16 }}>
        <div className="admin-stat-card" style={{ flex: 1 }}><span className="admin-stat-label">Total</span><strong className="admin-stat-value" style={{ fontSize: 24 }}>{stats.total}</strong></div>
        <div className="admin-stat-card" style={{ flex: 1 }}><span className="admin-stat-label" style={{ color: "#92400E" }}>Pendentes</span><strong className="admin-stat-value" style={{ fontSize: 24 }}>{stats.pendentes}</strong></div>
        <div className="admin-stat-card" style={{ flex: 1 }}><span className="admin-stat-label" style={{ color: "#065F46" }}>Homologadas</span><strong className="admin-stat-value" style={{ fontSize: 24 }}>{stats.homologadas}</strong></div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <div style={{ flex: 1, maxWidth: 280 }}>
          <AdminEditalCombobox allowEmpty emptyLabel="Todos os editais" label="Edital" onChange={setDraftFilter} token={session.token ?? ""} value={draftFilter} />
        </div>
        <button type="button" className="admin-page-cta" style={{ height: 40, padding: "0 16px", fontSize: 13 }} onClick={() => { setFilter(draftFilter); setPage(1); }}>Aplicar</button>
        {filter ? <button type="button" style={{ height: 40, padding: "0 16px", fontSize: 13, background: "none", border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", color: "#475569" }} onClick={() => { setDraftFilter(""); setFilter(""); setPage(1); }}>Limpar</button> : null}
      </div>

      <AdminStatusFilter ariaLabel="Filtrar homologacao por status" onChange={(value) => { setStatusFilter(value); setPage(1); }} options={homologacaoStatusOptions} value={statusFilter} />

      {/* Table */}
      {data?.items.length ? (
        <div className="admin-table">
          <div className="admin-homologacao-table-wrap">
            <table className="admin-homologacao-table">
              <caption className="sr-only">Fila administrativa de homologacao de inscricoes</caption>
              <colgroup>
                <col style={{ width: "320px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "190px" }} />
                <col style={{ width: "80px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Candidato</th>
                  <th scope="col">Edital</th>
                  <th scope="col">Linha</th>
                  <th scope="col" className="admin-homologacao-table-center">Inscricao</th>
                  <th scope="col" className="admin-homologacao-table-center">Homologacao</th>
                  <th scope="col" className="admin-homologacao-table-center">Acao</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="admin-homologacao-table-primary">{item.candidato.nomeCompleto}</td>
                    <td className="admin-homologacao-table-muted">{item.edital.numero}</td>
                    <td className="admin-homologacao-table-muted">{item.linhaPesquisa?.nome ?? "—"}</td>
                    <td className="admin-homologacao-table-center">
                      <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                    </td>
                    <td className="admin-homologacao-table-center">
                      <StatusBadge variant={getStatusVariant(item.homologacao?.statusFinal ?? item.homologacao?.statusPreliminar ?? "PENDENTE")}>
                        {getStatusLabel(item.homologacao?.statusFinal ?? item.homologacao?.statusPreliminar ?? "Pendente")}
                      </StatusBadge>
                    </td>
                    <td className="admin-homologacao-table-center">
                      <Link href={`/admin/homologacao/${item.id}`} className="admin-homologacao-table-link">Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination">
            <span>Mostrando {((page - 1) * 20) + 1}-{Math.min(page * 20, data.total)} de {data.total} inscricoes</span>
            <div className="admin-pagination-controls">
              <button type="button" className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{iconChevL}</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} type="button" className={`admin-pagination-btn${page === i + 1 ? " admin-pagination-btn--active" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{iconChevR}</button>
            </div>
          </div>
        </div>
      ) : <EmptyState title="Nenhuma inscricao na fila" description={filter ? "Nenhuma inscricao deste edital chegou a homologacao no filtro atual." : "Nenhuma inscricao esta pronta para homologacao neste momento."} />}
    </div>
  );
}
