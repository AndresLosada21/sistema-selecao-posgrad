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
import { formatIsoDate } from "@/modules/edital/formatters";
import { listIsencoes } from "@/modules/isencao/api";
import type { PedidosIsencaoResponse } from "@/modules/isencao/types";

const iconGradCap = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 10 3 12 0v-5" /></svg>;
const iconCircleCheck = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>;
const iconCalendar = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></svg>;
const iconShield = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;

export default function CandidateIsencoesPage() {
  const session = useSession();
  const [data, setData] = useState<PedidosIsencaoResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const load = useCallback(async () => {
    if (!session.token) return;
    setStatus("loading");
    try {
      const response = await listIsencoes(session.token);
      setData(response); setStatus("ready");
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error)); setStatus("error");
    }
  }, [session.signOut, session.token]);

  useAbortableEffect(async (signal) => {
    await load();
    if (signal.aborted) return;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, fetchKey]);

  if (status === "loading") return <LoadingState title="Carregando pedidos de isenção" description="Consultando seus pedidos..." />;
  if (status === "error") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ErrorState title="Falha ao carregar isencoes" description={message ?? undefined} />
      <ActionButton onClick={() => { setMessage(null); setFetchKey((k) => k + 1); }} type="button" variant="secondary">Tentar novamente</ActionButton>
    </div>
  );
  if (!data?.items.length) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <EmptyState title="Você ainda não pediu isenção" description="Entre em um edital publicado para verificar se ainda há prazo para solicitar isenção da taxa." />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/editais" style={{ fontSize: 13, fontWeight: 600, color: "#2563EB" }}>Ver editais</Link>
        <Link href="/candidato/participacoes" style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>Ver participacoes</Link>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="part-header"><h1>Meus pedidos de isenção</h1><p>Acompanhe os pedidos de isenção enviados em cada edital.</p></div>
      {data.items.map((pedido, i) => {
        const curso = pedido.edital.cursoNivel === "MESTRADO" ? "Mestrado em Eng. Eletrica" : "Doutorado em Eng. Eletrica";
        return (
          <div key={pedido.id} className={`part-card${i > 0 ? " part-card--no-shadow" : ""}`}>
            <div className="part-card-hdr">
              <span className="part-card-title">{pedido.edital.numero} — Isencao de taxa</span>
              <StatusBadge variant={getStatusVariant(pedido.status)}>{getStatusLabel(pedido.status)}</StatusBadge>
            </div>
            <div className="part-card-divider" />
            <div className="part-card-body">
              <div className="part-card-meta">{iconGradCap}<span className="part-card-meta-text">{curso}</span></div>
              <div className="part-card-meta">
                {pedido.inscritoCadUnico ? iconCircleCheck : iconShield}
                <span className="part-card-meta-text">CadÚnico: {pedido.inscritoCadUnico ? "Sim" : "Não"}</span>
              </div>
              <div className="part-card-meta">{iconCalendar}<span className="part-card-meta-text">Resultado: {formatIsoDate(pedido.atualizadoEm)}</span></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
