"use client";

import { FormEvent, useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { previewPublicacaoPoliticas, publicarPoliticas, registrarEncaminhamentoPoliticas, registrarResultadoFinalPoliticas, registrarResultadoPreliminarPoliticas, listPoliticas } from "@/modules/admin-politicas/api";
import type { PoliticasEtapaItem } from "@/modules/admin-politicas/types";
import { resultadoPoliticasOptions } from "@/modules/admin-operacao/constants";

type Props = { params: Promise<{ inscricaoId: string }> };

export default function AdminPoliticasDetailPage({ params }: Props) {
  const session = useSession();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<PoliticasEtapaItem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editalId, setEditalId] = useState("");
  const [encaminhamento, setEncaminhamento] = useState({ convocadoEm: "", documentosEncaminhadosEm: "", protocoloEncaminhamento: "", observacaoEncaminhamento: "" });
  const [preliminar, setPreliminar] = useState<{ resultado: (typeof resultadoPoliticasOptions)[number]; parecer: string; arquivoRetornoUrl: string }>({ resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" });
  const [finalResult, setFinalResult] = useState<{ resultado: (typeof resultadoPoliticasOptions)[number]; parecer: string; arquivoRetornoUrl: string }>({ resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { params.then((resolved) => setInscricaoId(resolved.inscricaoId)); }, [params]);

  useEffect(() => {
    if (!session.token || !inscricaoId) return;
    // busca ampla por edital precisa do editalId; usar listagem do edital informado pela url interna do item quando carregado posteriormente nao existe endpoint por inscricao
    setStatus("ready");
  }, [inscricaoId, session]);

  async function loadByEdital() {
    if (!session.token || !editalId || !inscricaoId) return;
    setBusy(true); setMessage(null);
    try {
      const response = await listPoliticas(editalId, session.token);
      const found = response.items.find((entry) => entry.inscricao.id === inscricaoId) ?? null;
      setItem(found);
      if (found) {
        setEncaminhamento({
          convocadoEm: found.convocadoEm ?? "",
          documentosEncaminhadosEm: found.documentosEncaminhadosEm ?? "",
          protocoloEncaminhamento: found.protocoloEncaminhamento ?? "",
          observacaoEncaminhamento: found.observacaoEncaminhamento ?? "",
        });
      }
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function submitEncaminhamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session.token || !inscricaoId) return; setBusy(true); setMessage(null);
    try { await registrarEncaminhamentoPoliticas(inscricaoId, encaminhamento, session.token); setMessage("Encaminhamento registrado."); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function submitPreliminar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session.token || !inscricaoId) return; setBusy(true); setMessage(null);
    try { await registrarResultadoPreliminarPoliticas(inscricaoId, { ...preliminar, arquivoRetornoUrl: preliminar.arquivoRetornoUrl || undefined }, session.token); setMessage("Resultado preliminar registrado."); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function submitFinal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session.token || !inscricaoId) return; setBusy(true); setMessage(null);
    try { await registrarResultadoFinalPoliticas(inscricaoId, { ...finalResult, arquivoRetornoUrl: finalResult.arquivoRetornoUrl || undefined }, session.token); setMessage("Resultado final registrado."); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function loadPreview(fase: "PRELIMINAR" | "FINAL") {
    if (!session.token || !editalId) return;
    setBusy(true); setMessage(null);
    try { setPreview(await previewPublicacaoPoliticas(editalId, fase, session.token)); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function publish(fase: "PRELIMINAR" | "FINAL") {
    if (!session.token || !editalId) return;
    setBusy(true); setMessage(null);
    try { await publicarPoliticas(editalId, { fase, descricao: `Publicacao ${fase.toLowerCase()} de politicas afirmativas.` }, session.token); setMessage(`Publicacao ${fase.toLowerCase()} criada.`); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando politicas afirmativas" description="Preparando o detalhe operacional por inscricao." />;

  return (
    <div className="stack-layout">
      <SectionCard title="Carga do detalhe" description="Informe o edital para localizar a etapa vinculada a esta inscricao.">
        <div className="field-block"><span>ID do edital</span><input onChange={(e) => setEditalId(e.target.value)} value={editalId} /></div>
        <div className="content-item-links"><button className="secondary-button" disabled={busy} onClick={loadByEdital} type="button">Carregar etapa</button></div>
      </SectionCard>

      {item ? (
        <>
          <SectionCard title={`Politicas afirmativas de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
            <div className="content-list">
              <small>Tipo: {item.tipo}</small>
              <small>Status operacional: {item.statusOperacao}</small>
              <small>Resultado preliminar: {item.resultadoPreliminar}</small>
              <small>Resultado final: {item.resultadoFinal}</small>
            </div>
          </SectionCard>

          <SectionCard title="Documentos de reserva" description="Documentos recebidos e vinculados a esta etapa.">
            <div className="content-list">
              {item.documentosReserva.map((documento) => (
                <article className="content-item" key={documento.id}>
                  <strong>{documento.tipo}</strong>
                  <small>Arquivo: {documento.nomeArquivo ?? "sem nome"}</small>
                  <small>URL: {documento.urlArquivo}</small>
                  <small>Status: {documento.statusValidacao ?? "SEM_VALIDACAO"}</small>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Encaminhamento" description="Registro administrativo do encaminhamento documental.">
            <form className="form-grid" onSubmit={submitEncaminhamento}>
              <label className="field-block"><span>Convocado em (ISO)</span><input onChange={(e) => setEncaminhamento((c) => ({ ...c, convocadoEm: e.target.value }))} value={encaminhamento.convocadoEm} /></label>
              <label className="field-block"><span>Documentos encaminhados em (ISO)</span><input onChange={(e) => setEncaminhamento((c) => ({ ...c, documentosEncaminhadosEm: e.target.value }))} value={encaminhamento.documentosEncaminhadosEm} /></label>
              <label className="field-block"><span>Protocolo</span><input onChange={(e) => setEncaminhamento((c) => ({ ...c, protocoloEncaminhamento: e.target.value }))} value={encaminhamento.protocoloEncaminhamento} /></label>
              <label className="field-block"><span>Observacao</span><textarea className="text-area" onChange={(e) => setEncaminhamento((c) => ({ ...c, observacaoEncaminhamento: e.target.value }))} value={encaminhamento.observacaoEncaminhamento} /></label>
              <button className="action-button" disabled={busy} type="submit">Registrar encaminhamento</button>
            </form>
          </SectionCard>

          <SectionCard title="Resultado preliminar" description="Registro preliminar da etapa de politicas afirmativas.">
            <form className="form-grid" onSubmit={submitPreliminar}>
              <label className="field-block"><span>Resultado</span><select className="select-field" onChange={(e) => setPreliminar((c) => ({ ...c, resultado: e.target.value as (typeof resultadoPoliticasOptions)[number] }))} value={preliminar.resultado}>{resultadoPoliticasOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="field-block"><span>Parecer</span><textarea className="text-area" onChange={(e) => setPreliminar((c) => ({ ...c, parecer: e.target.value }))} value={preliminar.parecer} /></label>
              <label className="field-block"><span>Arquivo de retorno</span><input onChange={(e) => setPreliminar((c) => ({ ...c, arquivoRetornoUrl: e.target.value }))} value={preliminar.arquivoRetornoUrl} /></label>
              <button className="action-button" disabled={busy} type="submit">Registrar preliminar</button>
            </form>
          </SectionCard>

          <SectionCard title="Resultado final" description="Registro final da etapa de politicas afirmativas.">
            <form className="form-grid" onSubmit={submitFinal}>
              <label className="field-block"><span>Resultado</span><select className="select-field" onChange={(e) => setFinalResult((c) => ({ ...c, resultado: e.target.value as (typeof resultadoPoliticasOptions)[number] }))} value={finalResult.resultado}>{resultadoPoliticasOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="field-block"><span>Parecer</span><textarea className="text-area" onChange={(e) => setFinalResult((c) => ({ ...c, parecer: e.target.value }))} value={finalResult.parecer} /></label>
              <label className="field-block"><span>Arquivo de retorno</span><input onChange={(e) => setFinalResult((c) => ({ ...c, arquivoRetornoUrl: e.target.value }))} value={finalResult.arquivoRetornoUrl} /></label>
              <button className="action-button" disabled={busy} type="submit">Registrar final</button>
            </form>
          </SectionCard>

          <SectionCard title="Publicacao da etapa" description="Preview e criacao da publicacao oficial de politicas afirmativas.">
            <div className="content-item-links">
              <button className="secondary-button" disabled={busy} onClick={() => loadPreview("PRELIMINAR")} type="button">Preview preliminar</button>
              <button className="secondary-button" disabled={busy} onClick={() => loadPreview("FINAL")} type="button">Preview final</button>
              <button className="action-button" disabled={busy} onClick={() => publish("PRELIMINAR")} type="button">Publicar preliminar</button>
              <button className="action-button" disabled={busy} onClick={() => publish("FINAL")} type="button">Publicar final</button>
            </div>
            {preview ? <pre className="preformatted-block">{JSON.stringify(preview, null, 2)}</pre> : null}
          </SectionCard>
        </>
      ) : <EmptyState title="Etapa nao carregada" description="Carregue a etapa pelo edital para operar este modulo." />}

      {message ? <ErrorState title="Retorno operacional" description={message} /> : null}
    </div>
  );
}
