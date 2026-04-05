import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/page-states";
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

export default async function EditalDetailPage({ params }: EditalPageProps) {
  const { editalId } = await params;

  try {
    const edital = await getEditalById(editalId);

    return (
      <div className="stack-layout">
        <SectionCard
          title={`${edital.numero} · ${edital.cursoNivel}`}
          description="Detalhe publico do edital, usando o contrato consolidado do backend."
        >
            <div className="content-list">
              <div className="content-item-row">
                <strong>{edital.titulo}</strong>
                <StatusBadge variant={getStatusVariant(edital.status)}>{getStatusLabel(edital.status)}</StatusBadge>
              </div>
              <p>{edital.descricao ?? "Sem descricao publica cadastrada."}</p>
              <small>Curso: {getStatusLabel(edital.cursoNivel)}</small>
              <small>Edicao: {formatSemestre(edital.ano, edital.semestre)}</small>
              <small>Publicado em: {formatIsoDate(edital.publicadoEm)}</small>
              <small>Fase atual: {edital.faseAtual?.titulo ?? "sem fase ativa"}</small>
            <small>Proxima fase: {edital.proximaFase?.titulo ?? "sem previsao imediata"}</small>
            <div className="content-item-links">
              <Link className="nav-link" href={`/editais/${edital.id}/cronograma`}>
                Ver cronograma
              </Link>
                <Link className="nav-link" href={`/editais/${edital.id}/publicacoes`}>
                  Ver publicacoes
                </Link>
                <PublicAccessCta authenticatedHref="/candidato/participacoes" candidateLabel="Abrir area do candidato" nextPath="/candidato/participacoes" />
              </div>
            </div>
        </SectionCard>

        <SectionCard title="Linhas de pesquisa" description="Leitura publica das linhas e distribuicao de vagas por edital.">
          {edital.linhasPesquisa.length ? (
            <div className="content-list">
              {edital.linhasPesquisa.map((linha) => (
                <article className="content-item" key={linha.id}>
                  <strong>{linha.nome}</strong>
                  <p>{linha.descricao ?? "Sem descricao cadastrada."}</p>
                  <small>Total de vagas: {linha.totalVagas}</small>
                  <small>Ampla concorrencia: {linha.vagasAmplaConcorrencia}</small>
                  <small>Acoes afirmativas: {linha.vagasAcoesAfirmativas}</small>
                  <small>PCD: {linha.vagasPcd}</small>
                </article>
              ))}
            </div>
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
