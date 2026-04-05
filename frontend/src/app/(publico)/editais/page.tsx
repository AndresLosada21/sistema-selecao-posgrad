"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { ParticiparEditalCta } from "@/components/shared/participar-edital-cta";
import { PublicAccessCta } from "@/components/shared/public-access-cta";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { getErrorMessage } from "@/lib/http/api-error";
import { useSession } from "@/lib/auth/session-provider";
import { listEditais } from "@/modules/edital/api";
import { formatIsoDate } from "@/modules/edital/formatters";
import type { EditaisResponse } from "@/modules/edital/types";

function isTechnicalEdital(numero: string, titulo: string) {
  const normalizedNumero = numero.toUpperCase();
  const normalizedTitulo = titulo.toLowerCase();

  return normalizedNumero.startsWith("SMK-")
    || normalizedNumero.startsWith("E2E-")
    || normalizedNumero.startsWith("PAF-")
    || normalizedTitulo.includes("smoke")
    || normalizedTitulo.includes("e2e");
}

export default function EditaisPage() {
  const session = useSession();
  const [data, setData] = useState<EditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const loadEditais = useCallback(() => {
    setStatus("loading");
    setMessage(null);

    listEditais()
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    loadEditais();
  }, [loadEditais]);

  if (status === "loading") {
    return <LoadingState description="Consultando os editais publicados..." title="Carregando editais" />;
  }

  if (status === "error") {
    return (
      <div className="stack-layout">
        <ErrorState description={message ?? undefined} title="Falha ao carregar editais" />
        <div className="content-item-links">
          <ActionButton onClick={loadEditais} type="button" variant="secondary">
            Tentar novamente
          </ActionButton>
        </div>
      </div>
    );
  }

  if (!data?.items.length) {
    return <EmptyState description="Nenhum edital foi disponibilizado pelo backend no momento." title="Nenhum edital encontrado" />;
  }

  const operationalItems = data.items.filter((edital) => !isTechnicalEdital(edital.numero, edital.titulo));
  const technicalItems = data.items.filter((edital) => isTechnicalEdital(edital.numero, edital.titulo));
  const visibleItems = showTechnical ? data.items : operationalItems;

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Consulta publica do processo"
        description={session.isAuthenticated ? "Acompanhe editais, cronogramas e publicacoes oficiais. Voce ja esta autenticado e pode seguir para sua area." : "Acompanhe editais, cronogramas e publicacoes oficiais. Para operar fluxos do candidato, entre com sua conta."}
        action={<PublicAccessCta />}
      />

      <SectionCard description={`Exibindo ${visibleItems.length} edital(is) publico(s)${showTechnical ? ` de um total de ${data.total}` : ""}.`} title="Editais publicados">
        <div className="content-list">
          {visibleItems.map((edital) => (
            <article className="content-item" key={edital.id}>
              <div className="content-item-row">
                <strong>{edital.numero}</strong>
                <StatusBadge variant={getStatusVariant(edital.status)}>{getStatusLabel(edital.status)}</StatusBadge>
              </div>
              <p>{edital.titulo}</p>
              <small>Curso: {getStatusLabel(edital.cursoNivel)}</small>
              <small>Publicado em: {formatIsoDate(edital.publicadoEm)}</small>
              <small>Fase atual: {edital.faseAtual?.titulo ?? "sem fase ativa"}</small>
              <small>Proxima fase: {edital.proximaFase?.titulo ?? "sem previsao imediata"}</small>
              <small>Linhas de pesquisa: {edital.linhasPesquisa.length}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={`/editais/${edital.id}`}>
                  Detalhe do edital
                </Link>
                <Link className="nav-link" href={`/editais/${edital.id}/cronograma`}>
                  Cronograma
                </Link>
                <Link className="nav-link" href={`/editais/${edital.id}/publicacoes`}>
                  Publicacoes oficiais
                </Link>
                <ParticiparEditalCta editalId={edital.id} />
              </div>
            </article>
          ))}
        </div>
        {session.hasRole("ADMIN") && technicalItems.length ? (
          <div className="content-item-links">
            <ActionButton onClick={() => setShowTechnical((current) => !current)} type="button" variant="secondary">
              {showTechnical ? "Ocultar editais tecnicos" : `Exibir ${technicalItems.length} editais tecnicos`}
            </ActionButton>
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
