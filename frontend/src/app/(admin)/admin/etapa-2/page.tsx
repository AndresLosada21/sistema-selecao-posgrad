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
import { formatIsoDate } from "@/modules/edital/formatters";
import { listEtapa2 } from "@/modules/admin-etapas/api";
import type { Etapa2ListResponse } from "@/modules/admin-etapas/types";

const PAGE_SIZE = 20;

export default function AdminEtapa2Page() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<Etapa2ListResponse | null>(null);
  const [draftFilter, setDraftFilter] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useAbortableEffect(async (signal) => {
    if (!token) return;
    try {
      const response = await listEtapa2(token, { editalId: filter || undefined, page, pageSize: PAGE_SIZE });
      if (signal.aborted) return;
      setData(response);
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [filter, page, signOut, token]);

  if (status === "loading") return <LoadingState title="Carregando etapa 2" description="Consultando a fila administrativa da etapa 2." />;
  if (status === "error") return <ErrorState title="Falha ao carregar etapa 2" description={message ?? undefined} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="admin-main-inner">
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Etapa 2 — Titulos</h1>
          <p>Avaliacao curricular e pontuacao por edital.</p>
        </div>
      </div>

      <div className="admin-search-bar">
        <AdminEditalCombobox
          allowEmpty
          emptyLabel="Todos os editais"
          label="Edital"
          onChange={setDraftFilter}
          token={token ?? ""}
          value={draftFilter}
        />
        <button className="admin-page-cta" onClick={() => { setFilter(draftFilter.trim()); setPage(1); }} type="button">
          Aplicar filtro
        </button>
        {filter && (
          <button
            className="admin-pagination-btn"
            onClick={() => { setDraftFilter(""); setFilter(""); setPage(1); }}
            type="button"
            style={{ width: "auto", padding: "0 12px", fontSize: 13 }}
          >
            Limpar
          </button>
        )}
      </div>

      <div className="admin-table">
        <div className="admin-homologacao-table-wrap">
          <table className="admin-homologacao-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Candidato</th>
                <th style={{ minWidth: 140 }}>Linha</th>
                <th style={{ minWidth: 100, textAlign: "center" }}>Pont. Bruta</th>
                <th style={{ minWidth: 100, textAlign: "center" }}>Nota Norm.</th>
                <th style={{ minWidth: 140, textAlign: "center" }}>Status</th>
                <th style={{ minWidth: 100, textAlign: "center" }}>Status aval.</th>
                <th style={{ minWidth: 90, textAlign: "center" }}>Esp. solicit.</th>
                <th style={{ minWidth: 90, textAlign: "center" }}>Esp. liber.</th>
                <th style={{ minWidth: 80, textAlign: "center" }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length ? data.items.map((item) => (
                <tr key={item.id}>
                  <td className="admin-homologacao-table-primary">{item.candidato.nomeCompleto}</td>
                  <td className="admin-homologacao-table-muted">{item.linhaPesquisa?.nome ?? "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{item.avaliacao?.pontuacaoBruta ?? "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{item.avaliacao?.notaNormalizada ?? "—"}</td>
                  <td className="admin-homologacao-table-center">
                    <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                  </td>
                  <td className="admin-homologacao-table-center" style={{ fontSize: 12 }}>
                    {item.avaliacao?.status ? getStatusLabel(item.avaliacao.status) : "—"}
                  </td>
                  <td className="admin-homologacao-table-center" style={{ fontSize: 12, color: "#475569" }}>
                    {formatIsoDate(item.avaliacao?.espelhoSolicitadoEm ?? null)}
                  </td>
                  <td className="admin-homologacao-table-center" style={{ fontSize: 12, color: "#475569" }}>
                    {formatIsoDate(item.avaliacao?.espelhoLiberadoEm ?? null)}
                  </td>
                  <td className="admin-homologacao-table-center">
                    <Link className="admin-homologacao-table-link" href={`/admin/etapa-2/${item.id}`}>
                      Abrir
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 32, color: "#64748B" }}>
                    Nenhuma inscricao retornada para o filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span>Mostrando {data?.items.length ?? 0} de {data?.total ?? 0} avaliacoes</span>
          <div className="admin-pagination-controls">
            <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">
              &lsaquo;
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                className={`admin-pagination-btn${p === page ? " admin-pagination-btn--active" : ""}`}
                key={p}
                onClick={() => setPage(p)}
                type="button"
              >
                {p}
              </button>
            ))}
            <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">
              &rsaquo;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
