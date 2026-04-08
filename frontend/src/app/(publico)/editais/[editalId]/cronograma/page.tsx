import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
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
  if (item.ativaAgora) return "EM_ANDAMENTO";
  if (item.futura) return "FUTURA";
  if (item.encerrada) return "ENCERRADA";
  return "SEM_STATUS";
}

function getCronogramaStatusVariant(status: string): StatusVariant {
  if (status === "EM_ANDAMENTO") return "warning";
  if (status === "FUTURA") return "info";
  if (status === "ENCERRADA") return "success";
  return "neutral";
}

function getCronogramaStatusLabel(status: string) {
  if (status === "EM_ANDAMENTO") return "Em andamento";
  if (status === "FUTURA") return "Futura";
  if (status === "ENCERRADA") return "Encerrada";
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
        <PageHeader
          breadcrumb={[
            { label: "Editais", href: "/editais" },
            { label: edital.numero, href: `/editais/${edital.id}` },
            { label: "Cronograma" },
          ]}
          title={`Cronograma — ${edital.numero}`}
          description="Leitura ordenada das fases publicas do processo seletivo."
        />

        <SectionCard title={`Cronograma de ${edital.numero}`}>
          <table className="crono-table">
            <thead>
              <tr>
                <th>Fase</th>
                <th>Tipo</th>
                <th>Inicio</th>
                <th>Fim</th>
                <th className="text-center" style={{ width: 120 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {edital.cronogramas.map((cronograma) => {
                const status = resolveCronogramaStatus(cronograma);
                return (
                  <tr key={cronograma.id}>
                    <td>{cronograma.titulo}</td>
                    <td>{cronograma.tipo}</td>
                    <td>{formatIsoDate(cronograma.inicioEm)}</td>
                    <td>{formatIsoDate(cronograma.fimEm)}</td>
                    <td className="text-center">
                      <StatusBadge variant={getCronogramaStatusVariant(status)}>{getCronogramaStatusLabel(status)}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SectionCard>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link className="edital-card-link" href={`/editais/${edital.id}`}>
            ← Voltar ao edital
          </Link>
          <div style={{ flex: 1 }} />
          <PublicAccessCta authenticatedHref="/candidato/participacoes" candidateLabel="Abrir area do candidato" nextPath="/candidato/participacoes" />
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
