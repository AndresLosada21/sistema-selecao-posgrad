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

const PAGE_SIZE = 10;

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
  const [currentPage, setCurrentPage] = useState(1);

  const loadEditais = useCallback(async (filterKey?: string, page?: number) => {
    setStatus("loading");
    setMessage(null);
    const filter = STATUS_FILTERS.find((f) => f.key === (filterKey ?? activeFilter)) ?? STATUS_FILTERS[0];
    const targetPage = page ?? currentPage;
    const response = await listEditais(filter.values, targetPage, PAGE_SIZE);
    setData(response);
    setStatus("ready");
  }, [activeFilter, currentPage]);

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
    setCurrentPage(1);
    loadEditais(key, 1).catch((error) => {
      setMessage(getErrorMessage(error));
      setStatus("error");
    });
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
    loadEditais(activeFilter, page).catch((error) => {
      setMessage(getErrorMessage(error));
      setStatus("error");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
  const showingFrom = (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, total);

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Consulta publica do processo seletivo"
        description={session.isAuthenticated
          ? "Consulte os editais publicados. Para participar, abra um edital e clique em 'Entrar neste edital'."
          : "Consulte editais, cronogramas e publicacoes oficiais. Para se inscrever ou pedir isencao, entre com sua conta."}
        action={<PublicAccessCta candidateLabel="Abrir painel do candidato" />}
      />

      <PageHeader
        title="Editais"
        description={`${activeLabel} · ${total} edital(is) encontrado(s).`}
      />

      {filterChips}

      {status === "loading" ? (
        <LoadingState title="Atualizando" description="Filtrando editais..." />
      ) : visibleItems.length === 0 ? (
        <EmptyState description="Nenhum edital encontrado para o filtro selecionado." title="Nenhum edital" />
      ) : (
        <>
          <div className="stack-layout">
            {visibleItems.map((edital) => (
              <EditalCard edital={edital} key={edital.id} />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="pagination-bar">
              <span className="pagination-info">
                Mostrando {showingFrom}-{showingTo} de {total} editais
              </span>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  type="button"
                >
                  Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    className={`pagination-btn pagination-page ${currentPage === page ? "pagination-page--active" : ""}`}
                    onClick={() => handlePageChange(page)}
                    type="button"
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="pagination-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  type="button"
                >
                  Proximo
                </button>
              </div>
            </div>
          ) : null}
        </>
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
