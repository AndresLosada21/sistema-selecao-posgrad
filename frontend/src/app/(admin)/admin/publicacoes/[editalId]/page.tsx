"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { publicationPhaseOptions } from "@/modules/admin-operacao/constants";
import { previewClassificacaoPublicacao, previewHomologacaoPublicacao, publicarClassificacao, publicarHomologacao } from "@/modules/admin-publicacao/api";
import { listPublicacoesByEdital } from "@/modules/publicacao/api";
import type { PublicacoesResponse } from "@/modules/publicacao/types";
import { formatIsoDate } from "@/modules/edital/formatters";

type Props = { params: Promise<{ editalId: string }> };

export default function AdminPublicacoesDetailPage({ params }: Props) {
  const session = useSession();
  const [editalId, setEditalId] = useState<string | null>(null);
  const [history, setHistory] = useState<PublicacoesResponse | null>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [faseHomologacao, setFaseHomologacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [faseClassificacao, setFaseClassificacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");

  useEffect(() => { params.then((resolved) => setEditalId(resolved.editalId)); }, [params]);

  useEffect(() => {
    if (!editalId) return;
    listPublicacoesByEdital(editalId)
      .then((response) => {
        setHistory(response);
        setStatus("ready");
      })
      .catch((error) => {
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [editalId]);

  async function loadPreview(type: "homologacao" | "classificacao") {
    if (!session.token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      const response = type === "homologacao"
        ? await previewHomologacaoPublicacao(editalId, faseHomologacao, session.token)
        : await previewClassificacaoPublicacao(editalId, faseClassificacao, session.token);
      setPreview(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function publish(type: "homologacao" | "classificacao") {
    if (!session.token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      if (type === "homologacao") {
        await publicarHomologacao(editalId, { fase: faseHomologacao, descricao: `Publicacao ${faseHomologacao.toLowerCase()} de homologacao.` }, session.token);
      } else {
        await publicarClassificacao(editalId, { fase: faseClassificacao, descricao: `Publicacao ${faseClassificacao.toLowerCase()} de classificacao.` }, session.token);
      }
      setMessage(`Publicacao de ${type} criada com sucesso.`);
      const response = await listPublicacoesByEdital(editalId);
      setHistory(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando publicacoes" description="Consultando o historico de publicacoes do edital." />;
  if (status === "error") return <ErrorState title="Falha ao carregar publicacoes" description={message ?? undefined} />;

  return (
    <div className="stack-layout">
      <SectionCard title={`Publicacoes do edital ${editalId ?? ""}`} description="Preview e criacao de publicacoes oficiais por edital.">
        <div className="form-grid">
          <label className="field-block"><span>Fase da homologacao</span><select className="select-field" onChange={(e) => setFaseHomologacao(e.target.value as "PRELIMINAR" | "FINAL")} value={faseHomologacao}>{publicationPhaseOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="field-block"><span>Fase da classificacao</span><select className="select-field" onChange={(e) => setFaseClassificacao(e.target.value as "PRELIMINAR" | "FINAL")} value={faseClassificacao}>{publicationPhaseOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className="content-item-links">
          <button className="secondary-button" disabled={busy} onClick={() => loadPreview("homologacao")} type="button">Preview homologacao</button>
          <button className="secondary-button" disabled={busy} onClick={() => loadPreview("classificacao")} type="button">Preview classificacao</button>
          <button className="action-button" disabled={busy} onClick={() => publish("homologacao")} type="button">Publicar homologacao</button>
          <button className="action-button" disabled={busy} onClick={() => publish("classificacao")} type="button">Publicar classificacao</button>
        </div>
        {preview ? <pre className="preformatted-block">{JSON.stringify(preview, null, 2)}</pre> : null}
      </SectionCard>

      <SectionCard title="Historico publicado" description="Leitura do historico versionado de publicacoes oficiais do edital.">
        {history?.items.length ? (
          <div className="content-list">
            {history.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.titulo}</strong><StatusBadge>{item.tipo}</StatusBadge></div>
                <small>Versao: {item.versao}</small>
                <small>Versao final: {item.versaoFinal ? "sim" : "nao"}</small>
                <small>Publicado em: {formatIsoDate(item.publicadoEm)}</small>
                <small>Republicacao de: {item.republicacaoDeId ?? "publicacao inicial"}</small>
                <div className="content-item-links"><Link className="nav-link" href={item.arquivoUrl} target="_blank">Abrir PDF oficial</Link></div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem publicacoes" description="Ainda nao ha publicacoes oficiais registradas para este edital." />}
      </SectionCard>
      {message ? <ErrorState title="Retorno operacional" description={message} /> : null}
    </div>
  );
}
