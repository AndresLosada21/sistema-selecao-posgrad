"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listClassificacaoAdmin, recalcularClassificacaoAdmin } from "@/modules/admin-classificacao/api";
import type { ClassificacaoAdminResponse, ClassificacaoAdminItem } from "@/modules/admin-classificacao/types";

type Props = { params: Promise<{ editalId: string }> };

const PAGE_SIZE = 20;

function formatNF(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(2);
}

export default function AdminClassificacaoDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<ClassificacaoAdminResponse | null>(null);
  const [page, setPage] = useState(1);
  const [linhaFilter, setLinhaFilter] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRecalc, setConfirmRecalc] = useState<"PRELIMINAR" | "FINAL" | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((r) => { if (!cancelled) setEditalId(r.editalId); });
    return () => { cancelled = true; };
  }, [params]);

  useAbortableEffect(async (signal) => {
    if (!token || !editalId) return;
    try {
      const response = await listClassificacaoAdmin(editalId, token, { page, pageSize: PAGE_SIZE });
      if (signal.aborted) return;
      setData(response);
      setPageStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(error) });
      setPageStatus("error");
    }
  }, [editalId, page, signOut, token]);

  const linhas = useMemo(() => {
    if (!data?.items) return [];
    const names = new Set<string>();
    for (const item of data.items) {
      if (item.linhaPesquisa?.nome) names.add(item.linhaPesquisa.nome);
    }
    return Array.from(names).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data?.items) return [];
    if (!linhaFilter) return data.items;
    return data.items.filter((item) => item.linhaPesquisa?.nome === linhaFilter);
  }, [data, linhaFilter]);

  // Operational insights
  const totalClassificados = data?.items.filter((i) => i.posicaoGeral !== null).length ?? 0;
  const totalEliminados = data?.items.filter((i) => i.posicaoGeral === null).length ?? 0;
  const semNotaFinal = data?.items.filter((i) => i.notaFinal === null).length ?? 0;
  const mediaGeral = useMemo(() => {
    const notas = (data?.items ?? []).filter((i) => i.notaFinal !== null).map((i) => i.notaFinal as number);
    return notas.length > 0 ? (notas.reduce((a, b) => a + b, 0) / notas.length) : null;
  }, [data]);

  async function recalculate(pub: "PRELIMINAR" | "FINAL") {
    if (!token || !editalId) return;
    setBusy(true);
    setFeedback(null);
    setConfirmRecalc(null);
    try {
      await recalcularClassificacaoAdmin(editalId, pub, token);
      setFeedback({ type: "success", text: `Classificacao recalculada em modo ${pub.toLowerCase()}.` });
      const response = await listClassificacaoAdmin(editalId, token, { page, pageSize: PAGE_SIZE });
      setData(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (pageStatus === "loading") return <LoadingState title="Carregando classificacao" description="Consultando a classificacao do edital." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar classificacao" description={feedback?.text} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const editalNumero = data?.items[0]?.edital?.numero ?? editalId ?? "";

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && <PageFeedback description={feedback.text} title="Retorno" type={feedback.type} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="admin-page-header-left" style={{ flex: 1 }}>
          <h1>Classificacao — Edital {editalNumero}</h1>
          <p>Ranking por posicao geral, linha e modalidade.</p>
        </div>
        <button className="admin-page-cta" disabled={busy} onClick={() => setConfirmRecalc("PRELIMINAR")} type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Recalcular preliminar
        </button>
        <button className="admin-pub-btn-dark" disabled={busy} onClick={() => setConfirmRecalc("FINAL")} type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Recalcular final
        </button>
      </div>

      {/* Confirmation guard for recalculate */}
      {confirmRecalc && (
        <PageFeedback
          type="warning"
          title={`Confirmar recalculo ${confirmRecalc.toLowerCase()}`}
          description={`Esta acao vai recalcular a classificacao ${confirmRecalc.toLowerCase()} para todo o edital. O resultado anterior sera substituido. Confirme para prosseguir.`}
        />
      )}
      {confirmRecalc && (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-page-cta" disabled={busy} onClick={() => recalculate(confirmRecalc)} type="button">
            Confirmar recalculo {confirmRecalc.toLowerCase()}
          </button>
          <button className="admin-pub-btn-preview" onClick={() => setConfirmRecalc(null)} type="button">
            Cancelar
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="admin-summary-cards">
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Total no edital</span>
          <span className="admin-summary-card-value">{data?.total ?? 0}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Classificados</span>
          <span className="admin-summary-card-value">{totalClassificados}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Eliminados / sem posicao</span>
          <span className="admin-summary-card-value">{totalEliminados}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Media NF (classificados)</span>
          <span className="admin-summary-card-value admin-summary-card-value--primary">{mediaGeral !== null ? mediaGeral.toFixed(2) : "—"}</span>
        </div>
      </div>

      {semNotaFinal > 0 && (
        <PageFeedback
          type="warning"
          title={`${semNotaFinal} inscricao(oes) sem nota final`}
          description="Existem inscricoes na classificacao sem nota final calculada. Verifique se todas as etapas foram avaliadas antes do recalculo final."
        />
      )}

      {/* Chips filter por linha */}
      <div className="admin-chip-bar">
        <button
          className={`admin-chip${!linhaFilter ? " admin-chip--active" : ""}`}
          onClick={() => setLinhaFilter(null)}
          type="button"
        >
          Todas as linhas
        </button>
        {linhas.map((l) => (
          <button
            className={`admin-chip${linhaFilter === l ? " admin-chip--active" : ""}`}
            key={l}
            onClick={() => setLinhaFilter(l)}
            type="button"
          >
            {l}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="admin-table">
        <div className="admin-homologacao-table-wrap">
          <table className="admin-homologacao-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>#</th>
                <th style={{ minWidth: 180 }}>Candidato</th>
                <th style={{ minWidth: 140 }}>Linha</th>
                <th style={{ width: 60, textAlign: "center" }}>E1</th>
                <th style={{ width: 60, textAlign: "center" }}>E2</th>
                <th style={{ width: 60, textAlign: "center" }}>NF</th>
                <th style={{ minWidth: 120 }}>Modalidade</th>
                <th style={{ width: 60, textAlign: "center" }}>P. Linha</th>
                <th style={{ width: 80, textAlign: "center" }}>Conf. AA</th>
                <th style={{ width: 80, textAlign: "center" }}>Conf. PCD</th>
                <th style={{ width: 120, textAlign: "center" }}>Situacao</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ textAlign: "center", fontWeight: 700, color: "#1E293B" }}>{item.posicaoGeral ?? "—"}</td>
                  <td className="admin-homologacao-table-primary">{item.candidato.nomeCompleto}</td>
                  <td className="admin-homologacao-table-muted">{item.linhaPesquisa?.nome ?? "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 500, color: "#334155" }}>{item.notaEtapa1 !== null ? item.notaEtapa1.toFixed(1) : "—"}</td>
                  <td style={{ textAlign: "center", fontWeight: 500, color: "#334155" }}>{item.notaEtapa2 !== null ? item.notaEtapa2.toFixed(1) : "—"}</td>
                  <td className="admin-nf-cell" style={{ textAlign: "center" }}>{formatNF(item.notaFinal)}</td>
                  <td className="admin-homologacao-table-muted">{getStatusLabel(item.modalidadeConcorrencia)}</td>
                  <td style={{ textAlign: "center", fontWeight: 500, color: "#334155" }}>{item.posicaoLinha ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <ConfBadge value={item.confirmacaoAcoesAfirmativas} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <ConfBadge value={item.confirmacaoPcd} />
                  </td>
                  <td className="admin-homologacao-table-center">
                    <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: 32, color: "#64748B" }}>
                    Nenhum item de classificacao retornado{linhaFilter ? ` para a linha "${linhaFilter}"` : ""}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="admin-pagination">
          <span>Mostrando {((page - 1) * PAGE_SIZE) + 1}–{((page - 1) * PAGE_SIZE) + (data?.items.length ?? 0)} de {data?.total ?? 0} candidatos</span>
          <div className="admin-pagination-controls">
            <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">&lsaquo;</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button className={`admin-pagination-btn${p === page ? " admin-pagination-btn--active" : ""}`} key={p} onClick={() => setPage(p)} type="button">{p}</button>
            ))}
            <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">&rsaquo;</button>
          </div>
        </div>
      </div>

      {/* Link to publicacoes */}
      <div style={{ display: "flex", gap: 12 }}>
        <Link className="admin-pub-btn-preview" href={`/admin/publicacoes/${editalId}`} style={{ textDecoration: "none" }}>
          Abrir publicacoes deste edital
        </Link>
      </div>
    </div>
  );
}

function ConfBadge({ value }: { value: string | null }) {
  if (!value || value === "NAO_SE_APLICA") return <span className="admin-conf-na">—</span>;
  if (value === "CONFIRMADA") return <span className="admin-conf-ok">Confirmada</span>;
  return <StatusBadge variant={getStatusVariant(value)}>{getStatusLabel(value)}</StatusBadge>;
}
