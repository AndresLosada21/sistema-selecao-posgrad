import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/page-states";
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
      return <EmptyState title="Cronograma indisponível" description="Este edital não possui fases públicas cadastradas." />;
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
                <th style={{ width: 180 }}>Tipo</th>
                <th style={{ width: 160 }}>Inicio</th>
                <th style={{ width: 160 }}>Fim</th>
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
