"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { downloadAnexoIv, listInscricoes } from "@/modules/inscricao/api";
import type { CandidateInscricoesResponse } from "@/modules/inscricao/types";

export default function CandidateInscricoesPage() {
  const session = useSession();
  const [data, setData] = useState<CandidateInscricoesResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownloadAnexoIv(inscricaoId: string) {
    if (!session.token) {
      return;
    }

    setDownloadingId(inscricaoId);
    setMessage(null);

    try {
      const result = await downloadAnexoIv(inscricaoId, session.token);
      triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, "anexo-iv.pdf"));
    } catch (error) {
      if (isUnauthorizedError(error)) {
        session.signOut();
        return;
      }

      setMessage(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    if (!session.token) {
      return;
    }

    listInscricoes(session.token)
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          session.signOut();
          return;
        }

        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [session]);

  if (status === "loading") {
    return <LoadingState title="Carregando inscricoes" description="Consultando o historico de inscricoes do candidato." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar inscricoes" description={message ?? undefined} />;
  }

  if (!data?.items.length) {
    return (
      <div className="stack-layout">
        <EmptyState title="Sem inscricoes" description="Nenhuma inscricao foi registrada por esta conta." />
        <div className="content-item-links">
          <Link className="nav-link" href="/candidato/participacoes">
            Ver editais vinculados
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Historico de inscricoes"
        description="Acompanhe o status da inscricao, os artefatos disponiveis e retorne ao edital quando precisar editar ou consultar o fluxo completo."
      />

      <SectionCard title="Inscricoes do candidato" description={`Foram encontradas ${data.total} inscricao(oes) vinculadas a esta conta.`}>
        <div className="content-list">
          {data.items.map((inscricao) => (
            <article className="content-item" key={inscricao.id}>
              <div className="content-item-row">
                <strong>{inscricao.edital.numero}</strong>
                <StatusBadge variant={getStatusVariant(inscricao.status)}>{getStatusLabel(inscricao.status)}</StatusBadge>
              </div>
              <p>{inscricao.edital.titulo}</p>
              <small>Status do pagamento: {getStatusLabel(inscricao.statusPagamento)}</small>
              <small>Linha: {inscricao.linhaPesquisa?.nome ?? "nao definida"}</small>
              <small>Documentos: {inscricao.documentosTotal}</small>
              <small>Submetida em: {formatIsoDate(inscricao.submetidaEm)}</small>
              <div className="content-item-links">
                <Link className="nav-link" href={`/candidato/editais/${inscricao.edital.id}`}>
                  Ver acompanhamento
                </Link>
                <Link className="nav-link" href={`/candidato/editais/${inscricao.edital.id}/inscricao`}>
                  Abrir inscricao
                </Link>
                {inscricao.anexoIvGeradoUrl ? (
                  <ActionButton disabled={downloadingId === inscricao.id} onClick={() => handleDownloadAnexoIv(inscricao.id)} size="sm" type="button" variant="secondary">
                    {downloadingId === inscricao.id ? "Baixando..." : "Baixar Anexo IV"}
                  </ActionButton>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
