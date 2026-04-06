import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/page-states";
import { PublicAccessCta } from "@/components/shared/public-access-cta";
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
        <SectionCard
          title={`Publicacoes oficiais de ${edital.numero}`}
          description="Leitura publica do historico versionado de publicacoes e acesso aos PDFs oficiais."
        >
          <div className="content-list">
              {publicacoes.items.map((publicacao) => (
                <article className="content-item" key={publicacao.id}>
                  <div className="content-item-row">
                    <strong>{publicacao.titulo}</strong>
                    <StatusBadge variant={getStatusVariant(publicacao.tipo)}>{getStatusLabel(publicacao.tipo)}</StatusBadge>
                  </div>
                  <p>{publicacao.descricao ?? "Sem descricao publica cadastrada."}</p>
                  <small>Versao: {publicacao.versao}</small>
                  <small>Versao final: {publicacao.versaoFinal ? "sim" : "nao"}</small>
                  <small>Publicado em: {formatIsoDate(publicacao.publicadoEm)}</small>
                  <small>Historico: {publicacao.republicacaoDeId ? "republicacao vinculada a versao anterior" : "publicacao inicial"}</small>
                  <div className="content-item-links">
                    <Link className="nav-link" href={resolveApiUrl(publicacao.arquivoUrl)} rel="noreferrer" target="_blank">
                      Abrir PDF oficial
                    </Link>
                  </div>
              </article>
            ))}
          </div>
          <div className="content-item-links">
            <PublicAccessCta authenticatedHref="/candidato/participacoes" candidateLabel="Abrir area do candidato" nextPath="/candidato/participacoes" />
          </div>
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
