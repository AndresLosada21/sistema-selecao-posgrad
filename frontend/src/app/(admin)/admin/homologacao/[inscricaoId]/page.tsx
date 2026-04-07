"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import type { StatusConfirmacaoReserva } from "@/lib/enums";
import { formatIsoDate } from "@/modules/edital/formatters";

import {
  atualizarConfirmacaoReserva,
  baixarAnexoIvAdmin,
  baixarAnexoIvFlattenAdmin,
  getPacoteDocumentalAdmin,
  getInscricaoHomologacaoAdmin,
  listFundamentosHomologacao,
  registrarPacoteDocumentalAdmin,
  registrarHomologacaoFinal,
  registrarHomologacaoPreliminar,
} from "@/modules/admin-homologacao/api";
import type { AdminInscricaoHomologacao, HomologacaoFundamento } from "@/modules/admin-homologacao/types";
import { uploadPrivateFile } from "@/modules/upload/api";

type AdminHomologacaoDetailProps = {
  params: Promise<{ inscricaoId: string }>;
};

const confirmacaoReservaOptions = ["PENDENTE", "CONFIRMADA", "NAO_CONFIRMADA", "NAO_SE_APLICA"] as const;

type FeedbackMessage = {
  type: "success" | "error";
  title: string;
  description: string;
};

export default function AdminHomologacaoDetailPage({ params }: AdminHomologacaoDetailProps) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminInscricaoHomologacao | null>(null);
  const [fundamentos, setFundamentos] = useState<HomologacaoFundamento[]>([]);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [preliminarParecer, setPreliminarParecer] = useState("");
  const [finalParecer, setFinalParecer] = useState("");
  const [preliminarHomologada, setPreliminarHomologada] = useState(true);
  const [finalHomologada, setFinalHomologada] = useState(true);
  const [selectedMotivoCodigo, setSelectedMotivoCodigo] = useState("");
  const [motivosPreliminar, setMotivosPreliminar] = useState<HomologacaoFundamento[]>([]);
  const [motivosFinal, setMotivosFinal] = useState<HomologacaoFundamento[]>([]);
  const [confirmacaoAcoesAfirmativas, setConfirmacaoAcoesAfirmativas] = useState<StatusConfirmacaoReserva>(confirmacaoReservaOptions[0]);
  const [confirmacaoPcd, setConfirmacaoPcd] = useState<StatusConfirmacaoReserva>(confirmacaoReservaOptions[0]);
  const [busy, setBusy] = useState(false);
  const [busyDocumentoId, setBusyDocumentoId] = useState<string | null>(null);
  const [pacoteResumo, setPacoteResumo] = useState<{ urlArquivo: string; nomeArquivo: string | null; mimeType: string | null; tamanhoBytes: number | null; versaoSubmissao: number | null; geradoEm: string | null; geradoPorId: string | null } | null>(null);
  const [pacoteForm, setPacoteForm] = useState({ urlArquivo: "", nomeArquivo: "", mimeType: "application/pdf", tamanhoBytes: "" });

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => { if (!cancelled) setInscricaoId(resolved.inscricaoId); });
    return () => { cancelled = true; };
  }, [params]);

  const loadItem = useCallback(async () => {
    if (!token || !inscricaoId) {
      return;
    }

    const [found, fundamentosResponse] = await Promise.all([getInscricaoHomologacaoAdmin(inscricaoId, token), listFundamentosHomologacao(token)]);
    setItem(found);
    setFundamentos(fundamentosResponse.items);
    setSelectedMotivoCodigo(fundamentosResponse.items[0]?.codigo ?? "");
  }, [inscricaoId, token]);

  useAbortableEffect(async (signal) => {
    if (!token || !inscricaoId) {
      return;
    }

    try {
      await loadItem();
      if (signal.aborted) return;
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setMessage({ type: "error", title: "Falha ao carregar inscricao", description: getErrorMessage(error) });
      setStatus("error");
    }
  }, [inscricaoId, loadItem, signOut, token]);

  useEffect(() => {
    if (!item) {
      return;
    }

    setConfirmacaoAcoesAfirmativas(item.confirmacaoAcoesAfirmativas as StatusConfirmacaoReserva);
    setConfirmacaoPcd(item.confirmacaoPcd as StatusConfirmacaoReserva);
    setPreliminarParecer(item.homologacao?.parecerPreliminar ?? "");
    setFinalParecer(item.homologacao?.parecerFinal ?? "");
    setMotivosPreliminar(item.homologacao?.motivosPreliminar ?? []);
    setMotivosFinal(item.homologacao?.motivosFinal ?? []);
  }, [item]);

  const selectedFundamento = useMemo(
    () => fundamentos.find((fundamento) => fundamento.codigo === selectedMotivoCodigo) ?? null,
    [fundamentos, selectedMotivoCodigo],
  );

  function handleUnauthorized(error: unknown) {
    if (isUnauthorizedError(error)) {
      signOut();
      return true;
    }

    return false;
  }

  function addMotivo(target: "preliminar" | "final") {
    if (!selectedFundamento) {
      return;
    }

    if (target === "preliminar") {
      setMotivosPreliminar((current) => (current.some((item) => item.codigo === selectedFundamento.codigo) ? current : [...current, selectedFundamento]));
      return;
    }

    setMotivosFinal((current) => (current.some((item) => item.codigo === selectedFundamento.codigo) ? current : [...current, selectedFundamento]));
  }

  async function handleDownload(kind: "formulario" | "flatten") {
    if (!token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result =
        kind === "formulario"
          ? await baixarAnexoIvAdmin(item.id, token)
          : await baixarAnexoIvFlattenAdmin(item.id, token);

      triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, kind === "formulario" ? "anexo-iv.pdf" : "anexo-iv-flatten.pdf"));
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ type: "error", title: "Falha ao baixar Anexo IV", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handlePacote() {
    if (!token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const pacote = await getPacoteDocumentalAdmin(item.id, token);
      setPacoteResumo(pacote.pacoteDocumental);
      setMessage({
        type: "success",
        title: "Pacote documental carregado",
        description: `Arquivo: ${pacote.pacoteDocumental.nomeArquivo ?? "sem nome"} · Gerado em: ${formatIsoDate(pacote.pacoteDocumental.geradoEm)}`,
      });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ type: "error", title: "Falha ao carregar pacote documental", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleRegistrarPacote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await registrarPacoteDocumentalAdmin(item.id, {
        urlArquivo: pacoteForm.urlArquivo,
        nomeArquivo: pacoteForm.nomeArquivo,
        mimeType: pacoteForm.mimeType || undefined,
        tamanhoBytes: pacoteForm.tamanhoBytes ? Number(pacoteForm.tamanhoBytes) : undefined,
      }, token);

      setPacoteResumo(response);
      setMessage({ type: "success", title: "Pacote documental registrado", description: "O pacote documental consolidado foi registrado para esta inscricao." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ type: "error", title: "Falha ao registrar pacote documental", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadPacote(file: File | null) {
    if (!token || !file) return;
    setBusy(true);
    setMessage(null);
    try {
      const uploaded = await uploadPrivateFile(file, token);
      setPacoteForm({
        urlArquivo: uploaded.urlArquivo,
        nomeArquivo: uploaded.nomeArquivo,
        mimeType: uploaded.mimeType || "application/pdf",
        tamanhoBytes: String(uploaded.tamanhoBytes ?? ""),
      });
      setMessage({ type: "success", title: "Pacote enviado", description: "O arquivo do pacote documental foi enviado e preenchido no formulario." });
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setMessage({ type: "error", title: "Falha no upload do pacote", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadDocumento(documentoId: string, urlArquivo: string, nomeArquivo: string | null) {
    if (!token) return;
    setBusyDocumentoId(documentoId);
    setMessage(null);
    try {
      await downloadAuthenticatedFile(urlArquivo, token, nomeArquivo ?? "documento-inscricao.pdf");
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setMessage({ type: "error", title: "Falha ao baixar documento", description: getErrorMessage(error) });
    } finally {
      setBusyDocumentoId(null);
    }
  }

  async function handlePreliminar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await registrarHomologacaoPreliminar(item.id, {
        homologada: preliminarHomologada,
        parecer: preliminarParecer,
        motivos: motivosPreliminar,
      }, token);

      await loadItem();
      setMessage({ type: "success", title: "Homologacao preliminar registrada", description: "O parecer preliminar foi aceito pelo backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ type: "error", title: "Falha na homologacao preliminar", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleFinal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await registrarHomologacaoFinal(item.id, {
        homologada: finalHomologada,
        parecer: finalParecer,
        motivos: motivosFinal,
      }, token);

      await loadItem();
      setMessage({ type: "success", title: "Homologacao final registrada", description: "O parecer final foi aceito pelo backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ type: "error", title: "Falha na homologacao final", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmacaoReserva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await atualizarConfirmacaoReserva(item.id, {
        confirmacaoAcoesAfirmativas,
        confirmacaoPcd,
      }, token);

      await loadItem();
      setMessage({ type: "success", title: "Confirmacao de reserva atualizada", description: "A confirmacao operacional foi enviada ao backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ type: "error", title: "Falha na confirmacao de reserva", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <LoadingState title="Carregando detalhe de homologacao" description="Consultando a inscricao, os documentos e os fundamentos operacionais." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar detalhe" description={message?.description} />;
  }

  if (!item) {
    return <EmptyState title="Inscricao nao encontrada" description="Nao foi encontrada inscricao correspondente para a fila de homologacao." />;
  }

  return (
    <div className="stack-layout">
      {message ? <PageFeedback description={message.description} title={message.title} type={message.type} /> : null}

      <SectionCard title={`Homologacao de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
        <div className="content-list">
          <small>E-mail do candidato: {item.candidato.email}</small>
          <small>Modalidade: {getStatusLabel(item.modalidadeConcorrencia)}</small>
          <small>Status da inscricao: {getStatusLabel(item.status)}</small>
          <small>Status do pagamento: {getStatusLabel(item.statusPagamento)}</small>
          <small>Submetida em: {formatIsoDate(item.submetidaEm)}</small>
          <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
          <div className="content-item-links">
            <ActionButton disabled={busy} onClick={() => handleDownload("formulario")} type="button" variant="secondary">Baixar Anexo IV formulario</ActionButton>
            <ActionButton disabled={busy} onClick={() => handleDownload("flatten")} type="button" variant="secondary">Baixar Anexo IV flattened</ActionButton>
            <ActionButton disabled={busy} onClick={handlePacote} type="button" variant="secondary">Ler pacote documental</ActionButton>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos apresentados" description="Leitura dos documentos e de seus metadados de validacao no contexto admin.">
        <div className="content-list">
          {item.documentos.map((documento) => (
            <article className="content-item" key={documento.id}>
              <div className="content-item-row">
                <strong>{documento.tipo}</strong>
                <StatusBadge variant={getStatusVariant(documento.statusValidacao ?? "SEM_VALIDACAO")}>{getStatusLabel(documento.statusValidacao ?? "SEM_VALIDACAO")}</StatusBadge>
              </div>
              <small>Nome: {documento.nome}</small>
              <small>Arquivo: {documento.nomeArquivo ?? "nao informado"}</small>
              <small>Obrigatorio: {documento.obrigatorio ? "sim" : "nao"}</small>
              <small>Observacao: {documento.observacaoValidacao ?? "sem observacao"}</small>
              <div className="content-item-links">
                <ActionButton disabled={busyDocumentoId === documento.id} onClick={() => handleDownloadDocumento(documento.id, documento.urlArquivo, documento.nomeArquivo)} size="sm" type="button" variant="secondary">
                  {busyDocumentoId === documento.id ? "Baixando..." : "Baixar documento"}
                </ActionButton>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Fundamentos disponiveis" description="Catalogo de fundamentos fornecido pelo backend para composicao dos pareceres.">
        <div className="field-block">
          <span>Fundamento selecionado</span>
          <select className="select-field" onChange={(event) => setSelectedMotivoCodigo(event.target.value)} value={selectedMotivoCodigo}>
            {fundamentos.map((fundamento) => (
              <option key={fundamento.codigo} value={fundamento.codigo}>
                {fundamento.codigo} · {fundamento.titulo}
              </option>
            ))}
          </select>
          <div className="content-item-links">
             <ActionButton onClick={() => addMotivo("preliminar")} type="button" variant="secondary">
               Adicionar na preliminar
             </ActionButton>
             <ActionButton onClick={() => addMotivo("final")} type="button" variant="secondary">
               Adicionar na final
             </ActionButton>
           </div>
        </div>
      </SectionCard>

      <SectionCard title="Homologacao preliminar" description="Registro do parecer preliminar e dos motivos objetivos quando houver indeferimento.">
        <form className="form-grid" onSubmit={handlePreliminar}>
          <label className="field-inline">
            <input checked={preliminarHomologada} onChange={(event) => setPreliminarHomologada(event.target.checked)} type="checkbox" />
            <span>Homologada na preliminar</span>
          </label>
          <label className="field-block">
            <span>Parecer preliminar</span>
            <textarea className="text-area" onChange={(event) => setPreliminarParecer(event.target.value)} value={preliminarParecer} />
          </label>
          <div className="content-list">
            {motivosPreliminar.map((motivo) => (
              <article className="content-item" key={`pre-${motivo.codigo}`}>
                <strong>{motivo.codigo}</strong>
                <small>{motivo.titulo}</small>
                <small>{motivo.itemEdital}</small>
              </article>
            ))}
          </div>
          <ActionButton disabled={busy} loading={busy} type="submit">Registrar preliminar</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Pacote documental" description="Consulta e registro do pacote documental consolidado da inscricao.">
        <div className="content-item-links">
          <ActionButton disabled={busy} onClick={handlePacote} type="button" variant="secondary">Atualizar leitura do pacote</ActionButton>
        </div>
        {pacoteResumo ? (
          <div className="content-item">
            <small>Arquivo: {pacoteResumo.nomeArquivo ?? "sem nome"}</small>
            <small>Arquivo privado consolidado no sistema.</small>
            <small>Versao da submissao: {pacoteResumo.versaoSubmissao ?? "nao informada"}</small>
            <small>Gerado em: {formatIsoDate(pacoteResumo.geradoEm)}</small>
            <div className="content-item-links">
              <ActionButton disabled={busy} onClick={() => handleDownloadDocumento("pacote-documental", pacoteResumo.urlArquivo, pacoteResumo.nomeArquivo)} size="sm" type="button" variant="secondary">Baixar pacote atual</ActionButton>
            </div>
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleRegistrarPacote}>
          <label className="field-block"><span>Upload do pacote</span><input accept="application/pdf" onChange={(event) => void handleUploadPacote(event.target.files?.[0] ?? null)} type="file" /></label>
          <label className="field-block"><span>URL do pacote</span><input onChange={(event) => setPacoteForm((current) => ({ ...current, urlArquivo: event.target.value }))} required value={pacoteForm.urlArquivo} /></label>
          <label className="field-block"><span>Nome do arquivo</span><input onChange={(event) => setPacoteForm((current) => ({ ...current, nomeArquivo: event.target.value }))} required value={pacoteForm.nomeArquivo} /></label>
          <label className="field-block"><span>MIME type</span><input onChange={(event) => setPacoteForm((current) => ({ ...current, mimeType: event.target.value }))} value={pacoteForm.mimeType} /></label>
          <label className="field-block"><span>Tamanho em bytes</span><input min="1" onChange={(event) => setPacoteForm((current) => ({ ...current, tamanhoBytes: event.target.value }))} type="number" value={pacoteForm.tamanhoBytes} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Registrar pacote documental</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Confirmacao operacional de reserva" description="Atualizacao do estado operacional das reservas por inscricao.">
        <form className="form-grid" onSubmit={handleConfirmacaoReserva}>
          <label className="field-block">
            <span>Acoes afirmativas</span>
            <select className="select-field" onChange={(event) => setConfirmacaoAcoesAfirmativas(event.target.value as StatusConfirmacaoReserva)} value={confirmacaoAcoesAfirmativas}>
              {confirmacaoReservaOptions.map((value) => (
                <option key={value} value={value}>
                    {getStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>PCD</span>
            <select className="select-field" onChange={(event) => setConfirmacaoPcd(event.target.value as StatusConfirmacaoReserva)} value={confirmacaoPcd}>
              {confirmacaoReservaOptions.map((value) => (
                <option key={value} value={value}>
                    {getStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <ActionButton disabled={busy} loading={busy} type="submit" variant="secondary">Atualizar confirmacao</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Homologacao final" description="Registro do parecer final da inscricao com base na situacao consolidada.">
        <form className="form-grid" onSubmit={handleFinal}>
          <label className="field-inline">
            <input checked={finalHomologada} onChange={(event) => setFinalHomologada(event.target.checked)} type="checkbox" />
            <span>Homologada no resultado final</span>
          </label>
          <label className="field-block">
            <span>Parecer final</span>
            <textarea className="text-area" onChange={(event) => setFinalParecer(event.target.value)} value={finalParecer} />
          </label>
          <div className="content-list">
            {motivosFinal.map((motivo) => (
              <article className="content-item" key={`final-${motivo.codigo}`}>
                <strong>{motivo.codigo}</strong>
                <small>{motivo.titulo}</small>
                <small>{motivo.itemEdital}</small>
              </article>
            ))}
          </div>
          <ActionButton disabled={busy} loading={busy} type="submit">Registrar final</ActionButton>
        </form>
      </SectionCard>
    </div>
  );
}
