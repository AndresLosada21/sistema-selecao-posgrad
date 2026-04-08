"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listParticipacoes } from "@/modules/participacao/api";
import type { ParticipacoesResponse } from "@/modules/participacao/types";

/* ---- icons (Pencil-aligned) ---- */

const iconFileText = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
);
const iconShieldCheck = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
);
const iconArrowRight = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);

/* ---- page ---- */

export default function CandidateParticipacoesPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<ParticipacoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setStatus("loading");
    try {
      const response = await listParticipacoes(token);
      setData(response);
      setStatus("ready");
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [signOut, token]);

  useAbortableEffect(async (signal) => {
    await load();
    if (signal.aborted) return;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, fetchKey]);

  if (status === "loading") return <LoadingState title="Carregando participacoes" description="Consultando os vinculos do candidato com editais." />;

  if (status === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ErrorState title="Falha ao carregar participacoes" description={message ?? undefined} />
        <ActionButton onClick={() => { setMessage(null); setFetchKey((k) => k + 1); }} type="button" variant="secondary">Tentar novamente</ActionButton>
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <EmptyState title="Sem participacoes" description="Nenhum edital esta vinculado a esta conta no momento." />
        <Link href="/editais" style={{ fontSize: 13, fontWeight: 500, color: "#2563EB" }}>Ver editais publicados</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Page header */}
      <div className="part-header">
        <h1>Minhas participacoes</h1>
        <p>Editais vinculados a sua conta no PPGEE/UFAM.</p>
      </div>

      {/* Cards */}
      {data.items.map((p, i) => {
        const editalLabel = `${p.edital.numero} — ${p.edital.cursoNivel === "MESTRADO" ? "Mestrado" : "Doutorado"} em Engenharia Eletrica`;
        const badgeVariant = getStatusVariant(p.edital.status);
        const badgeLabel = getStatusLabel(p.edital.status);
        const inscLabel = `Inscricao: ${getStatusLabel(p.inscricao?.status ?? "SEM_INSCRICAO")}`;
        const isenLabel = `Isencao: ${getStatusLabel(p.pedidoIsencao?.status ?? "NAO_SOLICITADA")}`;
        const hasShadow = i === 0;

        return (
          <div key={p.id} className={`part-card${hasShadow ? "" : " part-card--no-shadow"}`}>
            <div className="part-card-hdr">
              <span className="part-card-title">{editalLabel}</span>
              <StatusBadge variant={badgeVariant}>{badgeLabel}</StatusBadge>
            </div>
            <div className="part-card-divider" />
            <div className="part-card-body">
              <div className="part-card-meta">
                {iconFileText}
                <span className="part-card-meta-text">{inscLabel}</span>
              </div>
              {p.pedidoIsencao ? (
                <div className="part-card-meta">
                  {iconShieldCheck}
                  <span className="part-card-meta-text">{isenLabel}</span>
                </div>
              ) : null}
              <span className="part-card-spacer" />
              <Link href={`/candidato/editais/${p.edital.id}`} className="part-card-link">
                Acompanhar
                {iconArrowRight}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
