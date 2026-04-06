"use client";

import { FormEvent, useMemo, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { FileField } from "@/components/shared/file-field";
import { ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";
import { ApiError, getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { sanitizePayload } from "@/lib/http/sanitize";
import type { ModalidadeConcorrencia, TipoDocumentoInscricao } from "@/lib/enums";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import type { EditalDetalhe } from "@/modules/edital/types";
import { uploadPrivateFile } from "@/modules/upload/api";

import {
  documentoTipoOptions,
  empregadoSituacaoOptions,
  generoOptions,
  modalidadeConcorrenciaOptions,
  racaCorOptions,
  regimeTrabalhoOptions,
} from "../constants";
import { addDocumento, cancelInscricao, downloadAnexoIv, getPacoteDocumental, saveInscricaoDraft, submitInscricao } from "../api";
import type { FichaInscricaoPayload } from "../types";

type InscricaoEditorProps = {
  edital: EditalDetalhe;
  dashboardItem: CandidateDashboardResponse["items"][number] | null;
};

type DocumentoFormState = {
  tipo: string;
  nome: string;
  urlArquivo: string;
  nomeArquivo: string;
  mimeType: string;
};

type SignatureUploadState = {
  nomeArquivo: string;
};

type FormMessage = {
  title: string;
  description: string;
};

const fichaTextFields: Array<{ key: keyof NonNullable<InscricaoEditorState["fichaInscricao"]>; label: string }> = [
  { key: "nomeCompleto", label: "Nome completo" },
  { key: "rg", label: "RG" },
  { key: "rgDataExpedicao", label: "Data de expedicao do RG" },
  { key: "cpf", label: "CPF" },
  { key: "passaporte", label: "Passaporte" },
  { key: "nacionalidade", label: "Nacionalidade" },
  { key: "naturalidade", label: "Naturalidade" },
  { key: "email", label: "E-mail" },
  { key: "telefoneWhatsapp", label: "Telefone / WhatsApp" },
  { key: "dataNascimento", label: "Data de nascimento" },
  { key: "estadoCivil", label: "Estado civil" },
  { key: "tipoSanguineo", label: "Tipo sanguineo" },
  { key: "fatorRh", label: "Fator RH" },
  { key: "nomePai", label: "Nome do pai" },
  { key: "nomeMae", label: "Nome da mae" },
  { key: "enderecoResidencial", label: "Endereco residencial" },
  { key: "cepResidencial", label: "CEP residencial" },
  { key: "bairroResidencial", label: "Bairro residencial" },
  { key: "ufResidencial", label: "UF residencial" },
  { key: "cidadeResidencial", label: "Cidade residencial" },
  { key: "instituicaoTrabalho", label: "Instituicao de trabalho" },
  { key: "unidadeDepartamentoTrabalho", label: "Unidade / departamento" },
  { key: "enderecoTrabalho", label: "Endereco de trabalho" },
  { key: "cepTrabalho", label: "CEP de trabalho" },
  { key: "cidadeBairroTrabalho", label: "Cidade / bairro de trabalho" },
];

const assinaturaMimeTypes = new Set(["image/png", "image/jpeg"]);

type InscricaoEditorState = {
  linhaPesquisaId: string;
  modalidadeConcorrencia: string;
  temaRedacao: string;
  resumoCurriculo: string;
  redacaoTexto: string;
  assinaturaImagemUrl: string;
  fichaInscricao: {
    [key: string]: string | boolean | undefined;
    genero?: string;
    racaCor?: string;
    empregadoSituacao?: string;
    regimeTrabalho?: string;
    pessoaComDeficiencia?: boolean;
    concorreAcoesAfirmativas?: boolean;
    vaiSolicitarBolsa?: boolean;
  };
};

function buildInitialState(edital: EditalDetalhe, dashboardItem: CandidateDashboardResponse["items"][number] | null): InscricaoEditorState {
  const inscricao = dashboardItem?.inscricao;
  const ficha = (inscricao?.dadosFormulario as Record<string, string | boolean | undefined> | undefined) ?? {};

  return {
    linhaPesquisaId: inscricao?.linhaPesquisa?.id ?? edital.linhasPesquisa[0]?.id ?? "",
    modalidadeConcorrencia: inscricao?.modalidadeConcorrencia ?? "AMPLA_CONCORRENCIA",
    temaRedacao: inscricao?.temaRedacao ?? "",
    resumoCurriculo: inscricao?.resumoCurriculo ?? "",
    redacaoTexto: inscricao?.redacaoTexto ?? "",
    assinaturaImagemUrl: (inscricao as { assinaturaImagemUrl?: string } | null)?.assinaturaImagemUrl ?? "",
    fichaInscricao: {
      nomeCompleto: (ficha.nomeCompleto as string) ?? "",
      rg: (ficha.rg as string) ?? "",
      rgDataExpedicao: (ficha.rgDataExpedicao as string) ?? "",
      cpf: (ficha.cpf as string) ?? "",
      passaporte: (ficha.passaporte as string) ?? "",
      nacionalidade: (ficha.nacionalidade as string) ?? "",
      naturalidade: (ficha.naturalidade as string) ?? "",
      email: (ficha.email as string) ?? "",
      telefoneWhatsapp: (ficha.telefoneWhatsapp as string) ?? "",
      dataNascimento: (ficha.dataNascimento as string) ?? "",
      estadoCivil: (ficha.estadoCivil as string) ?? "",
      genero: (ficha.genero as string) ?? generoOptions[0],
      tipoSanguineo: (ficha.tipoSanguineo as string) ?? "",
      fatorRh: (ficha.fatorRh as string) ?? "",
      racaCor: (ficha.racaCor as string) ?? racaCorOptions[0],
      pessoaComDeficiencia: Boolean(ficha.pessoaComDeficiencia),
      concorreAcoesAfirmativas: Boolean(ficha.concorreAcoesAfirmativas),
      vaiSolicitarBolsa: Boolean(ficha.vaiSolicitarBolsa),
      nomePai: (ficha.nomePai as string) ?? "",
      nomeMae: (ficha.nomeMae as string) ?? "",
      enderecoResidencial: (ficha.enderecoResidencial as string) ?? "",
      cepResidencial: (ficha.cepResidencial as string) ?? "",
      bairroResidencial: (ficha.bairroResidencial as string) ?? "",
      ufResidencial: (ficha.ufResidencial as string) ?? "",
      cidadeResidencial: (ficha.cidadeResidencial as string) ?? "",
      empregadoSituacao: (ficha.empregadoSituacao as string) ?? "",
      regimeTrabalho: (ficha.regimeTrabalho as string) ?? "",
      instituicaoTrabalho: (ficha.instituicaoTrabalho as string) ?? "",
      unidadeDepartamentoTrabalho: (ficha.unidadeDepartamentoTrabalho as string) ?? "",
      enderecoTrabalho: (ficha.enderecoTrabalho as string) ?? "",
      cepTrabalho: (ficha.cepTrabalho as string) ?? "",
      cidadeBairroTrabalho: (ficha.cidadeBairroTrabalho as string) ?? "",
    },
  };
}

function buildEmptyDocumentoState(): DocumentoFormState {
  return {
    tipo: documentoTipoOptions[0],
    nome: "",
    urlArquivo: "",
    nomeArquivo: "",
    mimeType: "application/pdf",
  };
}

export function InscricaoEditor({ edital, dashboardItem }: InscricaoEditorProps) {
  const session = useSession();
  const [formState, setFormState] = useState<InscricaoEditorState>(() => buildInitialState(edital, dashboardItem));
  const [documentoState, setDocumentoState] = useState<DocumentoFormState>(buildEmptyDocumentoState);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingDocumento, setUploadingDocumento] = useState(false);
  const [uploadingAssinatura, setUploadingAssinatura] = useState(false);
  const [signatureUpload, setSignatureUpload] = useState<SignatureUploadState>({ nomeArquivo: "" });
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [documentos, setDocumentos] = useState(dashboardItem?.inscricao?.documentos ?? []);
  const [inscricaoId, setInscricaoId] = useState(dashboardItem?.inscricao?.id ?? null);
  const [inscricaoStatus, setInscricaoStatus] = useState(dashboardItem?.inscricao?.status ?? "SEM_INSCRICAO");
  const [pacoteResumo, setPacoteResumo] = useState(dashboardItem?.inscricao?.pacoteDocumental ?? null);

  const documentosOrdenados = useMemo(() => [...documentos].sort((a, b) => a.tipo.localeCompare(b.tipo)), [documentos]);
  const redacaoLength = formState.redacaoTexto.trim().length;
  const redacaoDentroDaFaixa = redacaoLength === 0 || (redacaoLength >= 500 && redacaoLength <= 1500);

  function resetMessage() {
    setMessage(null);
    setChecklist([]);
  }

  function handleUnauthorized(error: unknown) {
    if (isUnauthorizedError(error)) {
      session.signOut();
      return true;
    }

    return false;
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session.token) {
      return;
    }

    setSavingDraft(true);
    resetMessage();

    try {
      const response = await saveInscricaoDraft(
        edital.id,
        sanitizePayload({
          linhaPesquisaId: formState.linhaPesquisaId,
          modalidadeConcorrencia: formState.modalidadeConcorrencia as ModalidadeConcorrencia,
          temaRedacao: formState.temaRedacao || undefined,
          resumoCurriculo: formState.resumoCurriculo || undefined,
          redacaoTexto: formState.redacaoTexto || undefined,
          assinaturaImagemUrl: formState.assinaturaImagemUrl || undefined,
          fichaInscricao: formState.fichaInscricao as FichaInscricaoPayload,
        }),
        session.token,
      );

      const saved = response as {
        id: string;
        status: string;
        documentos?: typeof documentos;
        pacoteDocumental?: typeof pacoteResumo;
      };

      setInscricaoId(saved.id);
      setInscricaoStatus(saved.status);
      setDocumentos(saved.documentos ?? documentos);
      setPacoteResumo(saved.pacoteDocumental ?? pacoteResumo);
      setMessage({ title: "Rascunho salvo", description: "Os dados principais da inscricao foram enviados ao backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha ao salvar rascunho", description: getErrorMessage(error) });
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleAddDocumento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session.token || !inscricaoId) {
      setMessage({ title: "Rascunho inexistente", description: "Salve o rascunho antes de registrar documentos." });
      return;
    }

    resetMessage();

    try {
      const documento = await addDocumento(inscricaoId, {
        ...sanitizePayload(documentoState),
        tipo: documentoState.tipo as TipoDocumentoInscricao,
        mimeType: documentoState.mimeType || undefined,
      }, session.token);

      setDocumentos((current) => {
        const filtered = current.filter((item) => item.tipo !== documento.tipo);
        return [...filtered, documento];
      });
      setDocumentoState(buildEmptyDocumentoState());
      setMessage({ title: "Documento sincronizado", description: "O documento informado foi registrado para esta inscricao." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha ao registrar documento", description: getErrorMessage(error) });
    }
  }

  async function handleDocumentoFileSelect(file: File) {
    if (!session.token) {
      return;
    }

    setUploadingDocumento(true);
    resetMessage();

    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      setDocumentoState((current) => ({
        ...current,
        urlArquivo: uploaded.urlArquivo,
        nomeArquivo: uploaded.nomeArquivo,
        mimeType: uploaded.mimeType,
      }));
      setMessage({ title: "Arquivo enviado", description: "O documento foi enviado e esta pronto para ser registrado na inscricao." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha no upload do documento", description: getErrorMessage(error) });
    } finally {
      setUploadingDocumento(false);
    }
  }

  async function handleAssinaturaFileSelect(file: File) {
    if (!session.token) {
      return;
    }

    if (!assinaturaMimeTypes.has(file.type)) {
      setMessage({ title: "Arquivo invalido", description: "A assinatura do candidato deve ser enviada em PNG ou JPEG." });
      return;
    }

    setUploadingAssinatura(true);
    resetMessage();

    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      setFormState((current) => ({ ...current, assinaturaImagemUrl: uploaded.urlArquivo }));
      setSignatureUpload({ nomeArquivo: uploaded.nomeArquivo });
      setMessage({ title: "Assinatura enviada", description: "A imagem da assinatura foi enviada e sera salva com o rascunho." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha no upload da assinatura", description: getErrorMessage(error) });
    } finally {
      setUploadingAssinatura(false);
    }
  }

  async function handleSubmitInscricao() {
    if (!session.token || !inscricaoId) {
      setMessage({ title: "Rascunho inexistente", description: "Salve o rascunho antes de submeter a inscricao." });
      return;
    }

    setSubmitting(true);
    resetMessage();

    try {
      const response = await submitInscricao(inscricaoId, session.token);
      setInscricaoStatus(String((response as { status?: string }).status ?? "SUBMETIDA"));
      setMessage({ title: "Inscricao submetida", description: "A submissao foi aceita pelo backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      if (error instanceof ApiError) {
        const rawChecklist = Array.isArray(error.payload.checklist) ? error.payload.checklist : [];
        setChecklist(rawChecklist.map((item) => String(item)));
      }

      setMessage({ title: "Falha ao submeter inscricao", description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSubmission() {
    if (!session.token || !inscricaoId) {
      return;
    }

    setSubmitting(true);
    resetMessage();

    try {
      const response = await cancelInscricao(inscricaoId, session.token);
      setInscricaoStatus(String((response as { status?: string }).status ?? "RASCUNHO"));
      setMessage({ title: "Submissao cancelada", description: "A inscricao voltou para rascunho para permitir edicao." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha ao cancelar submissao", description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadAnexoIv() {
    if (!session.token || !inscricaoId) {
      return;
    }

    setDownloading(true);
    resetMessage();

    try {
      const result = await downloadAnexoIv(inscricaoId, session.token);
      triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, "anexo-iv.pdf"));
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha ao baixar Anexo IV", description: getErrorMessage(error) });
    } finally {
      setDownloading(false);
    }
  }

  async function handleRefreshPacote() {
    if (!session.token || !inscricaoId) {
      return;
    }

    setDownloading(true);
    resetMessage();

    try {
      const response = await getPacoteDocumental(inscricaoId, session.token);
      setPacoteResumo(response.pacoteDocumental);
      setMessage({ title: "Pacote documental carregado", description: "Os metadados do pacote documental foram atualizados." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Pacote documental indisponivel", description: getErrorMessage(error) });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="stack-layout">
      <SectionCard title={`Inscricao de ${edital.numero}`} description="Edicao do rascunho, gestao de documentos e operacoes da inscricao usando contratos reais do backend.">
        <div className="content-list">
          <small>Status atual: {inscricaoStatus}</small>
          <small>Linhas de pesquisa disponiveis: {edital.linhasPesquisa.length}</small>
          <small>Documentos sincronizados: {documentos.length}</small>
          <small>Pacote documental: {pacoteResumo ? "disponivel" : "nao gerado"}</small>
          <div className="content-item-links">
            <ActionButton disabled={downloading || !inscricaoId} onClick={handleDownloadAnexoIv} type="button">
              {downloading ? "Processando..." : "Baixar Anexo IV"}
            </ActionButton>
            <ActionButton disabled={downloading || !inscricaoId} onClick={handleRefreshPacote} type="button" variant="secondary">
              Atualizar pacote documental
            </ActionButton>
          </div>
          {pacoteResumo ? (
            <div className="content-item">
              <small>Arquivo: {pacoteResumo.nomeArquivo ?? "sem nome"}</small>
              <small>Arquivo privado consolidado no sistema.</small>
              <small>Versao de submissao: {pacoteResumo.versaoSubmissao ?? "nao informada"}</small>
              <small>Gerado em: {pacoteResumo.geradoEm ?? "nao informado"}</small>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Formulario principal" description="Campos essenciais do rascunho retornados e aceitos pelo backend.">
        <form className="form-grid" onSubmit={handleSaveDraft}>
          <label className="field-block">
            <span>Linha de pesquisa</span>
            <select className="select-field" onChange={(event) => setFormState((current) => ({ ...current, linhaPesquisaId: event.target.value }))} value={formState.linhaPesquisaId}>
              {edital.linhasPesquisa.map((linha) => (
                <option key={linha.id} value={linha.id}>
                  {linha.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Modalidade de concorrencia</span>
            <select className="select-field" onChange={(event) => setFormState((current) => ({ ...current, modalidadeConcorrencia: event.target.value }))} value={formState.modalidadeConcorrencia}>
              {modalidadeConcorrenciaOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Tema da redacao</span>
            <input onChange={(event) => setFormState((current) => ({ ...current, temaRedacao: event.target.value }))} value={formState.temaRedacao} />
          </label>

          <label className="field-block">
            <span>Resumo do curriculo</span>
            <textarea className="text-area" onChange={(event) => setFormState((current) => ({ ...current, resumoCurriculo: event.target.value }))} value={formState.resumoCurriculo} />
          </label>

          <label className="field-block">
            <span>Redacao</span>
            <textarea className="text-area" onChange={(event) => setFormState((current) => ({ ...current, redacaoTexto: event.target.value }))} value={formState.redacaoTexto} />
            <small>{`Caracteres: ${redacaoLength}${redacaoDentroDaFaixa ? "" : " (fora da faixa 500-1500)"}`}</small>
          </label>

          <FileField
            accept="image/png,image/jpeg"
            disabled={uploadingAssinatura}
            hint={signatureUpload.nomeArquivo ? `Imagem enviada: ${signatureUpload.nomeArquivo}` : "Envie uma imagem da assinatura do candidato (PNG ou JPEG)."}
            label="Assinatura do candidato"
            onFileSelect={handleAssinaturaFileSelect}
          />

          {fichaTextFields.map((field) => (
            <label className="field-block" key={field.key}>
              <span>{field.label}</span>
              <input
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    fichaInscricao: {
                      ...current.fichaInscricao,
                      [field.key]: event.target.value,
                    },
                  }))
                }
                value={String(formState.fichaInscricao[field.key] ?? "")}
              />
            </label>
          ))}

          <label className="field-block">
            <span>Genero</span>
            <select className="select-field" onChange={(event) => setFormState((current) => ({ ...current, fichaInscricao: { ...current.fichaInscricao, genero: event.target.value } }))} value={String(formState.fichaInscricao.genero ?? generoOptions[0])}>
              {generoOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Raca/cor</span>
            <select className="select-field" onChange={(event) => setFormState((current) => ({ ...current, fichaInscricao: { ...current.fichaInscricao, racaCor: event.target.value } }))} value={String(formState.fichaInscricao.racaCor ?? racaCorOptions[0])}>
              {racaCorOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Situacao profissional</span>
            <select className="select-field" onChange={(event) => setFormState((current) => ({ ...current, fichaInscricao: { ...current.fichaInscricao, empregadoSituacao: event.target.value || undefined } }))} value={String(formState.fichaInscricao.empregadoSituacao ?? "")}>
              <option value="">Nao informado</option>
              {empregadoSituacaoOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Regime de trabalho</span>
            <select className="select-field" onChange={(event) => setFormState((current) => ({ ...current, fichaInscricao: { ...current.fichaInscricao, regimeTrabalho: event.target.value || undefined } }))} value={String(formState.fichaInscricao.regimeTrabalho ?? "")}>
              <option value="">Nao informado</option>
              {regimeTrabalhoOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="field-inline">
            <input checked={Boolean(formState.fichaInscricao.pessoaComDeficiencia)} onChange={(event) => setFormState((current) => ({ ...current, fichaInscricao: { ...current.fichaInscricao, pessoaComDeficiencia: event.target.checked } }))} type="checkbox" />
            <span>Pessoa com deficiencia</span>
          </label>

          <label className="field-inline">
            <input checked={Boolean(formState.fichaInscricao.concorreAcoesAfirmativas)} onChange={(event) => setFormState((current) => ({ ...current, fichaInscricao: { ...current.fichaInscricao, concorreAcoesAfirmativas: event.target.checked } }))} type="checkbox" />
            <span>Concorre em acoes afirmativas</span>
          </label>

          <label className="field-inline">
            <input checked={Boolean(formState.fichaInscricao.vaiSolicitarBolsa)} onChange={(event) => setFormState((current) => ({ ...current, fichaInscricao: { ...current.fichaInscricao, vaiSolicitarBolsa: event.target.checked } }))} type="checkbox" />
            <span>Vai solicitar bolsa</span>
          </label>

          <ActionButton disabled={savingDraft} loading={savingDraft} type="submit">
            {savingDraft ? "Salvando..." : "Salvar rascunho"}
          </ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Documentos da inscricao" description="Registro de documentos por tipo, com sincronizacao direta no backend.">
        <form className="form-grid" onSubmit={handleAddDocumento}>
          <label className="field-block">
            <span>Tipo de documento</span>
            <select className="select-field" onChange={(event) => setDocumentoState((current) => ({ ...current, tipo: event.target.value }))} value={documentoState.tipo}>
              {documentoTipoOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>Nome</span>
            <input onChange={(event) => setDocumentoState((current) => ({ ...current, nome: event.target.value }))} value={documentoState.nome} />
          </label>
          <FileField
            disabled={uploadingDocumento}
            hint={documentoState.nomeArquivo ? `Arquivo enviado: ${documentoState.nomeArquivo}` : "Envie o PDF e depois confirme o registro do documento."}
            label="Arquivo do documento"
            onFileSelect={handleDocumentoFileSelect}
          />
          <ActionButton disabled={uploadingDocumento || !documentoState.urlArquivo} type="submit" variant="secondary">
            Registrar documento
          </ActionButton>
        </form>

        <div className="content-list">
          {documentosOrdenados.map((documento) => (
            <article className="content-item" key={documento.id}>
              <div className="content-item-row">
                <strong>{documento.tipo}</strong>
                <StatusBadge>{documento.statusValidacao ?? "SEM_VALIDACAO"}</StatusBadge>
              </div>
              <small>Nome: {documento.nome}</small>
              <small>Arquivo: {documento.nomeArquivo ?? "nao informado"}</small>
              <small>Arquivo privado registrado no sistema.</small>
              <small>Observacao: {documento.observacaoValidacao ?? "sem observacao"}</small>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Operacoes da inscricao" description="Submissao, cancelamento para edicao e leitura do checklist de pendencias do backend.">
        <div className="content-item-links">
          <ActionButton disabled={submitting || !inscricaoId} onClick={handleSubmitInscricao} type="button">
            {submitting ? "Processando..." : "Submeter inscricao"}
          </ActionButton>
          <ActionButton disabled={submitting || !inscricaoId} onClick={handleCancelSubmission} type="button" variant="secondary">
            Cancelar submissao para edicao
          </ActionButton>
        </div>
        {checklist.length ? (
          <div className="content-item">
            <strong>Checklist retornado pelo backend</strong>
            <ul className="plain-list">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {message ? message.title.toLowerCase().startsWith("falha") ? <ErrorState description={message.description} title={message.title} /> : <PageFeedback type="success" title={message.title} description={message.description} /> : null}
        {!inscricaoId ? <LoadingState title="Rascunho ainda nao criado" description="Salve o rascunho para habilitar documentos, Anexo IV e submissao." /> : null}
      </SectionCard>
    </div>
  );
}
