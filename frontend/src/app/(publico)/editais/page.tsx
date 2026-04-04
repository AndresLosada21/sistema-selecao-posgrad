"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getErrorMessage } from "@/lib/http/api-error";
import { listEditais } from "@/modules/edital/api";
import type { EditaisResponse } from "@/modules/edital/types";

export default function EditaisPage() {
  const [data, setData] = useState<EditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
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

  if (status === "loading") {
    return <LoadingState description="Consultando os editais publicados..." title="Carregando editais" />;
  }

  if (status === "error") {
    return <ErrorState description={message ?? undefined} title="Falha ao carregar editais" />;
  }

  if (!data?.items.length) {
    return <EmptyState description="Nenhum edital foi disponibilizado pelo backend no momento." title="Nenhum edital encontrado" />;
  }

  return (
    <SectionCard description="Consumo inicial do contrato publico de editais para servir de base aos demais modulos." title="Editais publicados">
      <div className="content-list">
        {data.items.map((edital) => (
          <article className="content-item" key={edital.id}>
            <div className="content-item-row">
              <strong>{edital.numero}</strong>
              <StatusBadge>{edital.status}</StatusBadge>
            </div>
            <p>{edital.titulo}</p>
            <small>Curso: {edital.cursoNivel}</small>
            <small>Fase atual: {edital.faseAtual?.titulo ?? "sem fase ativa"}</small>
            <small>Proxima fase: {edital.proximaFase?.titulo ?? "sem previsao imediata"}</small>
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
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
