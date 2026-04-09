"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { StructuredPreview } from "@/components/shared/structured-preview";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { resolveApiUrl } from "@/lib/config/api";
import { useSession } from "@/lib/auth/session-provider";
import { tipoPublicacaoOficialOptions, type TipoPublicacaoOficial } from "@/lib/enums";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listAdminPublicacoesByEdital, previewClassificacaoPublicacao, previewHomologacaoPublicacao, publicarClassificacao, publicarGenerica, publicarHomologacao } from "@/modules/admin-publicacao/api";
import { previewPublicacaoPoliticas, publicarPoliticas } from "@/modules/admin-politicas/api";
import type { PublicacoesResponse } from "@/modules/publicacao/types";

type Props = { params: Promise<{ editalId: string }> };

const PAGE_SIZE = 20;

type PubType = "homologacao" | "classificacao" | "politicas";

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
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    params.then((r) => { if (!cancelled) setEditalId(r.editalId); });
    return () => { cancelled = true; };
  }, [params]);

  const reload = async () => {
    if (!editalId || !token) return;
    const response = await listAdminPublicacoesByEdital(editalId, token, { page, pageSize: PAGE_SIZE });
    setHistory(response);
  };

  useAbortableEffect(async (signal) => {
    if (!editalId || !token) return;
    try {
      await reload();
      if (signal.aborted) return;
      setPageStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(error) });
      setPageStatus("error");
    }
  }, [editalId, page, signOut, token]);

  const faseFor = (type: PubType) => type === "homologacao" ? faseHomologacao : type === "classificacao" ? faseClassificacao : fasePoliticas;

  async function loadPreview(type: PubType) {
    if (!token || !editalId) return;
    setBusy(true);
    setFeedback(null);
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
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function publish(type: PubType) {
    if (!token || !editalId) return;
    setBusy(true);
    setFeedback(null);
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
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function handlePublicacaoGenerica(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editalId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const dados: Record<string, unknown> = {};
      if (resumoGenerico) dados.resumoPublico = resumoGenerico;
      if (observacoesGenericas) dados.observacoesInternas = observacoesGenericas;
      if (referenciaGenerica) dados.referenciaExterna = referenciaGenerica;

      await publicarGenerica(editalId, {
        tipo: tipoGenerico,
        titulo: tituloGenerico,
        descricao: descricaoGenerica || undefined,
        versaoFinal: versaoFinalGenerica,
        dadosConsolidados: Object.keys(dados).length ? dados : undefined,
      }, token);
      setFeedback({ type: "success", text: "Publicacao generica criada." });
      setTituloGenerico("");
      setDescricaoGenerica("");
      setVersaoFinalGenerica(false);
      setResumoGenerico("");
      setObservacoesGenericas("");
      setReferenciaGenerica("");
      await reload();
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (pageStatus === "loading") return <LoadingState title="Carregando publicacoes" description="Consultando o historico do edital." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar publicacoes" description={feedback?.text} />;

  const totalPages = history ? Math.max(1, Math.ceil(history.total / (history.pageSize ?? PAGE_SIZE))) : 1;

  // Detect latest pub status per type for dot color
  const latestHomPub = history?.items.find((i) => i.tipo.includes("HOMOLOGACAO"));
  const latestClassPub = history?.items.find((i) => i.tipo.includes("CLASSIFICACAO"));
  const latestPolPub = history?.items.find((i) => i.tipo.includes("POLITICAS"));

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && <PageFeedback description={feedback.text} title="Retorno" type={feedback.type} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="admin-page-header-left" style={{ flex: 1 }}>
          <h1>Publicacoes — Edital {editalId ?? ""}</h1>
          <p>Preview, publicacao e historico versionado.</p>
        </div>
      </div>

      {/* Confirmation guard */}
      {confirmPublish && (
        <div className="admin-form-card" style={{ gap: 12 }}>
          <PageFeedback
            type="warning"
            title={`Confirmar publicacao de ${confirmPublish.type}`}
            description={`Voce esta prestes a criar uma publicacao oficial ${confirmPublish.fase.toLowerCase()} de ${confirmPublish.type}. Esta acao gera um PDF oficial e um registro auditavel no historico do edital.`}
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <span className="admin-pub-card-title">Publicar Homologacao</span>
          </div>
          <p className="admin-pub-card-desc">Gere o preview da homologacao preliminar ou final e publique o PDF oficial com snapshot auditavel.</p>
          <div className="admin-pub-card-status">
            <span className={`admin-pub-card-dot ${latestHomPub ? "admin-pub-card-dot--green" : "admin-pub-card-dot--yellow"}`} />
            <span>{latestHomPub ? `Homologacao publicada (v${latestHomPub.versao})` : "Homologacao ainda nao publicada"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select className="select-field" onChange={(e) => setFaseHomologacao(e.target.value as "PRELIMINAR" | "FINAL")} style={{ width: 140 }} value={faseHomologacao}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
          </div>
          <div className="admin-pub-card-actions">
            <button className="admin-pub-btn-preview" disabled={busy} onClick={() => loadPreview("homologacao")} type="button">Preview</button>
            <button className="admin-pub-btn-publish" disabled={busy} onClick={() => setConfirmPublish({ type: "homologacao", fase: faseHomologacao })} type="button">Publicar</button>
          </div>
        </div>

        {/* Classificacao */}
        <div className="admin-pub-card">
          <div className="admin-pub-card-header">
            <div className="admin-pub-card-icon admin-pub-card-icon--purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.4 4 6 5 6 5s.6-1 1.5-1a2.5 2.5 0 0 1 0 5H6z"/><path d="M6 2v7"/><path d="M12 15.5c0 .83.67 1.5 1.5 1.5h1a1.5 1.5 0 0 0 0-3h-1a1.5 1.5 0 0 1 0-3h1c.83 0 1.5.67 1.5 1.5"/><path d="M14 10v1m0 6v1"/><path d="M2 12h20"/><rect x="2" y="2" width="20" height="20" rx="5"/></svg>
            </div>
            <span className="admin-pub-card-title">Publicar Classificacao</span>
          </div>
          <p className="admin-pub-card-desc">Gere o ranking consolidado por linha e modalidade e publique o PDF oficial da classificacao final.</p>
          <div className="admin-pub-card-status">
            <span className={`admin-pub-card-dot ${latestClassPub ? "admin-pub-card-dot--green" : "admin-pub-card-dot--yellow"}`} />
            <span>{latestClassPub ? `Classificacao publicada (v${latestClassPub.versao})` : "Classificacao ainda nao publicada"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select className="select-field" onChange={(e) => setFaseClassificacao(e.target.value as "PRELIMINAR" | "FINAL")} style={{ width: 140 }} value={faseClassificacao}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
          </div>
          <div className="admin-pub-card-actions">
            <button className="admin-pub-btn-preview" disabled={busy} onClick={() => loadPreview("classificacao")} type="button">Preview</button>
            <button className="admin-pub-btn-publish" disabled={busy} onClick={() => setConfirmPublish({ type: "classificacao", fase: faseClassificacao })} type="button">Publicar</button>
          </div>
        </div>

        {/* Politicas */}
        <div className="admin-pub-card">
          <div className="admin-pub-card-header">
            <div className="admin-pub-card-icon admin-pub-card-icon--indigo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span className="admin-pub-card-title">Publicar Pol. Afirmativas</span>
          </div>
          <p className="admin-pub-card-desc">Publique o resultado da etapa de politicas afirmativas/heteroidentificacao com snapshot auditavel.</p>
          <div className="admin-pub-card-status">
            <span className={`admin-pub-card-dot ${latestPolPub ? "admin-pub-card-dot--green" : "admin-pub-card-dot--blue"}`} />
            <span>{latestPolPub ? `Politicas publicadas (v${latestPolPub.versao})` : "Resultado preliminar disponivel para publicacao."}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select className="select-field" onChange={(e) => setFasePoliticas(e.target.value as "PRELIMINAR" | "FINAL")} style={{ width: 140 }} value={fasePoliticas}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
          </div>
          <div className="admin-pub-card-actions">
            <button className="admin-pub-btn-preview" disabled={busy} onClick={() => loadPreview("politicas")} type="button">Preview</button>
            <button className="admin-pub-btn-publish" disabled={busy} onClick={() => setConfirmPublish({ type: "politicas", fase: fasePoliticas })} type="button">Publicar</button>
          </div>
        </div>
      </div>

      {/* Preview area */}
      {previewLabel && (
        <div className="admin-form-card">
          <h2 className="admin-form-card-title">{previewLabel}</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Dados consolidados retornados pelo backend. Revise antes de publicar.</p>
          {preview ? <StructuredPreview data={preview} /> : <EmptyState title="Preview vazio" description="O backend retornou um preview sem dados." />}
          <button className="admin-pub-btn-preview" onClick={() => { setPreview(null); setPreviewLabel(null); }} type="button">Fechar preview</button>
        </div>
      )}

      {/* Historico table */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Historico publicado</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Todas as publicacoes oficiais do edital em ordem cronologica.</p>

        {history?.items.length ? (
          <div className="admin-homologacao-table-wrap">
            <table className="admin-homologacao-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Titulo</th>
                  <th style={{ minWidth: 140 }}>Tipo</th>
                  <th style={{ width: 80, textAlign: "center" }}>Versao</th>
                  <th style={{ minWidth: 140 }}>Data</th>
                  <th style={{ width: 60, textAlign: "center" }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item) => (
                  <tr key={item.id}>
                    <td className="admin-homologacao-table-primary">{item.titulo}</td>
                    <td className="admin-homologacao-table-muted">{getStatusLabel(item.tipo)}</td>
                    <td style={{ textAlign: "center", fontWeight: 500, color: "#334155" }}>
                      {item.versao}
                      {item.versaoFinal && (
                        <StatusBadge variant="success" shape="tag">Final</StatusBadge>
                      )}
                    </td>
                    <td className="admin-homologacao-table-muted">{formatIsoDate(item.publicadoEm)}</td>
                    <td className="admin-homologacao-table-center">
                      <Link className="admin-homologacao-table-link" href={resolveApiUrl(item.arquivoUrl)} rel="noreferrer" target="_blank">
                        PDF
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sem publicacoes" description="Ainda nao ha publicacoes oficiais registradas para este edital." />
        )}

        <div className="admin-pagination">
          <span>Mostrando {((page - 1) * PAGE_SIZE) + 1}–{((page - 1) * PAGE_SIZE) + (history?.items.length ?? 0)} de {history?.total ?? 0} publicacoes</span>
          <div className="admin-pagination-controls">
            <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">&lsaquo;</button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button className={`admin-pagination-btn${p === page ? " admin-pagination-btn--active" : ""}`} key={p} onClick={() => setPage(p)} type="button">{p}</button>
            ))}
            <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">&rsaquo;</button>
          </div>
        </div>
      </div>

      {/* Publicacao generica */}
      <form className="admin-form-card" onSubmit={handlePublicacaoGenerica}>
        <h2 className="admin-form-card-title">Publicacao generica</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Crie publicacoes avulsas: comunicados, retificacoes, resultados de isencao e outros tipos nao especializados.</p>

        <div className="admin-form-row">
          <div className="admin-eval-field">
            <label>Tipo *</label>
            <select className="select-field" onChange={(e) => setTipoGenerico(e.target.value as TipoPublicacaoOficial)} value={tipoGenerico}>
              {tipoPublicacaoOficialOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
            </select>
          </div>
          <div className="admin-eval-field">
            <label>Titulo *</label>
            <input onChange={(e) => setTituloGenerico(e.target.value)} placeholder="Titulo da publicacao..." required value={tituloGenerico} />
          </div>
        </div>

        <div className="admin-form-row">
          <div className="admin-eval-field">
            <label>Descricao</label>
            <textarea className="text-area" onChange={(e) => setDescricaoGenerica(e.target.value)} value={descricaoGenerica} />
          </div>
          <div className="admin-eval-field">
            <label>Resumo publico</label>
            <textarea className="text-area" onChange={(e) => setResumoGenerico(e.target.value)} value={resumoGenerico} />
          </div>
        </div>

        <div className="admin-form-row">
          <div className="admin-eval-field">
            <label>Observacoes internas</label>
            <textarea className="text-area" onChange={(e) => setObservacoesGenericas(e.target.value)} value={observacoesGenericas} />
          </div>
          <div className="admin-eval-field">
            <label>Referencia externa</label>
            <input onChange={(e) => setReferenciaGenerica(e.target.value)} value={referenciaGenerica} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer" }}>
            <input checked={versaoFinalGenerica} onChange={(e) => setVersaoFinalGenerica(e.target.checked)} type="checkbox" />
            Versao final
          </label>
          <button className="admin-page-cta" disabled={busy} type="submit">Criar publicacao</button>
        </div>
      </form>
    </div>
  );
}
