"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { AdminBreadcrumb } from "@/components/shared/admin-breadcrumb";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel } from "@/components/shared/status-variant-map";
import { resolveApiUrl } from "@/lib/config/api";
import { useSession } from "@/lib/auth/session-provider";
import { tipoPublicacaoOficialOptions, type TipoPublicacaoOficial } from "@/lib/enums";
import { getActionableErrorMessage, getErrorMessage, getFirstFormError, pickLabeledFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { getAdminEditalById } from "@/modules/admin-edital/api";
import { listAdminPublicacoesByEdital, previewClassificacaoPublicacao, previewHomologacaoPublicacao, publicarClassificacao, publicarGenerica, publicarHomologacao } from "@/modules/admin-publicacao/api";
import { previewPublicacaoPoliticas, publicarPoliticas } from "@/modules/admin-politicas/api";
import type { PublicacaoResumo, PublicacoesResponse } from "@/modules/publicacao/types";
import { uploadPrivateFile } from "@/modules/upload/api";

type Props = { params: Promise<{ editalId: string }> };

const PAGE_SIZE = 20;
const SPECIALIZED_TYPES = new Set(["HOMOLOGACAO_PRELIMINAR", "HOMOLOGACAO_FINAL", "CLASSIFICACAO_PRELIMINAR", "CLASSIFICACAO_FINAL", "POLITICAS_AFIRMATIVAS_PRELIMINAR", "POLITICAS_AFIRMATIVAS_FINAL"]);
const genericPublicacaoOptions = tipoPublicacaoOficialOptions.filter((value) => !SPECIALIZED_TYPES.has(value));

/** Transforma camelCase em label legivel: "linhaPesquisa" → "Linha pesquisa" */
function camelToLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

const HIDDEN_PREVIEW_COLS = new Set(["id", "inscricaoId", "editalId", "candidatoId", "linhaPesquisaId"]);

/** Colunas fixas por tipo de preview (Pencil) */
const PREVIEW_COLUMNS: Record<string, { key: string; label: string }[]> = {
  homologacao: [
    { key: "candidato", label: "Candidato" },
    { key: "linhaPesquisa", label: "Linha" },
    { key: "situacaoPublica", label: "Situacao" },
    { key: "parecer", label: "Parecer" },
  ],
  classificacao: [
    { key: "posicaoGeral", label: "#" },
    { key: "candidato", label: "Candidato" },
    { key: "linhaPesquisa", label: "Linha" },
    { key: "modalidadePublica", label: "Modal." },
    { key: "notaEtapa1", label: "E1" },
    { key: "notaEtapa2", label: "E2" },
    { key: "notaFinal", label: "NF" },
    { key: "situacaoPublica", label: "Situacao" },
  ],
  politicas: [
    { key: "candidato", label: "Candidato" },
    { key: "modalidadePublica", label: "Modalidade" },
    { key: "situacaoPublica", label: "Resultado" },
    { key: "statusClassificacao", label: "Status" },
  ],
};

/** Extrai valor legivel de um campo de preview. Objetos aninhados retornam o campo mais relevante. */
function extractDisplayValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Sim" : "Nao";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    // Se parece status/enum (SNAKE_CASE), tenta getStatusLabel
    if (/^[A-Z][A-Z_0-9]+$/.test(val)) return getStatusLabel(val);
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    return val.map((item) => extractDisplayValue(item)).join(", ");
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    // Prioridade: campos de nome legivel
    for (const k of ["nomeCompleto", "nome", "titulo", "label", "descricao", "numero"]) {
      if (typeof obj[k] === "string") return obj[k] as string;
    }
    // Fallback: primeiro campo string
    for (const v of Object.values(obj)) {
      if (typeof v === "string" && v.length > 0 && v.length < 100) return v;
    }
    return JSON.stringify(val);
  }
  return String(val);
}

/** IDs longos exibidos truncados com tooltip do valor completo */
const ID_LIKE_KEYS = new Set(["republicacaoDeId"]);

type PubType = "homologacao" | "classificacao" | "politicas";

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function getOrigemArquivoLabel(origem: PublicacaoResumo["origemArquivo"]) {
  return origem === "MANUAL" ? "PDF enviado" : "PDF gerado";
}

function getOrigemArquivoVariant(origem: PublicacaoResumo["origemArquivo"]) {
  return origem === "MANUAL" ? "info" : "neutral";
}

export default function AdminPublicacoesDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [history, setHistory] = useState<PublicacoesResponse | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState<{ type: PubType; fase: "PRELIMINAR" | "FINAL" } | null>(null);

  const [faseHomologacao, setFaseHomologacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [faseClassificacao, setFaseClassificacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [fasePoliticas, setFasePoliticas] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");

  const [tipoGenerico, setTipoGenerico] = useState<TipoPublicacaoOficial>("COMUNICADO");
  const [tituloGenerico, setTituloGenerico] = useState("");
  const [descricaoGenerica, setDescricaoGenerica] = useState("");
  const [versaoFinalGenerica, setVersaoFinalGenerica] = useState(false);
  const [resumoGenerico, setResumoGenerico] = useState("");
  const [observacoesGenericas, setObservacoesGenericas] = useState("");
  const [referenciaGenerica, setReferenciaGenerica] = useState("");
  const [arquivoGenerico, setArquivoGenerico] = useState<File | null>(null);
  const [arquivoGenericoPreviewUrl, setArquivoGenericoPreviewUrl] = useState<string | null>(null);
  const [arquivoGenericoKey, setArquivoGenericoKey] = useState(0);
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"TODOS" | TipoPublicacaoOficial>("TODOS");
  const [historyOnlyCurrent, setHistoryOnlyCurrent] = useState(false);
  const [page, setPage] = useState(1);
  const [editalLabel, setEditalLabel] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [fieldErrorScope, setFieldErrorScope] = useState<"manual" | "homologacao" | "classificacao" | "politicas" | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ candidatoNome: string; inscricaoId: string }[] | null>(null);

  useEffect(() => {
    if (!arquivoGenerico) {
      return;
    }

    if (arquivoGenerico.type === "application/pdf" || arquivoGenerico.name.toLowerCase().endsWith(".pdf")) {
      return;
    }

    setArquivoGenerico(null);
    setArquivoGenericoKey((current) => current + 1);
    setFeedback({ type: "error", text: "Selecione um arquivo PDF valido para a publicacao manual." });
  }, [arquivoGenerico]);

  useEffect(() => {
    if (!arquivoGenerico) {
      setArquivoGenericoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(arquivoGenerico);
    setArquivoGenericoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [arquivoGenerico]);

  useEffect(() => {
    let cancelled = false;
    params.then((r) => { if (!cancelled) setEditalId(r.editalId); });
    return () => { cancelled = true; };
  }, [params]);

  const reload = useCallback(async () => {
    if (!editalId || !token) return;
    const response = await listAdminPublicacoesByEdital(editalId, token, {
      page,
      pageSize: PAGE_SIZE,
      tipo: historyTypeFilter === "TODOS" ? undefined : historyTypeFilter,
      somenteVigentes: historyOnlyCurrent,
    });
    setHistory(response);
  }, [editalId, historyOnlyCurrent, historyTypeFilter, page, token]);

  useAbortableEffect(async (signal) => {
    if (!editalId || !token) return;
    try {
      const [, editalData] = await Promise.all([
        reload(),
        getAdminEditalById(editalId, token).catch(() => null),
      ]);
      if (signal.aborted) return;
      if (editalData) setEditalLabel(`${(editalData as Record<string, unknown>).numero ?? ""}`);
      setPageStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
      setPageStatus("error");
    }
  }, [editalId, reload, signOut, token]);

  const faseFor = (type: PubType) => type === "homologacao" ? faseHomologacao : type === "classificacao" ? faseClassificacao : fasePoliticas;

  async function loadPreview(type: PubType) {
    if (!token || !editalId) return;
    setBusy(true);
    setFeedback(null); setFieldErrors({}); setFieldErrorScope(type); setErrorDetails(null);
    try {
      const fase = faseFor(type);
      const response = type === "homologacao"
        ? await previewHomologacaoPublicacao(editalId, fase, token)
        : type === "classificacao"
          ? await previewClassificacaoPublicacao(editalId, fase, token)
          : await previewPublicacaoPoliticas(editalId, fase, token);
      setPreview(response);
      setPreviewLabel(`Preview: ${type} · ${fase.toLowerCase()}`);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFieldErrors(pickLabeledFieldErrors(error, { fase: "a fase da publicacao" }));
      const errObj = error as Record<string, unknown> | undefined;
      const details = (errObj as Record<string, unknown>)?.details ?? (errObj as Record<string, unknown>)?.data;
      if (Array.isArray(details) && details.length > 0 && typeof details[0] === "object" && details[0] !== null && "candidatoNome" in details[0]) {
        setErrorDetails(details as { candidatoNome: string; inscricaoId: string }[]);
      }
      setFeedback({ type: "error", text: getActionableErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function publish(type: PubType) {
    if (!token || !editalId) return;
    setBusy(true);
    setFeedback(null); setFieldErrors({}); setFieldErrorScope(type);
    setConfirmPublish(null);
    try {
      const fase = faseFor(type);
      const desc = `Publicacao ${fase.toLowerCase()} de ${type}.`;
      if (type === "homologacao") {
        await publicarHomologacao(editalId, { fase, descricao: desc }, token);
      } else if (type === "classificacao") {
        await publicarClassificacao(editalId, { fase, descricao: desc }, token);
      } else {
        await publicarPoliticas(editalId, { fase: fase, descricao: desc }, token);
      }
      setFeedback({ type: "success", text: `Publicacao de ${type} (${fase.toLowerCase()}) criada.` });
      await reload();
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFieldErrors(pickLabeledFieldErrors(error, { fase: "a fase da publicacao" }));
      setFeedback({ type: "error", text: getActionableErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function handlePublicacaoGenerica(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editalId) return;

    const errors: Record<string, string> = {};
    if (!tituloGenerico.trim()) errors.titulo = "O titulo da publicacao e obrigatorio.";
    if (!arquivoGenerico) errors.arquivoUrl = "Selecione o PDF da publicacao.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFieldErrorScope("manual");
      const msgs = Object.values(errors);
      setFeedback({ type: "warning", text: msgs.length === 1 ? msgs[0] : `Corrija ${msgs.length} campos: ${msgs.join(" · ")}` });
      return;
    }

    setBusy(true);
    setFeedback(null); setFieldErrors({}); setFieldErrorScope("manual");
    try {
      const dados: Record<string, unknown> = {};
      if (resumoGenerico) dados.resumoPublico = resumoGenerico;
      if (observacoesGenericas) dados.observacoesInternas = observacoesGenericas;
      if (referenciaGenerica) dados.referenciaExterna = referenciaGenerica;
      const upload = await uploadPrivateFile(arquivoGenerico!, token);

      await publicarGenerica(editalId, {
        tipo: tipoGenerico,
        titulo: tituloGenerico,
        descricao: descricaoGenerica || undefined,
        versaoFinal: versaoFinalGenerica,
        arquivoUrl: upload.urlArquivo,
        arquivoMetadados: {
          nomeOriginal: upload.nomeArquivo,
          mimeType: upload.mimeType,
          tamanhoBytes: upload.tamanhoBytes,
        },
        dadosConsolidados: Object.keys(dados).length ? dados : undefined,
      }, token);
      setFeedback({ type: "success", text: `Publicacao criada com o PDF ${upload.nomeArquivo}.` });
      setTituloGenerico("");
      setDescricaoGenerica("");
      setVersaoFinalGenerica(false);
      setResumoGenerico("");
      setObservacoesGenericas("");
      setReferenciaGenerica("");
      setArquivoGenerico(null);
      setArquivoGenericoKey((current) => current + 1);
      await reload();
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFieldErrors(pickLabeledFieldErrors(error, {
        tipo: "o tipo da publicacao",
        titulo: "o titulo da publicacao",
        descricao: "a descricao da publicacao",
        arquivoUrl: "o PDF da publicacao",
      }));
      setFeedback({ type: "error", text: getActionableErrorMessage(error) });
    } finally { setBusy(false); }
  }

  const historyMetrics = useMemo(() => {
    return {
      total: history?.overview?.totalPublicacoes ?? 0,
      vigentes: history?.overview?.totalVigentes ?? 0,
      manuais: history?.overview?.totalManuais ?? 0,
      ultimoPublicadoEm: history?.overview?.ultimoPublicadoEm ?? null,
    };
  }, [history?.overview]);

  const pagedHistoryItems = history?.items ?? [];

  const totalPages = Math.max(1, Math.ceil((history?.total ?? 0) / PAGE_SIZE));

  const latestHomPub = history?.vigentesPorTipo?.find((i) => i.tipo === `HOMOLOGACAO_${faseHomologacao}`);
  const latestClassPub = history?.vigentesPorTipo?.find((i) => i.tipo === `CLASSIFICACAO_${faseClassificacao}`);
  const latestPolPub = history?.vigentesPorTipo?.find((i) => i.tipo === `POLITICAS_AFIRMATIVAS_${fasePoliticas}`);

  if (pageStatus === "loading") return <LoadingState title="Carregando publicacoes" description="Consultando o historico do edital." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar publicacoes" description={feedback?.text} />;

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && (
        <PageFeedback description={feedback.text} title={feedback.type === "success" ? "Publicacao atualizada" : feedback.type === "warning" ? "Atencao na publicacao" : "Nao foi possivel concluir a acao"} type={feedback.type}>
          {errorDetails && errorDetails.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <strong style={{ fontSize: 12 }}>Inscricoes pendentes:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
                {errorDetails.map((d) => (
                  <li key={d.inscricaoId}>{d.candidatoNome}</li>
                ))}
              </ul>
              <Link href="/admin/homologacao" style={{ fontSize: 12, color: "#2563EB", fontWeight: 600 }}>Ir para Homologacao</Link>
            </div>
          )}
        </PageFeedback>
      )}

      <AdminBreadcrumb items={[{ label: "Publicacoes", href: "/admin/publicacoes" }, { label: editalLabel || editalId || "Edital" }]} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="admin-page-header-left" style={{ flex: 1 }}>
          <h1>Publicacoes — Edital {editalLabel || (editalId ?? "")}</h1>
          <p>Gerencie previews, publicacoes oficiais e PDFs manuais deste edital em um unico workspace.</p>
        </div>
        {editalId ? (
          <Link href={`/editais/${editalId}/publicacoes`} rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#2563EB", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }} target="_blank">
            Ver pagina publica
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </Link>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div className="admin-form-card" style={{ gap: 4 }}>
          <span className="admin-form-card-title" style={{ fontSize: 12 }}>Total publicado</span>
          <strong style={{ fontSize: 28, color: "#0F172A" }}>{historyMetrics.total}</strong>
          <span style={{ fontSize: 12, color: "#64748B" }}>Todas as versoes registradas no edital.</span>
        </div>
        <div className="admin-form-card" style={{ gap: 4 }}>
          <span className="admin-form-card-title" style={{ fontSize: 12 }}>Versoes vigentes</span>
          <strong style={{ fontSize: 28, color: "#0F172A" }}>{historyMetrics.vigentes}</strong>
          <span style={{ fontSize: 12, color: "#64748B" }}>Uma por tipo atualmente valido ao usuario.</span>
        </div>
        <div className="admin-form-card" style={{ gap: 4 }}>
          <span className="admin-form-card-title" style={{ fontSize: 12 }}>PDFs manuais</span>
          <strong style={{ fontSize: 28, color: "#0F172A" }}>{historyMetrics.manuais}</strong>
          <span style={{ fontSize: 12, color: "#64748B" }}>Arquivos enviados manualmente pela administracao.</span>
        </div>
        <div className="admin-form-card" style={{ gap: 4 }}>
          <span className="admin-form-card-title" style={{ fontSize: 12 }}>Ultima publicacao</span>
          <strong style={{ fontSize: 18, color: "#0F172A" }}>{historyMetrics.ultimoPublicadoEm ? formatIsoDate(historyMetrics.ultimoPublicadoEm) : "—"}</strong>
          <span style={{ fontSize: 12, color: "#64748B" }}>Data da versao mais recente no historico.</span>
        </div>
      </div>

      {/* Confirmation guard */}
      {confirmPublish && (
        <div className="admin-form-card" style={{ gap: 12 }}>
          <PageFeedback
            type="warning"
            title={`Confirmar publicacao ${confirmPublish.fase.toLowerCase()}`}
            description={`Voce esta prestes a criar uma publicacao oficial de ${confirmPublish.type}. Esta acao gera um PDF oficial e um registro auditavel no historico do edital.`}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="admin-pub-btn-publish" disabled={busy} onClick={() => publish(confirmPublish.type)} type="button">
              Confirmar publicacao
            </button>
            <button className="admin-pub-btn-preview" onClick={() => setConfirmPublish(null)} type="button">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 3 specialized publication cards */}
      <div className="admin-pub-cards">
        {/* Homologacao */}
        <div className="admin-pub-card">
          <div className="admin-pub-card-header">
            <div className="admin-pub-card-icon admin-pub-card-icon--blue">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <span className="admin-pub-card-title">Publicar Homologacao</span>
          </div>
          <p className="admin-pub-card-desc">Gere o preview da homologacao preliminar ou final e publique o PDF oficial com snapshot auditavel.</p>
          <div className="admin-pub-card-status">
            <span className={`admin-pub-card-dot ${latestHomPub ? "admin-pub-card-dot--green" : "admin-pub-card-dot--yellow"}`} />
            <span>{latestHomPub ? `${getStatusLabel(latestHomPub.tipo)} publicada (v${latestHomPub.versao})` : `Nenhuma ${faseHomologacao.toLowerCase()} publicada`}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select className="select-field" onChange={(e) => setFaseHomologacao(e.target.value as "PRELIMINAR" | "FINAL")} style={{ width: 140 }} value={faseHomologacao}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
          </div>
          <div className="admin-pub-card-actions">
            <button className="admin-pub-btn-preview" disabled={busy} onClick={() => loadPreview("homologacao")} type="button"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button>
            <button className="admin-pub-btn-publish" disabled={busy} onClick={() => setConfirmPublish({ type: "homologacao", fase: faseHomologacao })} type="button"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg> Publicar</button>
          </div>
        </div>

        {/* Classificacao */}
        <div className="admin-pub-card">
          <div className="admin-pub-card-header">
            <div className="admin-pub-card-icon admin-pub-card-icon--purple">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.4 4 6 4.5 6 4.5S6.6 4 7.5 4A2.5 2.5 0 0 1 10 6.5 2.5 2.5 0 0 1 7.5 9H6z"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5c-.9 0-1.5.5-1.5.5S17.4 4 16.5 4A2.5 2.5 0 0 0 14 6.5 2.5 2.5 0 0 0 16.5 9H18z"/><path d="M6 9v6a6 6 0 0 0 12 0V9"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </div>
            <span className="admin-pub-card-title">Publicar Classificacao</span>
          </div>
          <p className="admin-pub-card-desc">Gere o ranking consolidado por linha e modalidade e publique o PDF oficial da classificacao final.</p>
          <div className="admin-pub-card-status">
            <span className={`admin-pub-card-dot ${latestClassPub ? "admin-pub-card-dot--green" : "admin-pub-card-dot--yellow"}`} />
            <span>{latestClassPub ? `${getStatusLabel(latestClassPub.tipo)} publicada (v${latestClassPub.versao})` : `Nenhuma ${faseClassificacao.toLowerCase()} publicada`}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select className="select-field" onChange={(e) => setFaseClassificacao(e.target.value as "PRELIMINAR" | "FINAL")} style={{ width: 140 }} value={faseClassificacao}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
          </div>
          <div className="admin-pub-card-actions">
            <button className="admin-pub-btn-preview" disabled={busy} onClick={() => loadPreview("classificacao")} type="button"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button>
            <button className="admin-pub-btn-publish" disabled={busy} onClick={() => setConfirmPublish({ type: "classificacao", fase: faseClassificacao })} type="button"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg> Publicar</button>
          </div>
        </div>

        {/* Politicas */}
        <div className="admin-pub-card">
          <div className="admin-pub-card-header">
            <div className="admin-pub-card-icon admin-pub-card-icon--indigo">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span className="admin-pub-card-title">Publicar Pol. Afirmativas</span>
          </div>
          <p className="admin-pub-card-desc">Publique o resultado da etapa de politicas afirmativas/heteroidentificacao com snapshot auditavel.</p>
          <div className="admin-pub-card-status">
            <span className={`admin-pub-card-dot ${latestPolPub ? "admin-pub-card-dot--green" : "admin-pub-card-dot--yellow"}`} />
            <span style={!latestPolPub ? { color: "#1E40AF" } : undefined}>
              {latestPolPub ? `${getStatusLabel(latestPolPub.tipo)} publicada (v${latestPolPub.versao})` : `Nenhuma ${fasePoliticas.toLowerCase()} publicada`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select className="select-field" onChange={(e) => setFasePoliticas(e.target.value as "PRELIMINAR" | "FINAL")} style={{ width: 140 }} value={fasePoliticas}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
          </div>
          <div className="admin-pub-card-actions">
            <button className="admin-pub-btn-preview" disabled={busy} onClick={() => loadPreview("politicas")} type="button"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview</button>
            <button className="admin-pub-btn-publish" disabled={busy} onClick={() => setConfirmPublish({ type: "politicas", fase: fasePoliticas })} type="button"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Publicar</button>
          </div>
        </div>
      </div>

      {/* Preview area — renderizacao dedicada em vez de StructuredPreview generico */}
      {previewLabel && (
        <div className="admin-form-card" style={{ gap: 12, borderColor: "#BFDBFE" }}>
          <div className="admin-preview-toolbar">
            <h2 className="admin-form-card-title" style={{ flex: 1 }}>{previewLabel}</h2>
            <button className="admin-pub-btn-preview" onClick={() => { setPreview(null); setPreviewLabel(null); }} type="button" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Fechar
            </button>
          </div>

          {preview ? (
            <>
              {/* Metadados do preview */}
              {(preview.tituloSugerido ?? preview.tipo ?? preview.fase ?? preview.geradoEm) ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "#64748B", padding: "10px 14px", background: "#F8FAFC", borderRadius: 6 }}>
                  {preview.tituloSugerido ? <span><strong>Titulo:</strong> {String(preview.tituloSugerido)}</span> : null}
                  {preview.tipo ? <span><strong>Tipo:</strong> {getStatusLabel(String(preview.tipo))}</span> : null}
                  {preview.fase ? <span><strong>Fase:</strong> {String(preview.fase)}</span> : null}
                  {preview.geradoEm ? <span><strong>Gerado em:</strong> {formatIsoDate(String(preview.geradoEm))}</span> : null}
                </div>
              ) : null}

              {/* Resumo */}
              {preview.resumo && typeof preview.resumo === "object" && (
                <div className="admin-preview-metrics">
                  {Object.entries(preview.resumo as Record<string, unknown>).map(([k, v]) => (
                    <span key={k}><strong>{getStatusLabel(k)}:</strong> {String(v ?? "—")}</span>
                  ))}
                </div>
              )}

              {/* Itens (tabela tipada por tipo de preview) */}
              {Array.isArray(preview.itens) && preview.itens.length > 0 ? (() => {
                const itens = preview.itens as Record<string, unknown>[];
                const previewType = previewLabel?.includes("homologacao") ? "homologacao" : previewLabel?.includes("classificacao") ? "classificacao" : previewLabel?.includes("politicas") ? "politicas" : null;
                const typedCols = previewType ? PREVIEW_COLUMNS[previewType] : null;
                const cols = typedCols ?? Object.keys(itens[0]).filter((k) => !HIDDEN_PREVIEW_COLS.has(k)).slice(0, 10).map((k) => ({ key: k, label: camelToLabel(k) }));
                return (
                  <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 6 }}>
                    <table className="admin-homologacao-table" style={{ minWidth: 600 }}>
                      <caption className="sr-only">Itens do preview da publicacao</caption>
                      <thead>
                        <tr>
                          {cols.map((col) => (
                            <th key={col.key} scope="col" style={{ fontSize: 11 }}>{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((item, idx) => (
                          <tr key={typeof item.id === "string" ? item.id : idx}>
                            {cols.map((col) => (
                              <td key={col.key} style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={extractDisplayValue(item[col.key])}>
                                {extractDisplayValue(item[col.key])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: "8px 16px", fontSize: 11, color: "#94A3B8", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", borderRadius: "0 0 6px 6px" }}>
                      {itens.length} {itens.length === 1 ? "item" : "itens"} no preview
                    </div>
                  </div>
                );
              })() : null}

              {/* Versionamento */}
              {preview.versionamento && typeof preview.versionamento === "object" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "#64748B", padding: "8px 0" }}>
                  {Object.entries(preview.versionamento as Record<string, unknown>).map(([k, v]) => {
                    const isId = ID_LIKE_KEYS.has(k);
                    const raw = String(v ?? "—");
                    return (
                      <span key={k} title={isId ? raw : undefined} style={isId ? { cursor: "help" } : undefined}>
                        <strong>{camelToLabel(k)}:</strong>{" "}
                        {isId ? <code style={{ fontSize: 11, background: "#F1F5F9", padding: "1px 4px", borderRadius: 3 }}>{raw.slice(0, 8)}…</code> : extractDisplayValue(v)}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Fallback: JSON scrollavel para dados nao estruturados */}
              {!preview.itens && !preview.resumo && (
                <pre style={{ maxHeight: 300, overflow: "auto", padding: 16, background: "#F8FAFC", borderRadius: 6, fontSize: 12, color: "#334155", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(preview, null, 2)}
                </pre>
              )}
            </>
          ) : (
            <EmptyState title="Preview vazio" description="O backend retornou um preview sem dados." />
          )}
        </div>
      )}

      {/* Publicacao manual */}
      <form className="admin-form-card" id="pub-manual-form" onSubmit={handlePublicacaoGenerica}>
        <h2 className="admin-form-card-title">Publicacao manual</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Editais, retificacoes, comunicados e demais documentos.</p>

        <div className="admin-form-row">
          <div className="admin-eval-field">
            <span>Tipo *</span>
            <select aria-invalid={!!fieldErrors.tipo} className="select-field" onChange={(e) => { setTipoGenerico(e.target.value as TipoPublicacaoOficial); setFieldErrors((current) => ({ ...current, tipo: null })); }} value={tipoGenerico}>
              {genericPublicacaoOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
            </select>
            {fieldErrors.tipo ? <span className="field-error-text">{fieldErrors.tipo}</span> : null}
          </div>
          <div className="admin-eval-field">
            <span>Titulo *</span>
            <input aria-invalid={!!fieldErrors.titulo} onChange={(e) => { setTituloGenerico(e.target.value); setFieldErrors((current) => ({ ...current, titulo: null })); }} placeholder="Titulo da publicacao..." value={tituloGenerico} />
            {fieldErrors.titulo ? <span className="field-error-text">{fieldErrors.titulo}</span> : null}
          </div>
        </div>

        <div className="admin-eval-field">
          <span>Descricao (opcional)</span>
          <textarea aria-invalid={!!fieldErrors.descricao} className="text-area" onChange={(e) => { setDescricaoGenerica(e.target.value); setFieldErrors((current) => ({ ...current, descricao: null })); }} value={descricaoGenerica} style={{ minHeight: 80 }} />
          {fieldErrors.descricao ? <span className="field-error-text">{fieldErrors.descricao}</span> : null}
        </div>

        {/* Dropzone visual */}
        <div className="admin-eval-field">
          <span>Arquivo PDF *</span>
          <label className={`admin-dropzone${fieldErrors.arquivoUrl ? " admin-dropzone--error" : ""}`}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Clique para selecionar ou arraste um PDF</span>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Apenas arquivos .pdf sao aceitos</span>
            <input accept="application/pdf,.pdf" key={arquivoGenericoKey} onChange={(event) => setArquivoGenerico(event.target.files?.[0] ?? null)} type="file" style={{ display: "none" }} />
          </label>
          {fieldErrors.arquivoUrl ? <span className="field-error-text">{fieldErrors.arquivoUrl}</span> : null}
          {arquivoGenerico ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, padding: 12, border: "1px solid #E2E8F0", borderRadius: 8, background: "#F8FAFC" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 13, color: "#0F172A" }}>{arquivoGenerico.name}</strong>
                <span style={{ fontSize: 12, color: "#64748B" }}>{formatFileSize(arquivoGenerico.size)} · Pronto para envio</span>
              </div>
              <button className="admin-pub-btn-preview" onClick={() => { setArquivoGenerico(null); setArquivoGenericoKey((current) => current + 1); }} style={{ color: "#DC2626", borderColor: "#FECACA" }} type="button">
                Remover
              </button>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer" }}>
            <input checked={versaoFinalGenerica} onChange={(e) => setVersaoFinalGenerica(e.target.checked)} type="checkbox" />
            Marcar como versao final do tipo
          </label>
          <button className="admin-page-cta" disabled={busy} type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Publicar documento
          </button>
        </div>
      </form>

      {/* Historico table */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Historico publicado</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Acompanhe o que esta vigente, o que foi republicado e quais arquivos foram enviados manualmente.</p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="admin-eval-field" style={{ minWidth: 220, marginBottom: 0 }}>
            <span>Filtrar por tipo</span>
            <select className="select-field" onChange={(event) => { setHistoryTypeFilter(event.target.value as "TODOS" | TipoPublicacaoOficial); setPage(1); }} value={historyTypeFilter}>
              <option value="TODOS">Todos os tipos</option>
              {tipoPublicacaoOficialOptions.map((value) => (
                <option key={value} value={value}>{getStatusLabel(value)}</option>
              ))}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer", paddingTop: 18 }}>
            <input checked={historyOnlyCurrent} onChange={(event) => { setHistoryOnlyCurrent(event.target.checked); setPage(1); }} type="checkbox" />
            Mostrar apenas versoes vigentes
          </label>
          <span style={{ fontSize: 12, color: "#64748B", paddingTop: 18 }}>
            {history?.total ?? 0} {(history?.total ?? 0) === 1 ? "registro encontrado" : "registros encontrados"}
          </span>
        </div>

        {pagedHistoryItems.length ? (
          <div className="admin-homologacao-table-wrap">
            <table className="admin-homologacao-table">
              <caption className="sr-only">Historico administrativo de publicacoes oficiais</caption>
              <thead>
                <tr>
                  <th scope="col" style={{ minWidth: 260 }}>Publicacao</th>
                  <th scope="col" style={{ minWidth: 140 }}>Tipo</th>
                  <th scope="col" style={{ minWidth: 120 }}>Origem</th>
                  <th scope="col" style={{ width: 120, textAlign: "center" }}>Versao</th>
                  <th scope="col" style={{ minWidth: 140 }}>Data</th>
                  <th scope="col" style={{ width: 90, textAlign: "center" }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {pagedHistoryItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <strong className="admin-homologacao-table-primary">{item.titulo}</strong>
                        <span className="admin-homologacao-table-muted">{item.descricao ?? "Sem descricao publica cadastrada."}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <span className="admin-homologacao-table-muted">{getStatusLabel(item.tipo)}</span>
                        {item.isVersaoAtualDoTipo ? (
                          <StatusBadge variant="info" shape="tag">Vigente</StatusBadge>
                        ) : null}
                        {item.versaoFinal ? (
                          <StatusBadge variant="success" shape="tag">Final</StatusBadge>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <StatusBadge shape="tag" variant={getOrigemArquivoVariant(item.origemArquivo)}>
                          {getOrigemArquivoLabel(item.origemArquivo)}
                        </StatusBadge>
                        {item.arquivoNomeOriginal ? <span className="admin-homologacao-table-muted">{item.arquivoNomeOriginal}</span> : null}
                        {item.arquivoTamanhoBytes ? <span className="admin-homologacao-table-muted">{formatFileSize(item.arquivoTamanhoBytes)}</span> : null}
                      </div>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 500, color: "#334155" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        <span>v{item.versao}</span>
                        <span style={{ fontSize: 12, color: item.republicacaoDeId ? "#B45309" : "#94A3B8", fontWeight: item.republicacaoDeId ? 600 : 500 }}>
                          {item.republicacaoDaVersao ? `Republica v${item.republicacaoDaVersao}` : "Original"}
                        </span>
                      </div>
                    </td>
                    <td className="admin-homologacao-table-muted">{formatIsoDate(item.publicadoEm)}</td>
                    <td className="admin-homologacao-table-center">
                      {item.arquivoUrl ? (
                        <Link className="admin-homologacao-table-link" href={resolveApiUrl(item.arquivoUrl)} rel="noreferrer" target="_blank">
                          Abrir
                        </Link>
                      ) : (
                        <span style={{ color: "#94A3B8" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={history?.overview?.totalPublicacoes ? "Nenhum registro no filtro atual" : "Sem publicacoes"}
            description={history?.overview?.totalPublicacoes ? "Ajuste os filtros para visualizar outras publicacoes deste edital." : "Ainda nao ha publicacoes oficiais registradas para este edital."}
          />
        )}

        <div className="admin-pagination">
          <span>Mostrando {history?.total ? ((page - 1) * PAGE_SIZE) + 1 : 0}–{Math.min(page * PAGE_SIZE, history?.total ?? 0)} de {history?.total ?? 0} publicacoes</span>
          <div className="admin-pagination-controls">
            <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">&lsaquo;</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              return start + i;
            }).filter((p) => p >= 1 && p <= totalPages).map((p) => (
              <button className={`admin-pagination-btn${p === page ? " admin-pagination-btn--active" : ""}`} key={p} onClick={() => setPage(p)} type="button">{p}</button>
            ))}
            <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">&rsaquo;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
