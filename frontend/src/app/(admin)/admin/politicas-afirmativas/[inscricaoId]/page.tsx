"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StructuredPreview } from "@/components/shared/structured-preview";
import { getStatusLabel } from "@/components/shared/status-variant-map";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { uploadPrivateFile } from "@/modules/upload/api";
import { getPoliticasByInscricao, previewPublicacaoPoliticas, publicarPoliticas, registrarEncaminhamentoPoliticas, registrarResultadoFinalPoliticas, registrarResultadoPreliminarPoliticas } from "@/modules/admin-politicas/api";
import type { PoliticasEtapaItem } from "@/modules/admin-politicas/types";
import { resultadoPoliticasOptions } from "@/modules/admin-operacao/constants";

type Props = { params: Promise<{ inscricaoId: string }> };

export default function AdminPoliticasDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const searchParams = useSearchParams();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<PoliticasEtapaItem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editalId, setEditalId] = useState("");
  const [encaminhamento, setEncaminhamento] = useState({ convocadoEm: "", documentosEncaminhadosEm: "", protocoloEncaminhamento: "", observacaoEncaminhamento: "" });
  const [preliminar, setPreliminar] = useState<{ resultado: (typeof resultadoPoliticasOptions)[number]; parecer: string; arquivoRetornoUrl: string }>({ resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" });
  const [finalResult, setFinalResult] = useState<{ resultado: (typeof resultadoPoliticasOptions)[number]; parecer: string; arquivoRetornoUrl: string }>({ resultado: resultadoPoliticasOptions[0], parecer: "", arquivoRetornoUrl: "" });
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busyDownloadId, setBusyDownloadId] = useState<string | null>(null);

  useEffect(() => { let cancelled = false; params.then((resolved) => { if (!cancelled) setInscricaoId(resolved.inscricaoId); }); return () => { cancelled = true; }; }, [params]);

  useEffect(() => {
    const editalIdFromQuery = searchParams?.get("editalId");
    if (editalIdFromQuery) {
      setEditalId(editalIdFromQuery);
    }
  }, [searchParams]);

  const loadByEdital = useCallback(async () => {
    if (!token || !inscricaoId) return;
    setBusy(true); setMessage(null);
    try {
      const found = await getPoliticasByInscricao(inscricaoId, token);
      setItem(found);
      setEditalId((current) => current || found.edital.id);
      if (found) {
        setEncaminhamento({
          convocadoEm: found.convocadoEm ?? "",
          documentosEncaminhadosEm: found.documentosEncaminhadosEm ?? "",
          protocoloEncaminhamento: found.protocoloEncaminhamento ?? "",
          observacaoEncaminhamento: found.observacaoEncaminhamento ?? "",
        });
        setPreliminar({
          resultado: (found.resultadoPreliminar as (typeof resultadoPoliticasOptions)[number]) ?? resultadoPoliticasOptions[0],
          parecer: found.parecerPreliminar ?? "",
          arquivoRetornoUrl: found.arquivoRetornoPreliminarUrl ?? "",
        });
        setFinalResult({
          resultado: (found.resultadoFinal as (typeof resultadoPoliticasOptions)[number]) ?? resultadoPoliticasOptions[0],
          parecer: found.parecerFinal ?? "",
          arquivoRetornoUrl: found.arquivoRetornoFinalUrl ?? "",
        });
      } else {
        setMessage({ type: "warning", text: "Nenhuma etapa de politicas afirmativas foi encontrada para esta inscricao no edital informado." });
      }
      setStatus("ready");
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
      setStatus("error");
    } finally { setBusy(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- editalId inferred from response, not a trigger
  }, [inscricaoId, signOut, token]);

  useAbortableEffect(async (signal) => {
    if (!inscricaoId || !token) {
      return;
    }

    await loadByEdital();
    if (signal.aborted) return;
  }, [inscricaoId, loadByEdital, token]);

  async function submitEncaminhamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !inscricaoId) return; setBusy(true); setMessage(null);
    try { await registrarEncaminhamentoPoliticas(inscricaoId, encaminhamento, token); await loadByEdital(); setMessage({ type: "success", text: "Encaminhamento registrado e estado recarregado." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function submitPreliminar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !inscricaoId) return; setBusy(true); setMessage(null);
    try { await registrarResultadoPreliminarPoliticas(inscricaoId, { ...preliminar, arquivoRetornoUrl: preliminar.arquivoRetornoUrl || undefined }, token); await loadByEdital(); setMessage({ type: "success", text: "Resultado preliminar registrado e estado recarregado." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function submitFinal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token || !inscricaoId) return; setBusy(true); setMessage(null);
    try { await registrarResultadoFinalPoliticas(inscricaoId, { ...finalResult, arquivoRetornoUrl: finalResult.arquivoRetornoUrl || undefined }, token); await loadByEdital(); setMessage({ type: "success", text: "Resultado final registrado e estado recarregado." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function loadPreview(fase: "PRELIMINAR" | "FINAL") {
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try { setPreview(await previewPublicacaoPoliticas(editalId, fase, token)); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function publish(fase: "PRELIMINAR" | "FINAL") {
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try { await publicarPoliticas(editalId, { fase, descricao: `Publicacao ${fase.toLowerCase()} de politicas afirmativas.` }, token); setMessage({ type: "success", text: `Publicacao ${fase.toLowerCase()} criada.` }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleUploadRetorno(target: "preliminar" | "final", file: File | null) {
    if (!token || !file) return;
    setBusy(true);
    setMessage(null);
    try {
      const uploaded = await uploadPrivateFile(file, token);
      if (target === "preliminar") {
        setPreliminar((current) => ({ ...current, arquivoRetornoUrl: uploaded.urlArquivo }));
      } else {
        setFinalResult((current) => ({ ...current, arquivoRetornoUrl: uploaded.urlArquivo }));
      }
      setMessage({ type: "success", text: "Arquivo de retorno enviado e vinculado ao formulario." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadDocumento(documentoId: string, urlArquivo: string, nomeArquivo: string | null) {
    if (!token) return;
    setBusyDownloadId(documentoId);
    setMessage(null);
    try {
      await downloadAuthenticatedFile(urlArquivo, token, nomeArquivo ?? "documento-reserva.pdf");
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusyDownloadId(null);
    }
  }

  if (status === "loading") return <LoadingState title="Carregando politicas afirmativas" description="Preparando o detalhe operacional por inscricao." />;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback description={message.text} title="Retorno operacional" type={message.type} /> : null}

      <SectionCard title="Carga do detalhe" description="O detalhe pode ser carregado automaticamente quando o edital vier da fila; ajuste manualmente apenas quando necessario.">
        <div className="field-block"><span>ID do edital</span><input onChange={(e) => setEditalId(e.target.value)} value={editalId} /></div>
        <div className="content-item-links"><ActionButton disabled={busy} onClick={loadByEdital} type="button" variant="secondary">Carregar etapa</ActionButton></div>
      </SectionCard>

      {item ? (
        <>
          <SectionCard title={`Politicas afirmativas de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
            <div className="content-list">
              <small>Tipo: {getStatusLabel(item.tipo)}</small>
              <small>Status operacional: {getStatusLabel(item.statusOperacao)}</small>
              <small>Resultado preliminar: {getStatusLabel(item.resultadoPreliminar)}</small>
              <small>Resultado final: {getStatusLabel(item.resultadoFinal)}</small>
            </div>
          </SectionCard>

          <SectionCard title="Documentos de reserva" description="Documentos recebidos e vinculados a esta etapa.">
            <div className="content-list">
              {item.documentosReserva.map((documento) => (
                <article className="content-item" key={documento.id}>
                  <strong>{getStatusLabel(documento.tipo)}</strong>
                  <small>Arquivo: {documento.nomeArquivo ?? "sem nome"}</small>
                  <small>Arquivo privado registrado no sistema.</small>
                  <small>Status: {getStatusLabel(documento.statusValidacao ?? "SEM_VALIDACAO")}</small>
                  <div className="content-item-links">
                    <ActionButton disabled={busyDownloadId === documento.id} onClick={() => handleDownloadDocumento(documento.id, documento.urlArquivo, documento.nomeArquivo)} size="sm" type="button" variant="secondary">
                      {busyDownloadId === documento.id ? "Baixando..." : "Baixar documento"}
                    </ActionButton>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Encaminhamento" description="Registro administrativo do encaminhamento documental.">
            <form className="form-grid" onSubmit={submitEncaminhamento}>
              <label className="field-block"><span>Convocado em</span><input onChange={(e) => setEncaminhamento((c) => ({ ...c, convocadoEm: e.target.value }))} type="datetime-local" value={encaminhamento.convocadoEm} /></label>
              <label className="field-block"><span>Documentos encaminhados em</span><input onChange={(e) => setEncaminhamento((c) => ({ ...c, documentosEncaminhadosEm: e.target.value }))} type="datetime-local" value={encaminhamento.documentosEncaminhadosEm} /></label>
              <label className="field-block"><span>Protocolo</span><input onChange={(e) => setEncaminhamento((c) => ({ ...c, protocoloEncaminhamento: e.target.value }))} value={encaminhamento.protocoloEncaminhamento} /></label>
              <label className="field-block"><span>Observacao</span><textarea className="text-area" onChange={(e) => setEncaminhamento((c) => ({ ...c, observacaoEncaminhamento: e.target.value }))} value={encaminhamento.observacaoEncaminhamento} /></label>
               <ActionButton disabled={busy} loading={busy} type="submit">Registrar encaminhamento</ActionButton>
             </form>
           </SectionCard>

          <SectionCard title="Resultado preliminar" description="Registro preliminar da etapa de politicas afirmativas.">
            <form className="form-grid" onSubmit={submitPreliminar}>
              <label className="field-block"><span>Resultado</span><select className="select-field" onChange={(e) => setPreliminar((c) => ({ ...c, resultado: e.target.value as (typeof resultadoPoliticasOptions)[number] }))} value={preliminar.resultado}>{resultadoPoliticasOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="field-block"><span>Parecer</span><textarea className="text-area" onChange={(e) => setPreliminar((c) => ({ ...c, parecer: e.target.value }))} value={preliminar.parecer} /></label>
              <label className="field-block"><span>Arquivo de retorno</span><input readOnly value={preliminar.arquivoRetornoUrl} /></label>
              <label className="field-block"><span>Upload de retorno</span><input accept="application/pdf" onChange={(e) => void handleUploadRetorno("preliminar", e.target.files?.[0] ?? null)} type="file" /></label>
              {preliminar.arquivoRetornoUrl ? <div className="content-item-links"><ActionButton disabled={busy} onClick={() => handleDownloadDocumento("retorno-preliminar", preliminar.arquivoRetornoUrl, "retorno-preliminar.pdf")} size="sm" type="button" variant="secondary">Baixar retorno atual</ActionButton></div> : null}
                <ActionButton disabled={busy} loading={busy} type="submit">Registrar preliminar</ActionButton>
              </form>
            </SectionCard>

          <SectionCard title="Resultado final" description="Registro final da etapa de politicas afirmativas.">
            <form className="form-grid" onSubmit={submitFinal}>
              <label className="field-block"><span>Resultado</span><select className="select-field" onChange={(e) => setFinalResult((c) => ({ ...c, resultado: e.target.value as (typeof resultadoPoliticasOptions)[number] }))} value={finalResult.resultado}>{resultadoPoliticasOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label className="field-block"><span>Parecer</span><textarea className="text-area" onChange={(e) => setFinalResult((c) => ({ ...c, parecer: e.target.value }))} value={finalResult.parecer} /></label>
              <label className="field-block"><span>Arquivo de retorno</span><input readOnly value={finalResult.arquivoRetornoUrl} /></label>
              <label className="field-block"><span>Upload de retorno</span><input accept="application/pdf" onChange={(e) => void handleUploadRetorno("final", e.target.files?.[0] ?? null)} type="file" /></label>
              {finalResult.arquivoRetornoUrl ? <div className="content-item-links"><ActionButton disabled={busy} onClick={() => handleDownloadDocumento("retorno-final", finalResult.arquivoRetornoUrl, "retorno-final.pdf")} size="sm" type="button" variant="secondary">Baixar retorno atual</ActionButton></div> : null}
                <ActionButton disabled={busy} loading={busy} type="submit">Registrar final</ActionButton>
              </form>
            </SectionCard>

          <SectionCard title="Publicacao da etapa" description="Preview e criacao da publicacao oficial de politicas afirmativas.">
            <div className="content-item-links">
               <ActionButton disabled={busy} onClick={() => loadPreview("PRELIMINAR")} type="button" variant="secondary">Preview preliminar</ActionButton>
               <ActionButton disabled={busy} onClick={() => loadPreview("FINAL")} type="button" variant="secondary">Preview final</ActionButton>
               <ActionButton disabled={busy} onClick={() => publish("PRELIMINAR")} type="button">Publicar preliminar</ActionButton>
               <ActionButton disabled={busy} onClick={() => publish("FINAL")} type="button">Publicar final</ActionButton>
             </div>
              {preview ? <StructuredPreview data={preview} /> : null}
            </SectionCard>
         </>
       ) : <EmptyState title="Etapa nao carregada" description="Carregue a etapa pelo edital para operar este modulo." />}
    </div>
  );
}
