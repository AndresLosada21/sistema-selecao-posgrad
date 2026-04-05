"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { sanitizePayload } from "@/lib/http/sanitize";
import { resolveApiUrl } from "@/lib/config/api";
import { faseRecursoOptions } from "@/modules/admin-operacao/constants";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";
import { createCandidateRecurso, listCandidateRecursos } from "@/modules/recurso/api";
import type { CandidateRecursosResponse } from "@/modules/recurso/types";

export default function CandidateRecursosPage() {
  const session = useSession();
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

  const loadData = useCallback(async () => {
    if (!session.token) {
      return;
    }

    const [dashboardResponse, recursosResponse] = await Promise.all([
      getCandidateDashboard(session.token),
      listCandidateRecursos(session.token),
    ]);

    setDashboard(dashboardResponse);
    setRecursos(recursosResponse);
  }, [session.token]);

  useEffect(() => {
    if (!session.token) {
      return;
    }

    loadData()
      .then(() => setStatus("ready"))
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          session.signOut();
          return;
        }

        setMessage({ type: "error", text: getErrorMessage(error) });
        setStatus("error");
      });
  }, [loadData, session]);

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
          fase,
          fundamentacao,
          anexoUrl: anexoUrl || undefined,
        }),
        session.token,
      );

      await loadData();
      setFundamentacao("");
      setAnexoUrl("");
      setMessage({ type: "success", text: "Recurso registrado e lista atualizada." });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        session.signOut();
        return;
      }

      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
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

          <label className="field-block">
            <span>URL do anexo (opcional)</span>
            <input onChange={(event) => setAnexoUrl(event.target.value)} value={anexoUrl} />
          </label>

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
                    <a className="nav-link" href={resolveApiUrl(item.anexoUrl)} rel="noreferrer" target="_blank">
                      Abrir anexo
                    </a>
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
