import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
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

export default async function CronogramaPage({ params }: CronogramaPageProps) {
  const { editalId } = await params;

  try {
    const edital = await getEditalById(editalId);

    if (!edital.cronogramas.length) {
      return <EmptyState title="Cronograma indisponivel" description="Este edital nao possui fases publicas cadastradas." />;
    }

    return (
      <SectionCard title={`Cronograma de ${edital.numero}`} description="Leitura ordenada das fases publicas retornadas pelo backend.">
        <div className="content-list">
          {edital.cronogramas.map((cronograma) => (
            <article className="content-item" key={`${cronograma.tipo}-${cronograma.inicioEm}`}>
              <div className="content-item-row">
                <strong>{cronograma.titulo}</strong>
                <StatusBadge>{resolveCronogramaStatus(cronograma)}</StatusBadge>
              </div>
              <small>Tipo: {cronograma.tipo}</small>
              <small>Inicio: {formatIsoDate(cronograma.inicioEm)}</small>
              <small>Fim: {formatIsoDate(cronograma.fimEm)}</small>
            </article>
          ))}
        </div>
      </SectionCard>
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
