import Link from "next/link";

import { ParticiparEditalCta } from "@/components/shared/participar-edital-cta";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { formatIsoDate } from "@/modules/edital/formatters";
import type { EditalListItem } from "@/modules/edital/types";

const iconCap = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5" /></svg>;
const iconCalendar = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;
const iconFlask = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" /><path d="M8.5 2h7" /></svg>;
const iconDot = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" /></svg>;
const iconArrow = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
const iconFile = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;
const iconCalDays = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg>;
const iconMega = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8 1.4" /></svg>;

type EditalCardProps = {
  edital: EditalListItem;
};

export function EditalCard({ edital }: EditalCardProps) {
  return (
    <article className="edital-card">
      <div className="edital-card-top">
        <div className="edital-card-title-row">
          <strong className="edital-card-numero">{edital.numero}</strong>
          <StatusBadge variant={getStatusVariant(edital.status)}>{getStatusLabel(edital.status)}</StatusBadge>
        </div>

        <p className="edital-card-titulo">{edital.titulo}</p>

        <div className="edital-card-meta">
          <div className="edital-card-meta-col">
            <span className="edital-card-meta-item"><span className="edital-card-meta-icon">{iconCap}</span>{getStatusLabel(edital.cursoNivel)}</span>
            <span className="edital-card-meta-item"><span className="edital-card-meta-icon">{iconCalendar}</span>Publicado em: {formatIsoDate(edital.publicadoEm)}</span>
            <span className="edital-card-meta-item"><span className="edital-card-meta-icon">{iconFlask}</span>{edital.linhasPesquisa.length} linhas de pesquisa</span>
          </div>
          <div className="edital-card-meta-col">
            <span className="edital-card-meta-item"><span className="edital-card-meta-icon">{iconDot}</span>Fase atual: {edital.faseAtual?.titulo ?? "sem fase ativa"}</span>
            <span className="edital-card-meta-item"><span className="edital-card-meta-icon">{iconArrow}</span>Proxima fase: {edital.proximaFase?.titulo ?? "sem previsao imediata"}</span>
          </div>
        </div>
      </div>

      <div className="edital-card-divider" />

      <div className="edital-card-footer">
        <Link className="edital-card-link" href={`/editais/${edital.id}`}>
          <span className="edital-card-link-icon">{iconFile}</span>Detalhe do edital
        </Link>
        <Link className="edital-card-link" href={`/editais/${edital.id}/cronograma`}>
          <span className="edital-card-link-icon">{iconCalDays}</span>Cronograma
        </Link>
        <Link className="edital-card-link" href={`/editais/${edital.id}/publicacoes`}>
          <span className="edital-card-link-icon">{iconMega}</span>Publicacoes oficiais
        </Link>
        <div className="edital-card-footer-spacer" />
        <ParticiparEditalCta editalId={edital.id} />
      </div>
    </article>
  );
}
