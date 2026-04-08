"use client";

import { useCallback, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { PublicAccessCta } from "@/components/shared/public-access-cta";
import { getErrorMessage } from "@/lib/http/api-error";
import { useSession } from "@/lib/auth/session-provider";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { EditalCard } from "@/modules/edital/components/edital-card";
import { listEditais } from "@/modules/edital/api";
import type { EditaisResponse } from "@/modules/edital/types";

type StatusFilter = {
  key: string;
  label: string;
  values: string[];
};

const STATUS_FILTERS: StatusFilter[] = [
  { key: "ativos", label: "Publicados e em andamento", values: ["PUBLICADO", "EM_ANDAMENTO"] },
  { key: "todos", label: "Todos os editais publicos", values: ["PUBLICADO", "EM_ANDAMENTO", "ENCERRADO", "CANCELADO"] },
  { key: "encerrados", label: "Encerrados", values: ["ENCERRADO"] },
  { key: "cancelados", label: "Cancelados", values: ["CANCELADO"] },
];

function isTechnicalEdital(numero: string, titulo: string) {
  const n = numero.toUpperCase();
  const t = titulo.toLowerCase();
  return n.startsWith("SMK-") || n.startsWith("E2E-") || n.startsWith("PAF-") || t.includes("smoke") || t.includes("e2e");
}

export default function EditaisPage() {
  const session = useSession();
  const [data, setData] = useState<EditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [activeFilter, setActiveFilter] = useState("ativos");

  const loadEditais = useCallback(async (filterKey?: string) => {
    setStatus("loading");
    setMessage(null);
    const filter = STATUS_FILTERS.find((f) => f.key === (filterKey ?? activeFilter)) ?? STATUS_FILTERS[0];
    const response = await listEditais(filter.values);
    setData(response);
    setStatus("ready");
  }, [activeFilter]);

  useAbortableEffect(async (signal) => {
    try {
      await loadEditais();
    } catch (error) {
      if (signal.aborted) return;
      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [loadEditais]);

  function handleFilterChange(key: string) {
    if (key === activeFilter) return;
    setActiveFilter(key);
    loadEditais(key).catch((error) => {
      setMessage(getErrorMessage(error));
      setStatus("error");
    });
  }

  const filterChips = (
    <div className="edital-filter-bar">
      {STATUS_FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className={`edital-filter-chip ${activeFilter === filter.key ? "edital-filter-chip--active" : ""}`}
          onClick={() => handleFilterChange(filter.key)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );

  if (status === "loading" && !data) {
    return <LoadingState description="Consultando os editais..." title="Carregando editais" />;
  }

  if (status === "error" && !data) {
    return (
      <div className="stack-layout">
        <ErrorState description={message ?? undefined} title="Falha ao carregar editais" />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ActionButton onClick={() => loadEditais()} type="button" variant="secondary">
            Tentar novamente
          </ActionButton>
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];
  const operationalItems = items.filter((edital) => !isTechnicalEdital(edital.numero, edital.titulo));
  const technicalItems = items.filter((edital) => isTechnicalEdital(edital.numero, edital.titulo));
  const visibleItems = showTechnical ? items : operationalItems;

  const activeLabel = STATUS_FILTERS.find((f) => f.key === activeFilter)?.label ?? "";

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Consulta publica do processo seletivo"
        description={session.isAuthenticated
          ? "Acompanhe editais, cronogramas e publicacoes oficiais. Voce ja esta autenticado e pode seguir para sua area."
          : "Acompanhe editais, cronogramas e publicacoes oficiais. Para operar fluxos do candidato, entre com sua conta."}
        action={<PublicAccessCta />}
      />

      <PageHeader
        title="Editais"
        description={`${activeLabel} · ${visibleItems.length} edital(is) encontrado(s)${showTechnical ? ` de um total de ${data?.total ?? 0}` : ""}.`}
      />

      {filterChips}

      {status === "loading" ? (
        <LoadingState title="Atualizando" description="Filtrando editais..." />
      ) : visibleItems.length === 0 ? (
        <EmptyState description="Nenhum edital encontrado para o filtro selecionado." title="Nenhum edital" />
      ) : (
        <div className="stack-layout">
          {visibleItems.map((edital) => (
            <EditalCard edital={edital} key={edital.id} />
          ))}
        </div>
      )}

      {session.hasRole("ADMIN") && technicalItems.length ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ActionButton onClick={() => setShowTechnical((c) => !c)} type="button" variant="secondary">
            {showTechnical ? "Ocultar editais tecnicos" : `Exibir ${technicalItems.length} editais tecnicos`}
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
