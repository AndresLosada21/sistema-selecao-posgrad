"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { StructuredPreview } from "@/components/shared/structured-preview";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { resolveApiUrl } from "@/lib/config/api";
import { useSession } from "@/lib/auth/session-provider";
import { tipoPublicacaoOficialOptions, type TipoPublicacaoOficial } from "@/lib/enums";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { publicationPhaseOptions } from "@/modules/admin-operacao/constants";
import { listAdminPublicacoesByEdital, previewClassificacaoPublicacao, previewHomologacaoPublicacao, publicarClassificacao, publicarGenerica, publicarHomologacao } from "@/modules/admin-publicacao/api";
import { previewPublicacaoPoliticas, publicarPoliticas } from "@/modules/admin-politicas/api";
import type { PublicacoesResponse } from "@/modules/publicacao/types";
import { formatIsoDate } from "@/modules/edital/formatters";

type Props = { params: Promise<{ editalId: string }> };

export default function AdminPublicacoesDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [history, setHistory] = useState<PublicacoesResponse | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [faseHomologacao, setFaseHomologacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [faseClassificacao, setFaseClassificacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [fasePoliticas, setFasePoliticas] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [tipoGenerico, setTipoGenerico] = useState<TipoPublicacaoOficial>("COMUNICADO");
  const [tituloGenerico, setTituloGenerico] = useState("");
  const [descricaoGenerica, setDescricaoGenerica] = useState("");
  const [arquivoUrlGenerico, setArquivoUrlGenerico] = useState("");
  const [versaoFinalGenerica, setVersaoFinalGenerica] = useState(false);
  const [dadosConsolidadosGenerico, setDadosConsolidadosGenerico] = useState("{}");

  useEffect(() => { let cancelled = false; params.then((resolved) => { if (!cancelled) setEditalId(resolved.editalId); }); return () => { cancelled = true; }; }, [params]);

  useEffect(() => {
    if (!editalId || !token) return;
    listAdminPublicacoesByEdital(editalId, token)
      .then((response) => {
        setHistory(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage({ type: "error", text: getErrorMessage(error) });
        setStatus("error");
      });
  }, [editalId, signOut, token]);

  async function loadPreview(type: "homologacao" | "classificacao" | "politicas") {
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      const response = type === "homologacao"
        ? await previewHomologacaoPublicacao(editalId, faseHomologacao, token)
        : type === "classificacao"
          ? await previewClassificacaoPublicacao(editalId, faseClassificacao, token)
          : await previewPublicacaoPoliticas(editalId, fasePoliticas, token);
      setPreview(response);
      setPreviewLabel(`${type} · ${type === "homologacao" ? faseHomologacao : type === "classificacao" ? faseClassificacao : fasePoliticas}`);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function publish(type: "homologacao" | "classificacao" | "politicas") {
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      if (type === "homologacao") {
        await publicarHomologacao(editalId, { fase: faseHomologacao, descricao: `Publicacao ${faseHomologacao.toLowerCase()} de homologacao.` }, token);
      } else if (type === "classificacao") {
        await publicarClassificacao(editalId, { fase: faseClassificacao, descricao: `Publicacao ${faseClassificacao.toLowerCase()} de classificacao.` }, token);
      } else {
        await publicarPoliticas(editalId, { fase: fasePoliticas, descricao: `Publicacao ${fasePoliticas.toLowerCase()} de politicas afirmativas.` }, token);
      }
      setMessage({ type: "success", text: `Publicacao de ${type} criada com sucesso.` });
      const response = await listAdminPublicacoesByEdital(editalId, token);
      setHistory(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function handlePublicacaoGenerica(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      let dadosConsolidados: Record<string, unknown> | undefined;

      if (dadosConsolidadosGenerico.trim()) {
        try {
          dadosConsolidados = JSON.parse(dadosConsolidadosGenerico) as Record<string, unknown>;
        } catch {
          setMessage({ type: "error", text: "Os dados consolidados precisam ser um JSON valido antes da publicacao." });
          return;
        }
      }

      await publicarGenerica(editalId, {
        tipo: tipoGenerico,
        titulo: tituloGenerico,
        descricao: descricaoGenerica || undefined,
        versaoFinal: versaoFinalGenerica,
        arquivoUrl: arquivoUrlGenerico || undefined,
        dadosConsolidados,
      }, token);
      setMessage({ type: "success", text: "Publicacao generica criada com sucesso." });
      setTituloGenerico("");
      setDescricaoGenerica("");
      setArquivoUrlGenerico("");
      setVersaoFinalGenerica(false);
      setDadosConsolidadosGenerico("{}");
      setHistory(await listAdminPublicacoesByEdital(editalId, token));
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando publicacoes" description="Consultando o historico de publicacoes do edital." />;
  if (status === "error") return <ErrorState title="Falha ao carregar publicacoes" description={message?.text} />;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback description={message.text} title="Retorno operacional" type={message.type} /> : null}

      <SectionCard title={`Publicacoes do edital ${editalId ?? ""}`} description="Preview e criacao de publicacoes oficiais por edital.">
        <div className="form-grid">
          <label className="field-block"><span>Fase da homologacao</span><select className="select-field" onChange={(e) => setFaseHomologacao(e.target.value as "PRELIMINAR" | "FINAL")} value={faseHomologacao}>{publicationPhaseOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="field-block"><span>Fase da classificacao</span><select className="select-field" onChange={(e) => setFaseClassificacao(e.target.value as "PRELIMINAR" | "FINAL")} value={faseClassificacao}>{publicationPhaseOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="field-block"><span>Fase de politicas afirmativas</span><select className="select-field" onChange={(e) => setFasePoliticas(e.target.value as "PRELIMINAR" | "FINAL")} value={fasePoliticas}>{publicationPhaseOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className="content-item-links">
          <ActionButton disabled={busy} onClick={() => loadPreview("homologacao")} type="button" variant="secondary">Preview homologacao</ActionButton>
          <ActionButton disabled={busy} onClick={() => loadPreview("classificacao")} type="button" variant="secondary">Preview classificacao</ActionButton>
          <ActionButton disabled={busy} onClick={() => loadPreview("politicas")} type="button" variant="secondary">Preview politicas</ActionButton>
          <ActionButton disabled={busy} onClick={() => publish("homologacao")} type="button">Publicar homologacao</ActionButton>
          <ActionButton disabled={busy} onClick={() => publish("classificacao")} type="button">Publicar classificacao</ActionButton>
          <ActionButton disabled={busy} onClick={() => publish("politicas")} type="button">Publicar politicas</ActionButton>
        </div>
        {previewLabel ? <small>Preview carregado: {previewLabel}</small> : null}
        {preview ? <StructuredPreview data={preview} /> : null}
      </SectionCard>

      <SectionCard title="Publicacao generica" description="Cria publicacoes administrativas fora dos fluxos especializados, como comunicados, retificacoes e avisos gerais.">
        <form className="form-grid" onSubmit={handlePublicacaoGenerica}>
          <label className="field-block"><span>Tipo</span><select className="select-field" onChange={(event) => setTipoGenerico(event.target.value as TipoPublicacaoOficial)} value={tipoGenerico}>{tipoPublicacaoOficialOptions.map((value) => <option key={value} value={value}>{getStatusLabel(value)}</option>)}</select></label>
          <label className="field-block"><span>Titulo</span><input onChange={(event) => setTituloGenerico(event.target.value)} required value={tituloGenerico} /></label>
          <label className="field-block"><span>Descricao</span><textarea className="text-area" onChange={(event) => setDescricaoGenerica(event.target.value)} value={descricaoGenerica} /></label>
          <label className="field-block"><span>Arquivo URL (opcional)</span><input onChange={(event) => setArquivoUrlGenerico(event.target.value)} value={arquivoUrlGenerico} /></label>
          <label className="field-block"><span>Dados consolidados (JSON opcional)</span><textarea className="text-area" onChange={(event) => setDadosConsolidadosGenerico(event.target.value)} value={dadosConsolidadosGenerico} /></label>
          <label className="field-inline"><input checked={versaoFinalGenerica} onChange={(event) => setVersaoFinalGenerica(event.target.checked)} type="checkbox" /><span>Marcar como versao final</span></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Criar publicacao generica</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Historico publicado" description="Leitura do historico versionado de publicacoes oficiais do edital.">
        {history?.items.length ? (
          <div className="content-list">
            {history.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.titulo}</strong><StatusBadge variant={getStatusVariant(item.tipo)}>{getStatusLabel(item.tipo)}</StatusBadge></div>
                <small>Versao: {item.versao}</small>
                <small>Versao final: {item.versaoFinal ? "sim" : "nao"}</small>
                <small>Publicado em: {formatIsoDate(item.publicadoEm)}</small>
                <small>Historico: {item.versao > 1 ? "republicacao" : "publicacao inicial"}</small>
                <div className="content-item-links"><Link className="nav-link" href={resolveApiUrl(item.arquivoUrl)} rel="noreferrer" target="_blank">Abrir PDF oficial</Link></div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem publicacoes" description="Ainda nao ha publicacoes oficiais registradas para este edital." />}
      </SectionCard>
    </div>
  );
}
