import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/page-states";
import { ParticiparEditalCta } from "@/components/shared/participar-edital-cta";
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
const iconCalDays = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="M8 14h.01" /><path d="M12 14h.01" /><path d="M16 14h.01" /><path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" /></svg>;
const iconMega = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8 1.4" /></svg>;
const iconUser = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const iconArrowR = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="edital-detail-meta-item">
      <span className="edital-detail-meta-icon">{icon}</span>
      <div className="edital-detail-meta-text">
        <span className="edital-detail-meta-label">{label}</span>
        <span className="edital-detail-meta-value">{value}</span>
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
    const temasPreview = edital.temasRedacao.slice(0, 12);

    return (
      <div className="stack-layout">
        <PageHeader
          breadcrumb={[
            { label: "Editais", href: "/editais" },
            { label: edital.numero },
          ]}
          title=""
        />

        {/* Card principal — conforme Pencil yL3h0 */}
        <div className="edital-detail-card">
          <div className="edital-detail-header">
            <div className="edital-card-title-row">
              <strong className="edital-detail-titulo">{edital.numero}</strong>
              <StatusBadge variant={getStatusVariant(edital.status)}>{getStatusLabel(edital.status)}</StatusBadge>
            </div>
            <p className="edital-detail-subtitle">{edital.titulo}</p>
            <p className="edital-detail-desc">{edital.descricao ?? "Sem descricao publica cadastrada."}</p>

            <div className="edital-detail-divider" />

            <div className="edital-detail-meta-grid">
              <div className="edital-detail-meta-col">
                <MetaItem icon={iconCap} label="Curso / Nivel" value={getStatusLabel(edital.cursoNivel)} />
                <MetaItem icon={iconCal} label="Publicado em" value={formatIsoDate(edital.publicadoEm)} />
                <MetaItem icon={iconHash} label="Edicao" value={formatSemestre(edital.ano, edital.semestre)} />
              </div>
              <div className="edital-detail-meta-col">
                <MetaItem icon={iconDot} label="Fase atual" value={edital.faseAtual?.titulo ?? "sem fase ativa"} />
                <MetaItem icon={iconNext} label="Proxima fase" value={edital.proximaFase?.titulo ?? "sem previsao imediata"} />
                <MetaItem icon={iconFlask} label="Linhas de pesquisa" value={`${edital.linhasPesquisa.length} linhas disponiveis`} />
              </div>
            </div>
          </div>

          <div className="edital-detail-divider" />

          <div className="edital-detail-footer">
            <Link className="edital-card-link" href={`/editais/${edital.id}/cronograma`}>
              <span className="edital-card-link-icon">{iconCalDays}</span>Ver cronograma
            </Link>
            <Link className="edital-card-link" href={`/editais/${edital.id}/publicacoes`}>
              <span className="edital-card-link-icon">{iconMega}</span>Ver publicacoes
            </Link>
            <Link className="edital-card-link" href="/candidato/participacoes">
              <span className="edital-card-link-icon">{iconUser}</span>Abrir area do candidato
            </Link>
            <div className="edital-card-footer-spacer" />
            <ParticiparEditalCta editalId={edital.id} />
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
            <EmptyState title="Linhas de pesquisa indisponiveis" description="Este edital ainda nao possui linhas de pesquisa publicadas." />
          )}
        </SectionCard>

        <SectionCard title="Temas de redacao" description={edital.temasRedacao.length ? `${edital.temasRedacao.length} tema(s) ativo(s) para a proposta de pesquisa deste edital.` : "Este edital nao possui temas ativos publicados no momento."}>
          {edital.temasRedacao.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {temasPreview.map((tema) => (
                  <div key={tema.id} style={{ flex: "1 1 320px", minWidth: 260, border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 14px", background: "#fff" }}>
                    <strong style={{ display: "block", fontSize: 13, color: "#0F172A" }}>{tema.titulo}</strong>
                    {tema.descricao ? <span style={{ display: "block", marginTop: 6, fontSize: 12, color: "#64748B" }}>{tema.descricao}</span> : null}
                  </div>
                ))}
              </div>
              {edital.temasRedacao.length > temasPreview.length ? (
                <details style={{ border: "1px solid #E2E8F0", borderRadius: 12, background: "#F8FAFC", padding: "12px 14px" }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#334155" }}>
                    Ver os {edital.temasRedacao.length - temasPreview.length} temas restantes
                  </summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                    {edital.temasRedacao.slice(temasPreview.length).map((tema) => (
                      <div key={tema.id} style={{ borderTop: "1px solid #E2E8F0", paddingTop: 10 }}>
                        <strong style={{ display: "block", fontSize: 13, color: "#0F172A" }}>{tema.titulo}</strong>
                        {tema.descricao ? <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#64748B" }}>{tema.descricao}</span> : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
              <span style={{ fontSize: 12, color: "#64748B" }}>
                Na inscricao, o candidato pode buscar por palavra-chave antes de selecionar o tema.
              </span>
            </div>
          ) : (
            <EmptyState title="Temas ainda indisponiveis" description="A administracao ainda nao publicou temas ativos para a redacao deste edital." />
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
