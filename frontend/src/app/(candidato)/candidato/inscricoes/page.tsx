"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { downloadAnexoIv, listInscricoes } from "@/modules/inscricao/api";
import type { CandidateInscricoesResponse } from "@/modules/inscricao/types";

const iconGradCap = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 10 3 12 0v-5" /></svg>;
const iconFlask = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" /><path d="M8.5 2h7" /></svg>;
const iconFileText = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;
const iconDownload = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;
const iconArrowRight = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;

export default function CandidateInscricoesPage() {
  const session = useSession();
  const [data, setData] = useState<CandidateInscricoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownloadAnexoIv(inscricaoId: string) {
    if (!session.token) return;
    setDownloadingId(inscricaoId);
    try {
      const result = await downloadAnexoIv(inscricaoId, session.token);
      triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, "anexo-iv.pdf"));
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setDownloadingId(null); }
  }

  useAbortableEffect(async (signal) => {
    if (!session.token) return;
    try {
      const response = await listInscricoes(session.token);
      if (signal.aborted) return;
      setData(response); setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error)); setStatus("error");
    }
  }, [session.signOut, session.token]);

  if (status === "loading") return <LoadingState title="Carregando inscricoes" description="Consultando suas inscricoes..." />;
  if (status === "error") return <ErrorState title="Falha ao carregar inscricoes" description={message ?? undefined} />;
  if (!data?.items.length) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <EmptyState title="Você ainda não iniciou nenhuma inscrição" description="Entre em um edital publicado para liberar o envio da sua inscrição." />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/editais" style={{ fontSize: 13, fontWeight: 600, color: "#2563EB" }}>Ver editais</Link>
        <Link href="/candidato/participacoes" style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>Ver participacoes</Link>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="part-header"><h1>Minhas inscricoes</h1><p>Veja o que ja foi iniciado ou enviado nos editais em que voce participa.</p></div>
      {data.items.map((insc, i) => {
        const curso = insc.edital.cursoNivel === "MESTRADO" ? "Mestrado em Eng. Eletrica" : "Doutorado em Eng. Eletrica";
        return (
          <div key={insc.id} className="part-card">
            <div className="part-card-hdr">
              <span className="part-card-title">{insc.edital.numero}</span>
              <StatusBadge variant={getStatusVariant(insc.status)}>{getStatusLabel(insc.status)}</StatusBadge>
            </div>
            <div className="part-card-divider" />
            <div className="part-card-body">
              <div className="part-card-meta">{iconGradCap}<span className="part-card-meta-text">{curso}</span></div>
              {insc.linhaPesquisa ? <div className="part-card-meta">{iconFlask}<span className="part-card-meta-text">{insc.linhaPesquisa.nome}</span></div> : null}
              <div className="part-card-meta">{iconFileText}<span className="part-card-meta-text">{insc.documentosTotal} documentos</span></div>
              <span className="part-card-spacer" />
              <div style={{ display: "flex", gap: 12 }}>
                {insc.anexoIvGeradoUrl ? (
                  <button type="button" onClick={() => handleDownloadAnexoIv(insc.id)} disabled={downloadingId === insc.id}
                    className="part-card-link" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}>
                    {iconDownload} {downloadingId === insc.id ? "Baixando..." : "Anexo IV"}
                  </button>
                ) : null}
                <Link href={`/candidato/editais/${insc.edital.id}/inscricao`} className="part-card-link" style={{ fontWeight: 600 }}>Editar {iconArrowRight}</Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
