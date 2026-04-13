"use client";

import Link from "next/link";
import { useState } from "react";

import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listEtapa2 } from "@/modules/admin-etapas/api";
import type { Etapa2ListResponse } from "@/modules/admin-etapas/types";

const PAGE_SIZE = 20;

function EspelhoCell({ liberadoEm, solicitadoEm }: { liberadoEm?: string | null; solicitadoEm?: string | null }) {
  if (liberadoEm) {
    return (
      <span className="admin-espelho-cell admin-espelho-cell--liberado">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Liberado
      </span>
    );
  }
  if (solicitadoEm) {
    return (
      <span className="admin-espelho-cell admin-espelho-cell--solicitado">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        Solicitado
      </span>
    );
  }
  return <span className="admin-espelho-cell admin-espelho-cell--pendente">---</span>;
}

function Etapa2StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "warning" | "success" | "neutral" }> = {
    PENDENTE: { label: "Pendente", variant: "neutral" },
    EM_AVALIACAO: { label: "Pendente", variant: "neutral" },
    PRELIMINAR_PUBLICADA: { label: "Preliminar", variant: "warning" },
    FINAL_PUBLICADA: { label: "Final", variant: "success" },
  };
  const m = map[status] ?? { label: status, variant: "neutral" as const };
  return <StatusBadge variant={m.variant}>{m.label}</StatusBadge>;
}

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

  if (status === "loading") return <LoadingState title="Carregando etapa 2" description="Consultando as inscricoes prontas para analise curricular." />;
  if (status === "error") return <ErrorState title="Nao foi possivel carregar a fila da etapa 2" description={message ?? undefined} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="admin-main-inner">
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Etapa 2 — Titulos</h1>
          <p>Pontuacao de titulos do Anexo II por edital.</p>
        </div>
      </div>

      <div className="admin-list-filter-row" style={{ marginBottom: 16 }}>
        <div style={{ width: 360 }}>
          <AdminEditalCombobox
            allowEmpty
            emptyLabel="Todos os editais"
            label=""
            onChange={setDraftFilter}
            token={token ?? ""}
            value={draftFilter}
            placeholder="Filtrar por edital..."
          />
        </div>
        <button className="admin-page-cta" onClick={() => { setFilter(draftFilter.trim()); setPage(1); }} type="button">
          Aplicar filtro
        </button>
      </div>

      <div className="admin-table">
        <div className="admin-homologacao-table-wrap">
          <table className="admin-homologacao-table">
            <thead>
              <tr>
                <th style={{ minWidth: 200 }}>Candidato</th>
                <th style={{ minWidth: 140 }}>Linha</th>
                <th style={{ minWidth: 100, textAlign: "center" }}>Pont. Bruta</th>
                <th style={{ minWidth: 70, textAlign: "center" }}>Nota</th>
                <th style={{ minWidth: 120, textAlign: "center" }}>Status</th>
                <th style={{ minWidth: 110, textAlign: "center" }}>Espelho</th>
                <th style={{ minWidth: 80, textAlign: "center" }}>Acao</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length ? data.items.map((item) => (
                <tr key={item.id}>
                  <td className="admin-homologacao-table-primary">{item.candidato.nomeCompleto}</td>
                  <td className="admin-homologacao-table-muted">{item.linhaPesquisa?.nome ?? "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700 }}>{item.avaliacao?.pontuacaoBruta ?? "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 700, color: "#2563EB" }}>{item.avaliacao?.notaNormalizada ?? "—"}</td>
                  <td className="admin-homologacao-table-center">
                    <Etapa2StatusBadge status={item.avaliacao?.status ?? item.status} />
                  </td>
                  <td className="admin-homologacao-table-center">
                    <EspelhoCell
                      liberadoEm={item.avaliacao?.espelhoLiberadoEm}
                      solicitadoEm={item.avaliacao?.espelhoSolicitadoEm}
                    />
                  </td>
                  <td className="admin-homologacao-table-center">
                    <Link className="admin-homologacao-table-link" href={`/admin/etapa-2/${item.id}`}>
                      Avaliar
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "#64748B" }}>
                    {filter ? "Nenhuma inscricao deste edital chegou a etapa 2 no filtro atual." : "Nenhuma inscricao esta pronta para avaliacao da etapa 2 neste momento."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span>Mostrando {((data?.page ?? 1) - 1) * (data?.pageSize ?? PAGE_SIZE) + 1}–{((data?.page ?? 1) - 1) * (data?.pageSize ?? PAGE_SIZE) + (data?.items.length ?? 0)} de {data?.total ?? 0} avaliacoes</span>
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
