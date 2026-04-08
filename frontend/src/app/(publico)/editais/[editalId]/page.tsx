import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/page-states";
import { ParticiparEditalCta } from "@/components/shared/participar-edital-cta";
import { PublicAccessCta } from "@/components/shared/public-access-cta";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { ApiError } from "@/lib/http/api-error";
import { getEditalById } from "@/modules/edital/api";
import { formatIsoDate, formatSemestre } from "@/modules/edital/formatters";

type EditalPageProps = {
  params: Promise<{ editalId: string }>;
};

const iconCap = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1 4 3 6 3s6-2 6-3v-5" /></svg>;
const iconCal = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>;
const iconHash = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" /></svg>;
const iconDot = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" /></svg>;
const iconNext = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
const iconFlask = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" /><path d="M8.5 2h7" /></svg>;

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-neutral-400)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-neutral-700)" }}>{value}</span>
      </div>
    </div>
  );
}

export default async function EditalDetailPage({ params }: EditalPageProps) {
  const { editalId } = await params;

  try {
    const edital = await getEditalById(editalId);
    const totalVagas = edital.linhasPesquisa.reduce((sum, l) => sum + l.totalVagas, 0);
    const totalAmpla = edital.linhasPesquisa.reduce((sum, l) => sum + l.vagasAmplaConcorrencia, 0);
    const totalCotas = edital.linhasPesquisa.reduce((sum, l) => sum + l.vagasAcoesAfirmativas, 0);
    const totalPcd = edital.linhasPesquisa.reduce((sum, l) => sum + l.vagasPcd, 0);

    return (
      <div className="stack-layout">
        <PageHeader
          breadcrumb={[
            { label: "Editais", href: "/editais" },
            { label: edital.numero },
          ]}
          title={edital.numero}
          description={getStatusLabel(edital.cursoNivel)}
        />

        {/* Card principal */}
        <div className="edital-card">
          <div className="edital-card-top">
            <div className="edital-card-title-row">
              <strong className="edital-card-numero">{edital.numero}</strong>
              <StatusBadge variant={getStatusVariant(edital.status)}>{getStatusLabel(edital.status)}</StatusBadge>
            </div>
            <p className="edital-card-titulo" style={{ fontSize: 16, fontWeight: 600, color: "var(--color-neutral-800)" }}>
              {edital.titulo}
            </p>
            <p className="edital-card-titulo">
              {edital.descricao ?? "Sem descricao publica cadastrada."}
            </p>

            <div style={{ height: 1, background: "var(--color-neutral-100)" }} />

            <div className="edital-card-meta">
              <div className="edital-card-meta-col" style={{ gap: 12 }}>
                <MetaItem icon={iconCap} label="Curso / Nivel" value={getStatusLabel(edital.cursoNivel)} />
                <MetaItem icon={iconCal} label="Publicado em" value={formatIsoDate(edital.publicadoEm)} />
                <MetaItem icon={iconHash} label="Edicao" value={formatSemestre(edital.ano, edital.semestre)} />
              </div>
              <div className="edital-card-meta-col" style={{ gap: 12 }}>
                <MetaItem icon={iconDot} label="Fase atual" value={edital.faseAtual?.titulo ?? "sem fase ativa"} />
                <MetaItem icon={iconNext} label="Proxima fase" value={edital.proximaFase?.titulo ?? "sem previsao imediata"} />
                <MetaItem icon={iconFlask} label="Linhas de pesquisa" value={`${edital.linhasPesquisa.length} linhas disponiveis`} />
              </div>
            </div>
          </div>

          <div className="edital-card-divider" />

          <div className="edital-card-footer">
            <Link className="edital-card-link" href={`/editais/${edital.id}/cronograma`}>
              Ver cronograma
            </Link>
            <Link className="edital-card-link" href={`/editais/${edital.id}/publicacoes`}>
              Ver publicacoes
            </Link>
            <Link className="edital-card-link" href="/candidato/participacoes">
              Abrir area do candidato
            </Link>
            <div className="edital-card-footer-spacer" />
            <ParticiparEditalCta editalId={edital.id} />
            <PublicAccessCta authenticatedHref="/candidato/participacoes" candidateLabel="" nextPath="/candidato/participacoes" />
          </div>
        </div>

        {/* Linhas de pesquisa */}
        <SectionCard title="Linhas de pesquisa" description="Distribuicao de vagas por linha e modalidade de concorrencia.">
          {edital.linhasPesquisa.length ? (
            <table className="linhas-table">
              <thead>
                <tr>
                  <th>Linha de pesquisa</th>
                  <th className="text-center" style={{ width: 80 }}>Ampla</th>
                  <th className="text-center" style={{ width: 80 }}>Cotas</th>
                  <th className="text-center" style={{ width: 80 }}>PCD</th>
                  <th className="text-center" style={{ width: 80 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {edital.linhasPesquisa.map((linha) => (
                  <tr key={linha.id}>
                    <td>
                      <div className="linha-nome">{linha.nome}</div>
                      {linha.descricao ? <div className="linha-desc">{linha.descricao}</div> : null}
                    </td>
                    <td className="text-center">{linha.vagasAmplaConcorrencia}</td>
                    <td className="text-center">{linha.vagasAcoesAfirmativas}</td>
                    <td className="text-center">{linha.vagasPcd}</td>
                    <td className="text-center"><span className="linhas-badge">{linha.totalVagas}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total de vagas</td>
                  <td className="text-center">{totalAmpla}</td>
                  <td className="text-center">{totalCotas}</td>
                  <td className="text-center">{totalPcd}</td>
                  <td className="text-center"><span className="linhas-total-badge">{totalVagas}</span></td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <EmptyState title="Linhas de pesquisa indisponiveis" description="Este edital ainda nao possui linhas de pesquisa publicadas para consulta." />
          )}
        </SectionCard>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
