import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { ApiError } from "@/lib/http/api-error";
import { resolveApiUrl } from "@/lib/config/api";
import { getEditalById } from "@/modules/edital/api";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listPublicacoesByEdital } from "@/modules/publicacao/api";

type PublicacoesPageProps = {
  params: Promise<{ editalId: string }>;
};

const iconFile = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;

export default async function PublicacoesPage({ params }: PublicacoesPageProps) {
  const { editalId } = await params;

  try {
    const [edital, publicacoes] = await Promise.all([
      getEditalById(editalId),
      listPublicacoesByEdital(editalId),
    ]);

    if (!publicacoes.items.length) {
      return (
        <EmptyState
          title={`Sem publicacoes para ${edital.numero}`}
          description="As publicacoes oficiais deste edital ainda nao foram disponibilizadas."
        />
      );
    }

    return (
      <div className="stack-layout">
        <PageHeader
          breadcrumb={[
            { label: "Editais", href: "/editais" },
            { label: edital.numero, href: `/editais/${edital.id}` },
            { label: "Publicacoes" },
          ]}
          title={`Publicacoes oficiais — ${edital.numero}`}
          description="Historico versionado de publicacoes e acesso aos PDFs oficiais."
        />

        <SectionCard title={`Publicacoes de ${edital.numero}`}>
          <div>
            {publicacoes.items.map((publicacao) => (
              <div className="pub-item" key={publicacao.id}>
                <div className="pub-item-content">
                  <div className="pub-item-title-row">
                    <span className="pub-item-title">{publicacao.titulo}</span>
                    <StatusBadge variant={getStatusVariant(publicacao.tipo)}>{getStatusLabel(publicacao.tipo)}</StatusBadge>
                    {publicacao.versaoFinal ? (
                      <StatusBadge variant="success">Versao final</StatusBadge>
                    ) : null}
                  </div>
                  <p className="pub-item-desc">{publicacao.descricao ?? "Sem descricao publica cadastrada."}</p>
                  <div className="pub-item-meta">
                    <span>Versao: {publicacao.versao}</span>
                    <span>Publicado em: {formatIsoDate(publicacao.publicadoEm)}</span>
                    {publicacao.versao > 1 ? <em>Republicacao</em> : null}
                  </div>
                </div>
                <Link className="pub-pdf-btn" href={resolveApiUrl(publicacao.arquivoUrl)} rel="noreferrer" target="_blank">
                  <span style={{ display: "flex" }}>{iconFile}</span>
                  Abrir PDF
                </Link>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="edital-detail-footer" style={{ border: 0 }}>
          <Link className="edital-card-link" href={`/editais/${edital.id}`}>
            <span className="edital-card-link-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg></span>
            Voltar ao edital
          </Link>
          <div className="edital-card-footer-spacer" />
          <Link className="edital-card-link" href="/candidato/participacoes">
            <span className="edital-card-link-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></span>
            Abrir area do candidato
          </Link>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
