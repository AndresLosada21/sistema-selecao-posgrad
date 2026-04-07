"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { ActionButton } from "@/components/shared/action-button";
import { FileField } from "@/components/shared/file-field";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { sanitizePayload } from "@/lib/http/sanitize";
import type { FaseRecurso } from "@/lib/enums";
import { faseRecursoOptions } from "@/modules/admin-operacao/constants";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";
import { createCandidateRecurso, listCandidateRecursos } from "@/modules/recurso/api";
import type { CandidateRecursosResponse } from "@/modules/recurso/types";
import { uploadPrivateFile } from "@/modules/upload/api";

export default function CandidateRecursosPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const searchParams = useSearchParams();
  const [dashboard, setDashboard] = useState<CandidateDashboardResponse | null>(null);
  const [recursos, setRecursos] = useState<CandidateRecursosResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editalId, setEditalId] = useState("");
  const [fase, setFase] = useState("");
  const [fundamentacao, setFundamentacao] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [anexoNome, setAnexoNome] = useState("");
  const [downloadingAnexoId, setDownloadingAnexoId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    const [dashboardResponse, recursosResponse] = await Promise.all([
      getCandidateDashboard(token),
      listCandidateRecursos(token),
    ]);

    setDashboard(dashboardResponse);
    setRecursos(recursosResponse);
  }, [token]);

  useAbortableEffect(async (signal) => {
    if (!token) {
      return;
    }

    try {
      await loadData();
      if (signal.aborted) return;
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setMessage({ type: "error", text: getErrorMessage(error) });
      setStatus("error");
    }
  }, [loadData, signOut, token]);

  useEffect(() => {
    const editalIdFromQuery = searchParams?.get("editalId");
    const faseFromQuery = searchParams?.get("fase");

    if (editalIdFromQuery) {
      setEditalId(editalIdFromQuery);
    }

    if (faseFromQuery) {
      setFase(faseFromQuery);
    }
  }, [searchParams]);

  const editalOptions = dashboard?.items ?? [];
  const filteredRecursos = useMemo(() => {
    const items = recursos?.items ?? [];
    return items.filter((item) => (editalId ? item.edital.id === editalId : true));
  }, [editalId, recursos]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session.token) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await createCandidateRecurso(
        sanitizePayload({
          editalId,
          fase: fase as FaseRecurso,
          fundamentacao,
          anexoUrl: anexoUrl || undefined,
        }),
        session.token,
      );

      await loadData();
      setFundamentacao("");
      setAnexoUrl("");
      setAnexoNome("");
      setMessage({ type: "success", text: "Recurso registrado e lista atualizada." });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadAnexo(file: File) {
    if (!session.token) return;
    setBusy(true);
    setMessage(null);
    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      setAnexoUrl(uploaded.urlArquivo);
      setAnexoNome(uploaded.nomeArquivo);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadAnexo(recursoId: string, anexoUrl: string) {
    if (!session.token) return;
    setDownloadingAnexoId(recursoId);
    try {
      await downloadAuthenticatedFile(anexoUrl, session.token, "anexo-recurso.pdf");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setDownloadingAnexoId(null);
    }
  }

  if (status === "loading") {
    return <LoadingState title="Carregando recursos" description="Consultando recursos e editais vinculados ao candidato." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar recursos" description={message?.text} />;
  }

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Retorno operacional" description={message.text} /> : null}

      <PageFeedback
        type="info"
        title="Recursos administrativos do candidato"
        description="Abra recursos apenas quando houver resultado preliminar e, para etapas com espelho, somente apos solicitar e receber a liberacao correspondente."
      />

      <SectionCard title="Novo recurso" description="Formulario do candidato para registro de recurso dentro da janela e da fase corretas. A validacao final permanece no backend.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field-block">
            <span>Edital</span>
            <select className="select-field" onChange={(event) => setEditalId(event.target.value)} required value={editalId}>
              <option value="">Selecione</option>
              {editalOptions.map((item) => (
                <option key={item.edital.id} value={item.edital.id}>
                  {item.edital.numero} - {item.edital.titulo}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Fase</span>
            <select className="select-field" onChange={(event) => setFase(event.target.value)} required value={fase}>
              <option value="">Selecione</option>
              {faseRecursoOptions.map((value) => (
                <option key={value} value={value}>
                  {getStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Fundamentacao</span>
            <textarea className="text-area" minLength={10} onChange={(event) => setFundamentacao(event.target.value)} required value={fundamentacao} />
          </label>

          <FileField disabled={busy} hint={anexoNome ? `Arquivo enviado: ${anexoNome}` : "Envie um anexo opcional para fundamentar o recurso."} label="Anexo do recurso (opcional)" onFileSelect={handleUploadAnexo} />

          <ActionButton disabled={busy} loading={busy} type="submit">
            Registrar recurso
          </ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Historico de recursos" description="Lista dos recursos ja registrados pela conta autenticada.">
        {filteredRecursos.length ? (
          <div className="content-list">
            {filteredRecursos.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row">
                  <strong>{item.edital.numero}</strong>
                  <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
                </div>
                <small>Fase: {getStatusLabel(item.fase)}</small>
                <small>Criado em: {formatIsoDate(item.criadoEm)}</small>
                <small>Respondido em: {formatIsoDate(item.respondidoEm)}</small>
                <small>Impacto em resultado: {item.impactoResultado ? "sim" : "nao"}</small>
                <p>{item.fundamentacao}</p>
                <small>Decisao: {item.decisao ?? "ainda nao registrada"}</small>
                {item.anexoUrl ? (
                  <div className="content-item-links">
                    <ActionButton disabled={downloadingAnexoId === item.id || !item.anexoUrl} onClick={() => item.anexoUrl ? handleDownloadAnexo(item.id, item.anexoUrl) : undefined} size="sm" type="button" variant="secondary">
                      {downloadingAnexoId === item.id ? "Baixando..." : "Baixar anexo"}
                    </ActionButton>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sem recursos" description="Nenhum recurso foi registrado por esta conta ate o momento." />
        )}
      </SectionCard>
    </div>
  );
}
