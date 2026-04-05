import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/page-states";
import { PublicAccessCta } from "@/components/shared/public-access-cta";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusVariant } from "@/components/shared/status-variant-map";
import { ApiError } from "@/lib/http/api-error";
import { getEditalById } from "@/modules/edital/api";
import { formatIsoDate } from "@/modules/edital/formatters";

type CronogramaPageProps = {
  params: Promise<{ editalId: string }>;
};

function resolveCronogramaStatus(item: { ativaAgora: boolean; futura: boolean; encerrada: boolean }) {
  if (item.ativaAgora) {
    return "EM_ANDAMENTO";
  }

  if (item.futura) {
    return "FUTURA";
  }

  if (item.encerrada) {
    return "ENCERRADA";
  }

  return "SEM_STATUS";
}

function getCronogramaStatusVariant(status: string): StatusVariant {
  if (status === "EM_ANDAMENTO") {
    return "warning";
  }

  if (status === "FUTURA") {
    return "info";
  }

  if (status === "ENCERRADA") {
    return "success";
  }

  return "neutral";
}

function getCronogramaStatusLabel(status: string) {
  if (status === "EM_ANDAMENTO") {
    return "Em andamento";
  }

  if (status === "FUTURA") {
    return "Futura";
  }

  if (status === "ENCERRADA") {
    return "Encerrada";
  }

  return "Sem status";
}

export default async function CronogramaPage({ params }: CronogramaPageProps) {
  const { editalId } = await params;

  try {
    const edital = await getEditalById(editalId);

    if (!edital.cronogramas.length) {
      return <EmptyState title="Cronograma indisponivel" description="Este edital nao possui fases publicas cadastradas." />;
    }

    return (
      <div className="stack-layout">
        <SectionCard title={`Cronograma de ${edital.numero}`} description="Leitura ordenada das fases publicas retornadas pelo backend.">
          <div className="content-list">
            {edital.cronogramas.map((cronograma) => {
              const status = resolveCronogramaStatus(cronograma);

              return (
                <article className="content-item" key={`${cronograma.tipo}-${cronograma.inicioEm}`}>
                  <div className="content-item-row">
                    <strong>{cronograma.titulo}</strong>
                    <StatusBadge variant={getCronogramaStatusVariant(status)}>{getCronogramaStatusLabel(status)}</StatusBadge>
                  </div>
                  <small>Tipo: {cronograma.tipo}</small>
                  <small>Inicio: {formatIsoDate(cronograma.inicioEm)}</small>
                  <small>Fim: {formatIsoDate(cronograma.fimEm)}</small>
                </article>
              );
            })}
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
