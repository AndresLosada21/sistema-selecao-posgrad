"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { FileField } from "@/components/shared/file-field";
import { PageFeedback } from "@/components/shared/page-feedback";
import { useSession } from "@/lib/auth/session-provider";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";
import { ApiError, getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { sanitizePayload } from "@/lib/http/sanitize";
import { getStatusLabel } from "@/components/shared/status-variant-map";
import type { ModalidadeConcorrencia, TipoDocumentoInscricao } from "@/lib/enums";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import type { EditalDetalhe } from "@/modules/edital/types";
import { uploadPrivateFile } from "@/modules/upload/api";

import {
  documentoTipoOptions,
  empregadoSituacaoOptions,
  generoOptions,
  modalidadeConcorrenciaOptions,
  nacionalidadeOptions,
  racaCorOptions,
  regimeTrabalhoOptions,
  ufOptions,
} from "../constants";
import { addDocumento, cancelInscricao, downloadAnexoIv, saveInscricaoDraft, submitInscricao } from "../api";
import type { FichaInscricaoPayload } from "../types";

/* ================================================================
   Types & helpers
   ================================================================ */

type InscricaoEditorProps = {
  edital: EditalDetalhe;
  dashboardItem: CandidateDashboardResponse["items"][number] | null;
};

type FormMessage = { title: string; description: string; type?: "success" | "error" | "warning" | "info" };

type SubmissionChecklistViewItem = {
  key: string;
  label: string;
  pendencia: string | null;
  presente: boolean;
  pdfValido: boolean;
};

type FieldErrors = Record<string, string>;

type InscricaoEditorState = {
  linhaPesquisaId: string;
  modalidadeConcorrencia: string;
  temaRedacao: string;
  resumoCurriculo: string;
  redacaoTexto: string;
  fichaInscricao: { [key: string]: string | boolean | undefined; genero?: string; racaCor?: string; empregadoSituacao?: string; regimeTrabalho?: string; pessoaComDeficiencia?: boolean; concorreAcoesAfirmativas?: boolean; vaiSolicitarBolsa?: boolean };
};

const documentoTipoOptionsSemAnexoIv = documentoTipoOptions.filter((t) => t !== "ANEXO_IV");

const STEP_LABELS = ["Dados Pessoais", "Dados Academicos", "Redacao", "Documentos", "Revisao"];

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return digits.replace(/^(\d{2})(\d+)/, "($1) $2");
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return digits.replace(/^(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d+)/, "$1-$2");
}

function formatDateBR(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.replace(/^(\d{2})(\d+)/, "$1/$2");
  return digits.replace(/^(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
}

function isValidDateBR(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
}

function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (base: number) => {
    const sum = digits.slice(0, base).split("").reduce((acc, digit, idx) => acc + Number(digit) * (base + 1 - idx), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function isValidPhone(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 10 || digits.length === 11;
}

function isValidCep(value: string) {
  return onlyDigits(value).length === 8;
}

function isValidUf(value: string) {
  return /^[A-Z]{2}$/.test(value.trim().toUpperCase());
}

function isValidNaturalidade(value: string) {
  return /^[^/]+\/[A-Z]{2}$/i.test(value.trim());
}

function normalizeTextName(value: string) {
  return value.replace(/\s+/g, " ").trimStart();
}

function splitNaturalidade(value: string) {
  const [cidade = "", uf = ""] = value.split("/");
  return { cidade: cidade.trim(), uf: uf.trim().toUpperCase() };
}

const municipioCache = new Map<string, string[]>();

async function fetchMunicipiosByUf(uf: string) {
  const normalized = uf.trim().toUpperCase();
  if (!normalized || normalized.length !== 2) {
    return [];
  }
  if (municipioCache.has(normalized)) {
    return municipioCache.get(normalized)!;
  }
  const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${normalized}/municipios`);
  if (!response.ok) {
    throw new Error("IBGE_UNAVAILABLE");
  }
  const payload = await response.json() as Array<{ nome: string }>;
  const municipios = payload.map((item) => item.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
  municipioCache.set(normalized, municipios);
  return municipios;
}

function isEstrangeiro(ficha: InscricaoEditorState["fichaInscricao"]) {
  const nacionalidade = String(ficha.nacionalidade ?? "").trim().toUpperCase();
  return nacionalidade.length > 0 && nacionalidade !== "BRASILEIRA" && nacionalidade !== "BRASILEIRO";
}

function getRequiredDocumentTypes(input: {
  ficha: InscricaoEditorState["fichaInscricao"];
  modalidadeConcorrencia: string;
  pagamentoDispensado: boolean;
}) {
  const required = ["ANEXO_IV", "ANEXO_V", "DIPLOMA", "HISTORICO", "CURRICULO"];

  if (isEstrangeiro(input.ficha) || hasText(input.ficha.passaporte)) {
    required.push("RNE_PASSAPORTE");
  } else {
    required.push("DOCUMENTO_IDENTIFICACAO");
  }

  if (!input.pagamentoDispensado) {
    required.push("COMPROVANTE_PAGAMENTO");
  }

  if (input.ficha.pessoaComDeficiencia) {
    required.push("LAUDO_PCD");
  }

  if (input.ficha.concorreAcoesAfirmativas || input.modalidadeConcorrencia === "ACOES_AFIRMATIVAS") {
    required.push("ANEXO_VIII_AUTODECLARACAO");
  }

  if (input.ficha.racaCor === "INDIGENA" || input.ficha.racaCor === "QUILOMBOLA") {
    required.push("COMPROVANTE_ETNICO");
  }

  return required;
}

function getStepFieldErrors(input: {
  step: number;
  state: InscricaoEditorState;
  documentos: Array<{ tipo: string; nomeArquivo?: string }>;
  pagamentoDispensado: boolean;
}) {
  const errors: FieldErrors = {};
  const ficha = input.state.fichaInscricao;

  if (input.step === 0) {
    const requiredTextFields: Array<[string, string]> = [
      ["nomeCompleto", "Informe o nome completo."],
      ["nacionalidade", "Informe a nacionalidade."],
      ["naturalidade", "Informe a naturalidade."],
      ["email", "Informe o e-mail."],
      ["telefoneWhatsapp", "Informe o telefone/WhatsApp."],
      ["dataNascimento", "Informe a data de nascimento."],
      ["estadoCivil", "Selecione o estado civil."],
      ["genero", "Selecione o genero."],
      ["tipoSanguineo", "Selecione o tipo sanguineo."],
      ["fatorRh", "Selecione o fator Rh."],
      ["racaCor", "Selecione a raca/cor."],
      ["nomePai", "Informe o nome do pai."],
      ["nomeMae", "Informe o nome da mae."],
      ["enderecoResidencial", "Informe o endereco residencial."],
      ["cepResidencial", "Informe o CEP residencial."],
      ["bairroResidencial", "Informe o bairro residencial."],
      ["ufResidencial", "Informe a UF residencial."],
      ["cidadeResidencial", "Informe a cidade residencial."],
      ["empregadoSituacao", "Selecione a situacao de trabalho."],
    ];

    for (const [key, message] of requiredTextFields) {
      if (!hasText(ficha[key])) {
        errors[key] = message;
      }
    }

    if (hasText(ficha.nomeCompleto) && /\d/.test(String(ficha.nomeCompleto))) {
      errors.nomeCompleto = "Nome completo nao pode conter numeros.";
    }

    if (hasText(ficha.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(ficha.email))) {
      errors.email = "Informe um e-mail valido.";
    }

    if (hasText(ficha.telefoneWhatsapp) && !isValidPhone(String(ficha.telefoneWhatsapp))) {
      errors.telefoneWhatsapp = "Informe um telefone com DDD valido.";
    }

    if (hasText(ficha.dataNascimento) && !isValidDateBR(String(ficha.dataNascimento))) {
      errors.dataNascimento = "Informe a data de nascimento no formato DD/MM/AAAA.";
    }

    if (hasText(ficha.rgDataExpedicao) && !isValidDateBR(String(ficha.rgDataExpedicao))) {
      errors.rgDataExpedicao = "Informe a data de expedicao no formato DD/MM/AAAA.";
    }

    if (hasText(ficha.cepResidencial) && !isValidCep(String(ficha.cepResidencial))) {
      errors.cepResidencial = "Informe um CEP valido com 8 digitos.";
    }

    if (hasText(ficha.ufResidencial) && !isValidUf(String(ficha.ufResidencial))) {
      errors.ufResidencial = "Informe uma UF valida com 2 letras.";
    }

    if (hasText(ficha.naturalidade) && !isValidNaturalidade(String(ficha.naturalidade))) {
      errors.naturalidade = "Use o formato Cidade/UF para naturalidade.";
    }

    if (!isEstrangeiro(ficha) && !hasText(ficha.passaporte)) {
      if (!hasText(ficha.rg)) {
        errors.rg = "Informe o RG.";
      }
      if (!hasText(ficha.rgDataExpedicao)) {
        errors.rgDataExpedicao = "Informe a data de expedicao do RG.";
      }
      if (!hasText(ficha.cpf)) {
        errors.cpf = "Informe o CPF.";
      } else if (!isValidCpf(String(ficha.cpf))) {
        errors.cpf = "Informe um CPF valido.";
      }
    } else if (!hasText(ficha.passaporte)) {
      errors.passaporte = "Informe o passaporte para inscricao de estrangeiro.";
    }

    if (ficha.empregadoSituacao === "EMPREGADO") {
      const workFields: Array<[string, string]> = [
        ["regimeTrabalho", "Informe o regime de trabalho."],
        ["instituicaoTrabalho", "Informe a instituicao/local de trabalho."],
        ["unidadeDepartamentoTrabalho", "Informe a unidade/departamento."],
        ["enderecoTrabalho", "Informe o endereco do trabalho."],
        ["cepTrabalho", "Informe o CEP do trabalho."],
        ["cidadeBairroTrabalho", "Informe a cidade/bairro do trabalho."],
      ];

      for (const [key, message] of workFields) {
        if (!hasText(ficha[key])) {
          errors[key] = message;
        }
      }

      if (hasText(ficha.cepTrabalho) && !isValidCep(String(ficha.cepTrabalho))) {
        errors.cepTrabalho = "Informe um CEP de trabalho valido com 8 digitos.";
      }
    }
  }

  if (input.step === 1) {
    if (!hasText(input.state.linhaPesquisaId)) {
      errors.linhaPesquisaId = "Selecione a linha de pesquisa.";
    }
    if (!hasText(input.state.modalidadeConcorrencia)) {
      errors.modalidadeConcorrencia = "Selecione a modalidade de concorrencia.";
    }
    if (!hasText(input.state.resumoCurriculo) || input.state.resumoCurriculo.trim().length < 10) {
      errors.resumoCurriculo = "Informe um resumo do curriculo com pelo menos 10 caracteres.";
    }
    if (input.state.modalidadeConcorrencia === "PCD" && !input.state.fichaInscricao.pessoaComDeficiencia) {
      errors.modalidadeConcorrencia = "Modalidade PCD exige marcacao de pessoa com deficiencia na ficha.";
    }
    if (input.state.modalidadeConcorrencia === "ACOES_AFIRMATIVAS" && !input.state.fichaInscricao.concorreAcoesAfirmativas) {
      errors.modalidadeConcorrencia = "Modalidade de acoes afirmativas exige a marcacao correspondente na ficha.";
    }
  }

  if (input.step === 2) {
    if (!hasText(input.state.temaRedacao)) {
      errors.temaRedacao = "Informe o tema da redacao.";
    }
    const redacaoLength = input.state.redacaoTexto.trim().length;
    if (redacaoLength < 500 || redacaoLength > 1500) {
      errors.redacaoTexto = "A redacao deve ter entre 500 e 1500 caracteres contando espacos.";
    }
  }

  if (input.step === 3) {
    const requiredTypes = getRequiredDocumentTypes({
      ficha,
      modalidadeConcorrencia: input.state.modalidadeConcorrencia,
      pagamentoDispensado: input.pagamentoDispensado,
    });
    const docsByType = new Set(input.documentos.map((doc) => doc.tipo));

    for (const type of requiredTypes) {
      if (!docsByType.has(type)) {
        errors[`documento:${type}`] = `${getStatusLabel(type)} e obrigatorio para prosseguir.`;
      }
    }
  }

  return errors;
}

function getMaxReachedStep(input: {
  state: InscricaoEditorState;
  documentos: Array<{ tipo: string; nomeArquivo?: string }>;
  pagamentoDispensado: boolean;
}) {
  let maxReached = 0;

  for (let step = 0; step < 4; step += 1) {
    const errors = getStepFieldErrors({
      step,
      state: input.state,
      documentos: input.documentos,
      pagamentoDispensado: input.pagamentoDispensado,
    });

    if (Object.keys(errors).length > 0) {
      break;
    }

    maxReached = step + 1;
  }

  return Math.min(maxReached, 4);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="wiz-field-error">{message}</span>;
}

function buildInitialState(edital: EditalDetalhe, dashboardItem: CandidateDashboardResponse["items"][number] | null): InscricaoEditorState {
  const inscricao = dashboardItem?.inscricao;
  const ficha = (inscricao?.dadosFormulario as Record<string, string | boolean | undefined> | undefined) ?? {};
  return {
    linhaPesquisaId: inscricao?.linhaPesquisa?.id ?? edital.linhasPesquisa[0]?.id ?? "",
    modalidadeConcorrencia: inscricao?.modalidadeConcorrencia ?? "AMPLA_CONCORRENCIA",
    temaRedacao: inscricao?.temaRedacao ?? "",
    resumoCurriculo: inscricao?.resumoCurriculo ?? "",
    redacaoTexto: inscricao?.redacaoTexto ?? "",
    fichaInscricao: {
      nomeCompleto: (ficha.nomeCompleto as string) ?? "", rg: (ficha.rg as string) ?? "",
      rgDataExpedicao: (ficha.rgDataExpedicao as string) ?? "", cpf: (ficha.cpf as string) ?? "",
      passaporte: (ficha.passaporte as string) ?? "", nacionalidade: (ficha.nacionalidade as string) ?? "",
      naturalidade: (ficha.naturalidade as string) ?? "", email: (ficha.email as string) ?? "",
      telefoneWhatsapp: (ficha.telefoneWhatsapp as string) ?? "", dataNascimento: (ficha.dataNascimento as string) ?? "",
      estadoCivil: (ficha.estadoCivil as string) ?? "", genero: (ficha.genero as string) ?? generoOptions[0],
      tipoSanguineo: (ficha.tipoSanguineo as string) ?? "", fatorRh: (ficha.fatorRh as string) ?? "",
      racaCor: (ficha.racaCor as string) ?? racaCorOptions[0],
      pessoaComDeficiencia: Boolean(ficha.pessoaComDeficiencia),
      concorreAcoesAfirmativas: Boolean(ficha.concorreAcoesAfirmativas),
      vaiSolicitarBolsa: Boolean(ficha.vaiSolicitarBolsa),
      nomePai: (ficha.nomePai as string) ?? "", nomeMae: (ficha.nomeMae as string) ?? "",
      enderecoResidencial: (ficha.enderecoResidencial as string) ?? "", cepResidencial: (ficha.cepResidencial as string) ?? "",
      bairroResidencial: (ficha.bairroResidencial as string) ?? "", ufResidencial: (ficha.ufResidencial as string) ?? "",
      cidadeResidencial: (ficha.cidadeResidencial as string) ?? "",
      empregadoSituacao: (ficha.empregadoSituacao as string) ?? "", regimeTrabalho: (ficha.regimeTrabalho as string) ?? "",
      instituicaoTrabalho: (ficha.instituicaoTrabalho as string) ?? "",
      unidadeDepartamentoTrabalho: (ficha.unidadeDepartamentoTrabalho as string) ?? "",
      enderecoTrabalho: (ficha.enderecoTrabalho as string) ?? "", cepTrabalho: (ficha.cepTrabalho as string) ?? "",
      cidadeBairroTrabalho: (ficha.cidadeBairroTrabalho as string) ?? "",
    },
  };
}

/* ---- Icons ---- */
const svgCheck = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
const svgArrowLeft = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>;
const svgArrowRight = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>;
const svgSave = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>;
const svgSend = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z" /><path d="m22 2-10 10" /></svg>;
const svgUpload = (c: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>;
const svgDownload = (c: string) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>;
const svgFileText = (c: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;
const svgCircleCheck = (c: string) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>;
const svgTriangleAlert = (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>;
const svgCheckSm = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
const svgCloud = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" /></svg>;
const svgInfo = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>;
const svgPencilSm = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z" /></svg>;
const svgUser = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const svgGradCap = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 10 3 12 0v-5" /></svg>;
const svgFilePen = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10" /><path d="M14 2v6h6" /><path d="M10.4 21.9a2 2 0 1 1-3.8-1.2l1.4-4.3 4-1.4-1.6 6.9z" /></svg>;
const svgPaperclip = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>;
const svgFileBadge = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="m14 12.5 1 5.5-3-1-3 1 1-5.5" /></svg>;

/* ================================================================
   Step Bar
   ================================================================ */

function StepBar({ current, maxReachedStep, onSelectStep }: { current: number; maxReachedStep: number; onSelectStep: (step: number) => void; }) {
  return (
    <div className="wiz-step-bar">
      {STEP_LABELS.map((label, i) => {
        const isDone = i < current;
        const isActive = i === current;
        const isReachable = i <= maxReachedStep;
        const circleClass = isDone ? "wiz-step-circle--done" : isActive ? "wiz-step-circle--active" : "wiz-step-circle--future";
        const labelClass = isDone ? "wiz-step-label--done" : isActive ? "wiz-step-label--active" : "wiz-step-label--future";
        return (
          <span key={label} style={{ display: "contents" }}>
            {i > 0 && <span className={`wiz-step-connector ${i <= current ? "wiz-step-connector--done" : "wiz-step-connector--future"}`} />}
            <button type="button" className={`wiz-step wiz-step-button${isReachable ? " wiz-step-button--enabled" : ""}`} onClick={() => isReachable && onSelectStep(i)} disabled={!isReachable}>
              <span className={`wiz-step-circle ${circleClass}`}>
                {isDone ? svgCheck : i + 1}
              </span>
              <span className={`wiz-step-label ${labelClass}`}>{label}</span>
            </button>
          </span>
        );
      })}
    </div>
  );
}

/* ================================================================
   Main Editor
   ================================================================ */

export function InscricaoEditor({ edital, dashboardItem }: InscricaoEditorProps) {
  const session = useSession();
  const pagamentoDispensado = dashboardItem?.isencao?.status === "DEFERIDA_FINAL";
  const [step, setStep] = useState(0);
  const [formState, setFormState] = useState<InscricaoEditorState>(() => buildInitialState(edital, dashboardItem));
  const [savingDraft, setSavingDraft] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [autosaveAt, setAutosaveAt] = useState<string | null>(null);
  const [cepLookupMessage, setCepLookupMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingDocumento, setUploadingDocumento] = useState(false);
  const [uploadingAnexoIv, setUploadingAnexoIv] = useState(false);
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [checklist, setChecklist] = useState<SubmissionChecklistViewItem[]>([]);
  const [documentos, setDocumentos] = useState(dashboardItem?.inscricao?.documentos ?? []);
  const [inscricaoId, setInscricaoId] = useState(dashboardItem?.inscricao?.id ?? null);
  const [inscricaoStatus, setInscricaoStatus] = useState(dashboardItem?.inscricao?.status ?? "SEM_INSCRICAO");
  const [confirmChecks, setConfirmChecks] = useState([false, false, false, false]);
  const [docFormTipo, setDocFormTipo] = useState<string>(documentoTipoOptionsSemAnexoIv[0]);
  const [docFormNome, setDocFormNome] = useState("");
  const [docFormUrl, setDocFormUrl] = useState("");
  const [docFormFilename, setDocFormFilename] = useState("");
  const [docFormMime, setDocFormMime] = useState("application/pdf");
  const fileRef = useRef<HTMLInputElement>(null);
  const lastSavedDraftRef = useRef<string | null>(null);
  const hasMountedAutosaveRef = useRef(false);

  const anexoIvDocumento = useMemo(() => documentos.find((d) => d.tipo === "ANEXO_IV") ?? null, [documentos]);
  const redacaoLength = formState.redacaoTexto.length;
  const cursoLabel = edital.cursoNivel === "MESTRADO" ? "Mestrado em Engenharia Eletrica" : "Doutorado em Engenharia Eletrica";
  const maxReachedStep = useMemo(() => getMaxReachedStep({ state: formState, documentos, pagamentoDispensado }), [documentos, formState, pagamentoDispensado]);

  function resetMessage() { setMessage(null); setChecklist([]); }
  function handleUnauthorized(error: unknown) { if (isUnauthorizedError(error)) { session.signOut(); return true; } return false; }

  function updateFicha(key: string, value: string | boolean) {
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormState((s) => ({ ...s, fichaInscricao: { ...s.fichaInscricao, [key]: value } }));
  }

  async function handleCepBlur(kind: "residencial" | "trabalho") {
    const cepKey = kind === "residencial" ? "cepResidencial" : "cepTrabalho";
    const logradouroKey = kind === "residencial" ? "enderecoResidencial" : "enderecoTrabalho";
    const bairroKey = kind === "residencial" ? "bairroResidencial" : "cidadeBairroTrabalho";
    const cidadeKey = kind === "residencial" ? "cidadeResidencial" : null;
    const ufKey = kind === "residencial" ? "ufResidencial" : null;
    const cep = onlyDigits(String(formState.fichaInscricao[cepKey] ?? ""));

    if (cep.length !== 8) {
      return;
    }

    try {
      setCepLookupMessage("Buscando CEP...");
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const payload = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };

      if (!response.ok || payload.erro) {
        setCepLookupMessage("CEP nao encontrado. Preencha os campos manualmente.");
        return;
      }

      setFormState((current) => ({
        ...current,
        fichaInscricao: {
          ...current.fichaInscricao,
          [logradouroKey]: hasText(current.fichaInscricao[logradouroKey]) ? current.fichaInscricao[logradouroKey] : (payload.logradouro ?? ""),
          [bairroKey]: hasText(current.fichaInscricao[bairroKey]) ? current.fichaInscricao[bairroKey] : (payload.bairro ?? ""),
          ...(cidadeKey ? { [cidadeKey]: hasText(current.fichaInscricao[cidadeKey]) ? current.fichaInscricao[cidadeKey] : (payload.localidade ?? "") } : {}),
          ...(ufKey ? { [ufKey]: hasText(current.fichaInscricao[ufKey]) ? current.fichaInscricao[ufKey] : (payload.uf ?? "") } : {}),
        },
      }));
      setCepLookupMessage("Endereco preenchido automaticamente pelo CEP. Revise e ajuste se necessario.");
    } catch {
      setCepLookupMessage("Nao foi possivel consultar o CEP agora. Continue o preenchimento manualmente.");
    }
  }

  function navigateToStep(targetStep: number) {
    if (targetStep <= maxReachedStep) {
      resetMessage();
      setStep(targetStep);
    }
  }

  async function validateAndGoNext() {
    const errors = getStepFieldErrors({ step, state: formState, documentos, pagamentoDispensado });
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setMessage({ title: "Pendencias na etapa atual", description: "Corrija os campos destacados antes de seguir para a proxima etapa.", type: "warning" });
      return;
    }

    await handleSaveDraft();
    setStep((current) => Math.min(current + 1, 4));
  }

  /* ---- API handlers (preserved from original) ---- */

  const currentDraftPayload = useMemo(() => sanitizePayload({
    linhaPesquisaId: formState.linhaPesquisaId,
    modalidadeConcorrencia: formState.modalidadeConcorrencia as ModalidadeConcorrencia,
    temaRedacao: formState.temaRedacao || undefined,
    resumoCurriculo: formState.resumoCurriculo || undefined,
    redacaoTexto: formState.redacaoTexto || undefined,
    fichaInscricao: formState.fichaInscricao as FichaInscricaoPayload,
  }), [formState]);

  async function handleSaveDraft(options?: { silent?: boolean }) {
    if (!session.token) return;
    setSavingDraft(true);
    setAutosaveState("saving");
    if (!options?.silent) {
      resetMessage();
    }
    try {
      const response = await saveInscricaoDraft(edital.id, currentDraftPayload, session.token);
      const saved = response as Record<string, unknown>;
      setInscricaoId(typeof saved.id === "string" ? saved.id : inscricaoId);
      setInscricaoStatus(typeof saved.status === "string" ? saved.status : inscricaoStatus);
      setDocumentos(Array.isArray(saved.documentos) ? saved.documentos : documentos);
      lastSavedDraftRef.current = JSON.stringify(currentDraftPayload);
      setAutosaveState("saved");
      setAutosaveAt(new Date().toISOString());
      if (!options?.silent) {
        setMessage({ title: "Rascunho salvo", description: "Os dados da inscricao foram salvos com sucesso." });
      }
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setAutosaveState("error");
      if (!options?.silent) {
        setMessage({ title: "Falha ao salvar rascunho", description: getErrorMessage(error), type: "error" });
      }
    } finally { setSavingDraft(false); }
  }

  useEffect(() => {
    const snapshot = JSON.stringify(currentDraftPayload);

    if (!hasMountedAutosaveRef.current) {
      hasMountedAutosaveRef.current = true;
      lastSavedDraftRef.current = snapshot;
      return;
    }

    if (inscricaoStatus === "SUBMETIDA") {
      return;
    }

    if (snapshot === lastSavedDraftRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleSaveDraft({ silent: true });
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [currentDraftPayload, inscricaoStatus]);

  async function handleDocumentoFileSelect(file: File) {
    if (!session.token) return;
    setUploadingDocumento(true); resetMessage();
    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      setDocFormUrl(uploaded.urlArquivo);
      setDocFormFilename(uploaded.nomeArquivo);
      setDocFormMime(uploaded.mimeType);
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setMessage({ title: "Falha no upload", description: getErrorMessage(error), type: "error" });
    } finally { setUploadingDocumento(false); }
  }

  async function handleAddDocumento(event: FormEvent) {
    event.preventDefault();
    if (!session.token || !inscricaoId) { setMessage({ title: "Salve o rascunho primeiro", description: "O rascunho precisa existir para registrar documentos.", type: "warning" }); return; }
    resetMessage();
    try {
      const documento = await addDocumento(inscricaoId, { tipo: docFormTipo as TipoDocumentoInscricao, nome: docFormNome, urlArquivo: docFormUrl, nomeArquivo: docFormFilename, mimeType: docFormMime || undefined }, session.token);
      setDocumentos((c) => [...c.filter((d) => d.tipo !== documento.tipo), documento]);
      setDocFormTipo(documentoTipoOptionsSemAnexoIv[0]); setDocFormNome(""); setDocFormUrl(""); setDocFormFilename("");
      setMessage({ title: "Documento registrado", description: `${getStatusLabel(documento.tipo)} sincronizado.` });
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setMessage({ title: "Falha ao registrar documento", description: getErrorMessage(error), type: "error" });
    }
  }

  async function handleAnexoIvUpload(file: File) {
    if (!session.token) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage({ title: "Arquivo invalido", description: "O Anexo IV assinado deve ser reenviado em PDF.", type: "error" }); return;
    }
    if (!inscricaoId) { setMessage({ title: "Salve o rascunho primeiro", description: "Crie o rascunho antes de reenviar o Anexo IV.", type: "warning" }); return; }
    setUploadingAnexoIv(true); resetMessage();
    try {
      const uploaded = await uploadPrivateFile(file, session.token);
      const documento = await addDocumento(inscricaoId, { tipo: "ANEXO_IV" as TipoDocumentoInscricao, nome: "Anexo IV assinado", urlArquivo: uploaded.urlArquivo, nomeArquivo: uploaded.nomeArquivo, mimeType: uploaded.mimeType }, session.token);
      setDocumentos((c) => [...c.filter((d) => d.tipo !== documento.tipo), documento]);
      setMessage({ title: "Anexo IV assinado reenviado", description: "O PDF assinado foi registrado." });
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setMessage({ title: "Falha no reenvio", description: getErrorMessage(error), type: "error" });
    } finally { setUploadingAnexoIv(false); }
  }

  async function handleDownloadAnexoIv() {
    if (!session.token || !inscricaoId) return;
    setDownloading(true); resetMessage();
    try {
      const result = await downloadAnexoIv(inscricaoId, session.token);
      triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, "anexo-iv.pdf"));
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setMessage({ title: "Falha ao baixar Anexo IV", description: getErrorMessage(error), type: "error" });
    } finally { setDownloading(false); }
  }

  async function handleSubmit() {
    if (!session.token || !inscricaoId) return;
    setSubmitting(true); resetMessage();
    try {
      const response = await submitInscricao(inscricaoId, session.token);
      const r = response as Record<string, unknown>;
      setInscricaoStatus(typeof r.status === "string" ? r.status : "SUBMETIDA");
      setMessage({ title: "Inscricao submetida", description: "A inscricao foi aceita pelo sistema." });
    } catch (error) {
      if (handleUnauthorized(error)) return;
       if (error instanceof ApiError) {
         const raw = Array.isArray(error.payload.checklist) ? error.payload.checklist : [];
         setChecklist(
           raw.map((item, index) => {
             const value = item as Record<string, unknown>;
             return {
               key: String(value.tipo ?? index),
               label: String(value.label ?? value.tipo ?? `Item ${index + 1}`),
               pendencia: typeof value.pendencia === "string" ? value.pendencia : null,
               presente: Boolean(value.presente),
               pdfValido: value.pdfValido !== false,
             };
           }),
         );
       }
      setMessage({ title: "Falha ao submeter", description: getErrorMessage(error), type: "error" });
    } finally { setSubmitting(false); }
  }

  async function handleCancelSubmission() {
    if (!session.token || !inscricaoId) return;
    setSubmitting(true); resetMessage();
    try {
      const response = await cancelInscricao(inscricaoId, session.token);
      const r = response as Record<string, unknown>;
      setInscricaoStatus(typeof r.status === "string" ? r.status : "RASCUNHO");
      setMessage({ title: "Submissao cancelada", description: "A inscricao voltou para rascunho." });
    } catch (error) {
      if (handleUnauthorized(error)) return;
      setMessage({ title: "Falha ao cancelar", description: getErrorMessage(error), type: "error" });
    } finally { setSubmitting(false); }
  }

  /* ---- Navigation ---- */
  function goNext() { void validateAndGoNext(); }
  function goBack() { setStep((s) => Math.max(s - 1, 0)); }

  const allConfirmed = confirmChecks.every(Boolean);

  /* ---- Render ---- */
  return (
    <div className="wiz-shell">
      <StepBar current={step} maxReachedStep={maxReachedStep} onSelectStep={navigateToStep} />

      <div className="wiz-body">
        {message ? <div style={{ width: 760, maxWidth: "100%" }}><PageFeedback type={message.type ?? "success"} title={message.title} description={message.description} /></div> : null}

        {step === 0 && <Step1DadosPessoais formState={formState} setFormState={setFormState} updateFicha={updateFicha} fieldErrors={fieldErrors} onCepBlur={handleCepBlur} cepLookupMessage={cepLookupMessage} />}
        {step === 1 && <Step2DadosAcademicos formState={formState} setFormState={setFormState} edital={edital} cursoLabel={cursoLabel} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} />}
        {step === 2 && <Step3Redacao formState={formState} setFormState={setFormState} redacaoLength={redacaoLength} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} />}
        {step === 3 && (
          <Step4Documentos
            inscricaoId={inscricaoId} documentos={documentos} anexoIvDocumento={anexoIvDocumento}
            downloading={downloading} uploadingAnexoIv={uploadingAnexoIv} uploadingDocumento={uploadingDocumento}
            onDownloadAnexoIv={handleDownloadAnexoIv} onUploadAnexoIv={handleAnexoIvUpload}
            onDocFileSelect={handleDocumentoFileSelect} onAddDocumento={handleAddDocumento}
            docFormTipo={docFormTipo} setDocFormTipo={setDocFormTipo} docFormNome={docFormNome} setDocFormNome={setDocFormNome}
            docFormUrl={docFormUrl} docFormFilename={docFormFilename} fileRef={fileRef} fieldErrors={fieldErrors}
          />
        )}
        {step === 4 && (
          <Step5Revisao
            formState={formState} edital={edital} cursoLabel={cursoLabel} documentos={documentos}
            confirmChecks={confirmChecks} setConfirmChecks={setConfirmChecks}
            checklist={checklist} inscricaoStatus={inscricaoStatus}
            goToStep={setStep}
          />
        )}
      </div>

      {/* Footer */}
      <div className="wiz-footer">
        {step > 0 && <button type="button" className="wiz-btn-back" onClick={goBack}>{svgArrowLeft} Voltar</button>}
        <button type="button" className="wiz-btn-save" disabled={savingDraft} onClick={() => void handleSaveDraft()}>
          {svgSave} {savingDraft ? "Salvando..." : "Salvar Rascunho"}
        </button>
        <span className="wiz-footer-spacer" />
        <span className="wiz-auto-save">{svgCloud} {autosaveState === "saving" ? "Salvando automaticamente..." : autosaveState === "saved" ? `Salvo automaticamente${autosaveAt ? ` as ${new Date(autosaveAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}` : autosaveState === "error" ? "Falha no salvamento automatico" : "Salvamento automatico ativo"}</span>
        {step < 4 ? (
          <button type="button" className="wiz-btn-next" disabled={savingDraft} onClick={goNext}>
            Proximo: {STEP_LABELS[step + 1]} {svgArrowRight}
          </button>
        ) : (
          <>
            {inscricaoStatus === "SUBMETIDA" ? (
              <button type="button" className="wiz-btn-cancel-link" disabled={submitting} onClick={handleCancelSubmission}>
                Cancelar Inscricao
              </button>
            ) : null}
            <button type="button" className="wiz-btn-submit" disabled={submitting || !allConfirmed || !inscricaoId} onClick={handleSubmit}>
              {svgSend} {submitting ? "Processando..." : "Submeter Inscricao"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   Step 1 — Dados Pessoais
   ================================================================ */

function Step1DadosPessoais({ formState, setFormState, updateFicha, fieldErrors, onCepBlur, cepLookupMessage }: {
  formState: InscricaoEditorState;
  setFormState: React.Dispatch<React.SetStateAction<InscricaoEditorState>>;
  updateFicha: (key: string, value: string | boolean) => void;
  fieldErrors: FieldErrors;
  onCepBlur: (kind: "residencial" | "trabalho") => void;
  cepLookupMessage: string | null;
}) {
  const f = formState.fichaInscricao;
  const v = (key: string) => String(f[key] ?? "");
  const naturalidade = splitNaturalidade(v("naturalidade"));
  const [cidadeResidencialOptions, setCidadeResidencialOptions] = useState<string[]>([]);
  const [cidadeNaturalidadeOptions, setCidadeNaturalidadeOptions] = useState<string[]>([]);

  useEffect(() => {
    const uf = v("ufResidencial");
    if (!uf) {
      setCidadeResidencialOptions([]);
      return;
    }
    fetchMunicipiosByUf(uf).then(setCidadeResidencialOptions).catch(() => setCidadeResidencialOptions([]));
  }, [f.ufResidencial]);

  useEffect(() => {
    if (!naturalidade.uf) {
      setCidadeNaturalidadeOptions([]);
      return;
    }
    fetchMunicipiosByUf(naturalidade.uf).then(setCidadeNaturalidadeOptions).catch(() => setCidadeNaturalidadeOptions([]));
  }, [naturalidade.uf]);

  function updateNaturalidade(next: { cidade?: string; uf?: string }) {
    const cidade = (next.cidade ?? naturalidade.cidade).trim();
    const uf = (next.uf ?? naturalidade.uf).trim().toUpperCase();
    updateFicha("naturalidade", cidade && uf ? `${cidade}/${uf}` : cidade || uf);
  }

  return (
    <>
      {/* Card 1: Identificacao */}
      <div className="wiz-card">
        <h2 className="wiz-card-title">Identificacao e Dados Pessoais</h2>
        <p className="wiz-card-subtitle">Preencha seus dados pessoais conforme constam nos documentos oficiais.</p>
        <div className="wiz-card-divider" />

        <div className="wiz-field">
          <label className="wiz-field-label">Nome Completo</label>
          <input aria-invalid={!!fieldErrors.nomeCompleto} placeholder="Ex: Joao da Silva Santos" value={v("nomeCompleto")} onChange={(e) => updateFicha("nomeCompleto", normalizeTextName(e.target.value))} />
          <FieldError message={fieldErrors.nomeCompleto} />
        </div>
        <div className="wiz-field-row">
          <div className="wiz-field">
            <label className="wiz-field-label">CPF</label>
            <input aria-invalid={!!fieldErrors.cpf} inputMode="numeric" placeholder="000.000.000-00" value={v("cpf")} onChange={(e) => updateFicha("cpf", formatCpf(e.target.value))} />
            <FieldError message={fieldErrors.cpf} />
          </div>
          <div className="wiz-field">
            <label className="wiz-field-label">Passaporte</label>
            <input aria-invalid={!!fieldErrors.passaporte} placeholder="Ex: BR123456 (para estrangeiros)" value={v("passaporte")} onChange={(e) => updateFicha("passaporte", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
            <FieldError message={fieldErrors.passaporte} />
          </div>
        </div>
        <div className="wiz-field-row">
          <div className="wiz-field">
            <label className="wiz-field-label">RG</label>
            <input aria-invalid={!!fieldErrors.rg} value={v("rg")} onChange={(e) => updateFicha("rg", e.target.value.replace(/[^\w.-]/g, "").slice(0, 20))} />
            <FieldError message={fieldErrors.rg} />
          </div>
          <div className="wiz-field">
            <label className="wiz-field-label">Data de Expedicao do RG</label>
            <input aria-invalid={!!fieldErrors.rgDataExpedicao} placeholder="DD/MM/AAAA" value={v("rgDataExpedicao")} onChange={(e) => updateFicha("rgDataExpedicao", formatDateBR(e.target.value))} />
            <FieldError message={fieldErrors.rgDataExpedicao} />
          </div>
        </div>
        <div className="wiz-field-row">
          <div className="wiz-field">
            <label className="wiz-field-label">Data de Nascimento</label>
            <input aria-invalid={!!fieldErrors.dataNascimento} placeholder="DD/MM/AAAA" value={v("dataNascimento")} onChange={(e) => updateFicha("dataNascimento", formatDateBR(e.target.value))} />
            <FieldError message={fieldErrors.dataNascimento} />
          </div>
          <div className="wiz-field">
            <label className="wiz-field-label">Genero</label>
            <select aria-invalid={!!fieldErrors.genero} value={v("genero")} onChange={(e) => updateFicha("genero", e.target.value)}>
              <option value="">Selecione</option>
              {generoOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}
            </select>
            <FieldError message={fieldErrors.genero} />
          </div>
        </div>
        <div className="wiz-field-row">
          <div className="wiz-field">
            <label className="wiz-field-label">Nacionalidade</label>
            <select aria-invalid={!!fieldErrors.nacionalidade} value={v("nacionalidade")} onChange={(e) => updateFicha("nacionalidade", e.target.value)}>
              <option value="">Selecione</option>
              {nacionalidadeOptions.map((option) => <option key={option} value={option}>{option === "BRASILEIRA" ? "Brasileira" : "Estrangeira"}</option>)}
            </select>
            <FieldError message={fieldErrors.nacionalidade} />
          </div>
          <div className="wiz-field">
            <label className="wiz-field-label">Naturalidade</label>
            <div className="wiz-field-row">
              <div className="wiz-field">
                <input aria-invalid={!!fieldErrors.naturalidade} list="naturalidade-cidades" placeholder="Cidade de nascimento" value={naturalidade.cidade} onChange={(e) => updateNaturalidade({ cidade: normalizeTextName(e.target.value) })} />
                <datalist id="naturalidade-cidades">
                  {cidadeNaturalidadeOptions.map((cidade) => <option key={cidade} value={cidade} />)}
                </datalist>
              </div>
              <div className="wiz-field" style={{ maxWidth: 110 }}>
                <select aria-invalid={!!fieldErrors.naturalidade} value={naturalidade.uf} onChange={(e) => updateNaturalidade({ uf: e.target.value })}>
                  <option value="">UF</option>
                  {ufOptions.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
            </div>
            <FieldError message={fieldErrors.naturalidade} />
          </div>
        </div>
        <div className="wiz-field" style={{ maxWidth: "50%" }}>
          <label className="wiz-field-label">Estado Civil</label>
          <select value={v("estadoCivil")} onChange={(e) => updateFicha("estadoCivil", e.target.value)}>
            <option value="">Selecione...</option>
            <option value="SOLTEIRO">Solteiro</option>
            <option value="CASADO">Casado</option>
            <option value="DIVORCIADO">Divorciado</option>
            <option value="VIUVO">Viuvo</option>
            <option value="UNIAO_ESTAVEL">Uniao estavel</option>
          </select>
          <FieldError message={fieldErrors.estadoCivil} />
        </div>
        <div className="wiz-field">
          <label className="wiz-field-label">E-mail</label>
          <input aria-invalid={!!fieldErrors.email} type="email" placeholder="candidato@email.com" value={v("email")} onChange={(e) => updateFicha("email", e.target.value.trim())} />
          <FieldError message={fieldErrors.email} />
        </div>
        <div className="wiz-field">
          <label className="wiz-field-label">Telefone / WhatsApp</label>
          <input aria-invalid={!!fieldErrors.telefoneWhatsapp} inputMode="tel" placeholder="(92) 90000-0000" value={v("telefoneWhatsapp")} onChange={(e) => updateFicha("telefoneWhatsapp", formatPhone(e.target.value))} />
          <FieldError message={fieldErrors.telefoneWhatsapp} />
        </div>

        <div className="wiz-card-divider" />
        <h3 className="wiz-section-title">Endereco Residencial</h3>
        <p className="wiz-section-hint">Informe seu endereco atual de residencia.</p>

        <div className="wiz-field" style={{ maxWidth: 200 }}>
          <label className="wiz-field-label">CEP</label>
          <input aria-invalid={!!fieldErrors.cepResidencial} inputMode="numeric" placeholder="00000-000" value={v("cepResidencial")} onChange={(e) => updateFicha("cepResidencial", formatCep(e.target.value))} onBlur={() => void onCepBlur("residencial")} />
          <FieldError message={fieldErrors.cepResidencial} />
          {cepLookupMessage ? <span className="wiz-field-hint">{cepLookupMessage}</span> : null}
        </div>
        <div className="wiz-field">
          <label className="wiz-field-label">Logradouro</label>
          <input aria-invalid={!!fieldErrors.enderecoResidencial} placeholder="Ex: Av. Djalma Batista, 1000, Apto 202" value={v("enderecoResidencial")} onChange={(e) => updateFicha("enderecoResidencial", normalizeTextName(e.target.value))} />
          <span className="wiz-field-hint">Inclua numero e complemento no mesmo campo. Ex: Av. Djalma Batista, 1000, Apto 202</span>
          <FieldError message={fieldErrors.enderecoResidencial} />
        </div>
        <div className="wiz-field-row">
          <div className="wiz-field">
            <label className="wiz-field-label">Bairro</label>
            <input aria-invalid={!!fieldErrors.bairroResidencial} placeholder="Ex: Adrianopolis" value={v("bairroResidencial")} onChange={(e) => updateFicha("bairroResidencial", normalizeTextName(e.target.value))} />
            <FieldError message={fieldErrors.bairroResidencial} />
          </div>
          <div className="wiz-field">
            <label className="wiz-field-label">Cidade</label>
            <input aria-invalid={!!fieldErrors.cidadeResidencial} list="cidade-residencial-options" placeholder="Ex: Manaus" value={v("cidadeResidencial")} onChange={(e) => updateFicha("cidadeResidencial", normalizeTextName(e.target.value))} />
            <datalist id="cidade-residencial-options">
              {cidadeResidencialOptions.map((cidade) => <option key={cidade} value={cidade} />)}
            </datalist>
            <FieldError message={fieldErrors.cidadeResidencial} />
          </div>
          <div className="wiz-field" style={{ maxWidth: 90 }}>
            <label className="wiz-field-label">UF</label>
            <select aria-invalid={!!fieldErrors.ufResidencial} value={v("ufResidencial")} onChange={(e) => updateFicha("ufResidencial", e.target.value)}>
              <option value="">UF</option>
              {ufOptions.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            <FieldError message={fieldErrors.ufResidencial} />
          </div>
        </div>
      </div>

      {/* Card 2: Complementares */}
      <div className="wiz-card">
        <h2 className="wiz-card-title">Dados Complementares e Declaracoes</h2>
        <p className="wiz-card-subtitle">Informacoes complementares, declaracoes e vinculo empregaticio</p>
        <div className="wiz-card-divider" />

        <div className="wiz-field-row">
          <div className="wiz-field">
            <label className="wiz-field-label">Tipo Sanguineo</label>
              <select value={v("tipoSanguineo")} onChange={(e) => updateFicha("tipoSanguineo", e.target.value)}>
              <option value="">Selecione</option>
              {["A", "B", "AB", "O"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <FieldError message={fieldErrors.tipoSanguineo} />
            </div>
            <div className="wiz-field">
              <label className="wiz-field-label">Fator Rh</label>
            <select value={v("fatorRh")} onChange={(e) => updateFicha("fatorRh", e.target.value)}>
              <option value="">Selecione</option>
              <option value="+">+</option>
              <option value="-">-</option>
              </select>
              <FieldError message={fieldErrors.fatorRh} />
            </div>
        </div>
        <div className="wiz-field">
          <label className="wiz-field-label">Raca/Cor</label>
          <select aria-invalid={!!fieldErrors.racaCor} value={v("racaCor")} onChange={(e) => updateFicha("racaCor", e.target.value)}>
            <option value="">Selecione</option>
            {racaCorOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}
          </select>
          <FieldError message={fieldErrors.racaCor} />
          <div className="wiz-info-box" style={{ marginTop: 4 }}>
            {svgInfo}
            <span>Autodeclaracao conforme IBGE</span>
          </div>
        </div>
        <div className="wiz-field-row">
          <div className="wiz-field">
            <label className="wiz-field-label">Nome do Pai</label>
            <input placeholder="Nome completo do pai" value={v("nomePai")} onChange={(e) => updateFicha("nomePai", normalizeTextName(e.target.value))} />
            <FieldError message={fieldErrors.nomePai} />
          </div>
          <div className="wiz-field">
            <label className="wiz-field-label">Nome da Mae</label>
            <input placeholder="Nome completo da mae" value={v("nomeMae")} onChange={(e) => updateFicha("nomeMae", normalizeTextName(e.target.value))} />
            <FieldError message={fieldErrors.nomeMae} />
          </div>
        </div>

        <div className="wiz-card-divider" />
        <h3 className="wiz-section-title">Declaracoes</h3>
        <p className="wiz-section-hint">Informe abaixo suas condicoes de participacao no processo seletivo</p>

        <div className="wiz-toggle-row">
          <span className="wiz-toggle-label">Pessoa com Deficiencia (PCD)?</span>
          <div className="wiz-toggle-pills">
            <button type="button" className={`wiz-toggle-pill ${f.pessoaComDeficiencia ? "wiz-toggle-pill--on" : "wiz-toggle-pill--off"}`} onClick={() => updateFicha("pessoaComDeficiencia", true)}>Sim</button>
            <button type="button" className={`wiz-toggle-pill ${!f.pessoaComDeficiencia ? "wiz-toggle-pill--on" : "wiz-toggle-pill--off"}`} onClick={() => updateFicha("pessoaComDeficiencia", false)}>Nao</button>
          </div>
        </div>
        <div className="wiz-toggle-row">
          <span className="wiz-toggle-label">Concorre por Vagas de Acoes Afirmativas?</span>
          <div className="wiz-toggle-pills">
            <button type="button" className={`wiz-toggle-pill ${f.concorreAcoesAfirmativas ? "wiz-toggle-pill--on" : "wiz-toggle-pill--off"}`} onClick={() => updateFicha("concorreAcoesAfirmativas", true)}>Sim</button>
            <button type="button" className={`wiz-toggle-pill ${!f.concorreAcoesAfirmativas ? "wiz-toggle-pill--on" : "wiz-toggle-pill--off"}`} onClick={() => updateFicha("concorreAcoesAfirmativas", false)}>Nao</button>
          </div>
        </div>
        <div className="wiz-toggle-row">
          <span className="wiz-toggle-label">Vai solicitar Bolsa?</span>
          <div className="wiz-toggle-pills">
            <button type="button" className={`wiz-toggle-pill ${f.vaiSolicitarBolsa ? "wiz-toggle-pill--on" : "wiz-toggle-pill--off"}`} onClick={() => updateFicha("vaiSolicitarBolsa", true)}>Sim</button>
            <button type="button" className={`wiz-toggle-pill ${!f.vaiSolicitarBolsa ? "wiz-toggle-pill--on" : "wiz-toggle-pill--off"}`} onClick={() => updateFicha("vaiSolicitarBolsa", false)}>Nao</button>
          </div>
        </div>

        <div className="wiz-card-divider" />
        <div className="wiz-field">
          <label className="wiz-field-label">Situacao de Trabalho</label>
          <select value={v("empregadoSituacao")} onChange={(e) => updateFicha("empregadoSituacao", e.target.value)}>
            <option value="">Selecione</option>
            {empregadoSituacaoOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}
          </select>
          <FieldError message={fieldErrors.empregadoSituacao} />
        </div>

        {v("empregadoSituacao") === "EMPREGADO" ? (
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: 0 }}>Dados do Vinculo Empregaticio</h4>
            <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>Preencha quando a situacao de trabalho for Empregado</p>
            <div className="wiz-field">
              <label className="wiz-field-label">Regime de Trabalho</label>
               <select value={v("regimeTrabalho")} onChange={(e) => updateFicha("regimeTrabalho", e.target.value)}>
                <option value="">Selecione</option>
                {regimeTrabalhoOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}
               </select>
               <FieldError message={fieldErrors.regimeTrabalho} />
             </div>
            <div className="wiz-field"><label className="wiz-field-label">Instituicao / Local de Trabalho</label><input placeholder="Nome da instituicao ou local" value={v("instituicaoTrabalho")} onChange={(e) => updateFicha("instituicaoTrabalho", e.target.value)} /><FieldError message={fieldErrors.instituicaoTrabalho} /></div>
            <div className="wiz-field"><label className="wiz-field-label">Unidade / Departamento</label><input placeholder="Ex.: Departamento de Engenharia" value={v("unidadeDepartamentoTrabalho")} onChange={(e) => updateFicha("unidadeDepartamentoTrabalho", e.target.value)} /><FieldError message={fieldErrors.unidadeDepartamentoTrabalho} /></div>
            <div className="wiz-field"><label className="wiz-field-label">Endereco do Trabalho</label><input placeholder="Rua, numero, complemento" value={v("enderecoTrabalho")} onChange={(e) => updateFicha("enderecoTrabalho", e.target.value)} /><FieldError message={fieldErrors.enderecoTrabalho} /></div>
            <div className="wiz-field-row">
              <div className="wiz-field"><label className="wiz-field-label">CEP do Trabalho</label><input aria-invalid={!!fieldErrors.cepTrabalho} inputMode="numeric" placeholder="00000-000" value={v("cepTrabalho")} onChange={(e) => updateFicha("cepTrabalho", formatCep(e.target.value))} onBlur={() => void onCepBlur("trabalho")} /><FieldError message={fieldErrors.cepTrabalho} /></div>
              <div className="wiz-field"><label className="wiz-field-label">Cidade/Bairro do Trabalho</label><input value={v("cidadeBairroTrabalho")} onChange={(e) => updateFicha("cidadeBairroTrabalho", e.target.value)} /><FieldError message={fieldErrors.cidadeBairroTrabalho} /></div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ================================================================
   Step 2 — Dados Academicos
   ================================================================ */

function Step2DadosAcademicos({ formState, setFormState, edital, cursoLabel, fieldErrors, setFieldErrors }: {
  formState: InscricaoEditorState; setFormState: React.Dispatch<React.SetStateAction<InscricaoEditorState>>; edital: EditalDetalhe; cursoLabel: string; fieldErrors: FieldErrors; setFieldErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
}) {
  return (
    <>
      <div className="wiz-card" style={{ gap: 28 }}>
        <h2 className="wiz-card-title" style={{ fontSize: 24 }}>Dados Academicos e Linha de Pesquisa</h2>
        <div className="wiz-card-divider" />

        <div className="wiz-field">
          <label className="wiz-field-label" style={{ fontSize: 14, fontWeight: 600 }}>Curso / Nivel</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "14px 16px" }}>
            {svgGradCap}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8" }}>Definido pelo edital selecionado</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>{cursoLabel}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#64748B", background: "#F1F5F9", borderRadius: 9999, padding: "4px 10px" }}>Somente leitura</span>
          </div>
        </div>

        <div className="wiz-field">
          <label className="wiz-field-label" style={{ fontSize: 14, fontWeight: 600 }}>Linha de Pesquisa</label>
          <span className="wiz-field-hint">Escolha a linha com que seu projeto de pesquisa tem maior afinidade.</span>
          <div className="wiz-radio-list">
              {edital.linhasPesquisa.map((linha) => {
              const selected = formState.linhaPesquisaId === linha.id;
              return (
                <button type="button" key={linha.id} className={`wiz-radio-option${selected ? " wiz-radio-option--selected" : ""}`} onClick={() => setFormState((s) => ({ ...s, linhaPesquisaId: linha.id }))}>
                  <span className={`wiz-radio-dot${selected ? " wiz-radio-dot--selected" : ""}`} />
                  <div>
                    <div className={`wiz-radio-title${selected ? " wiz-radio-title--selected" : ""}`}>{linha.nome}</div>
                    {linha.descricao ? <div className="wiz-radio-desc">{linha.descricao}</div> : null}
                  </div>
                </button>
              );
            })}
          </div>
          <FieldError message={fieldErrors.linhaPesquisaId} />
          <div className="wiz-info-box">
            {svgInfo}
            <span>A linha de pesquisa escolhida e definitiva apos a submissao. Escolha com atencao conforme o edital vigente.</span>
          </div>
        </div>
      </div>

      <div className="wiz-card" style={{ gap: 24 }}>
        <h2 className="wiz-card-title" style={{ fontSize: 24 }}>Modalidade de Concorrencia e Curriculo</h2>
        <div className="wiz-card-divider" />

        <div className="wiz-field">
          <label className="wiz-field-label" style={{ fontSize: 14, fontWeight: 600 }}>Modalidade de Concorrencia</label>
          <div className="wiz-radio-list" style={{ gap: 12 }}>
            {modalidadeConcorrenciaOptions.map((opt) => {
              const selected = formState.modalidadeConcorrencia === opt;
              const labels: Record<string, { title: string; desc: string }> = {
                AMPLA_CONCORRENCIA: { title: "Ampla Concorrencia", desc: "Processo seletivo regular sem reserva de vagas." },
                ACOES_AFIRMATIVAS: { title: "Acoes Afirmativas", desc: "Negros, indigenas, quilombolas e grupos elegiveis." },
                PCD: { title: "PCD — Pessoa com Deficiencia", desc: "Com deficiencia conforme Lei Brasileira de Inclusao." },
              };
              const l = labels[opt] ?? { title: getStatusLabel(opt), desc: "" };
              return (
                <button type="button" key={opt} className={`wiz-radio-option${selected ? " wiz-radio-option--selected" : ""}`}
                  style={selected ? { background: "#1B3A6B", borderColor: "#1B3A6B" } : undefined}
                  onClick={() => setFormState((s) => ({ ...s, modalidadeConcorrencia: opt }))}
                >
                  <span className={`wiz-radio-dot${selected ? " wiz-radio-dot--selected" : ""}`} style={selected ? { background: "#2152A0", borderColor: "#fff" } : undefined} />
                  <div>
                    <div className="wiz-radio-title" style={selected ? { color: "#fff" } : undefined}>{l.title}</div>
                    <div className="wiz-radio-desc" style={selected ? { color: "#BFDBFE" } : undefined}>{l.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <FieldError message={fieldErrors.modalidadeConcorrencia} />
          <div className="wiz-warn-box" style={{ borderRadius: 6, padding: "10px 12px", gap: 10 }}>
            {svgTriangleAlert("#F59E0B")}
            <span style={{ fontSize: 12, fontWeight: 500, color: "#92400E" }}>A modalidade escolhida determina os documentos exigidos.</span>
          </div>
        </div>

        <div className="wiz-card-divider" />

        <div className="wiz-field">
          <label className="wiz-field-label" style={{ fontSize: 14, fontWeight: 600 }}>Resumo do Curriculo</label>
          <textarea placeholder="Descreva brevemente sua formacao, experiencias e principais publicacoes..." style={{ minHeight: 120 }}
            value={formState.resumoCurriculo} onChange={(e) => setFormState((s) => ({ ...s, resumoCurriculo: e.target.value }))}
          />
          <FieldError message={fieldErrors.resumoCurriculo} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94A3B8" }}>
            <span>Minimo de 10 caracteres</span>
            <span>{formState.resumoCurriculo.length} / 2000 caracteres</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================================================================
   Step 3 — Redacao
   ================================================================ */

function Step3Redacao({ formState, setFormState, redacaoLength, fieldErrors, setFieldErrors }: {
  formState: InscricaoEditorState; setFormState: React.Dispatch<React.SetStateAction<InscricaoEditorState>>; redacaoLength: number; fieldErrors: FieldErrors; setFieldErrors: React.Dispatch<React.SetStateAction<FieldErrors>>;
}) {
  const pct = Math.min((redacaoLength / 1500) * 100, 100);
  const withinRange = redacaoLength === 0 || (redacaoLength >= 500 && redacaoLength <= 1500);

  return (
    <>
      <div className="wiz-warn-box" style={{ width: 760, maxWidth: "100%" }}>
        {svgTriangleAlert("#F59E0B")}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="wiz-warn-box-title">Instrucoes Importantes — Leia antes de escrever</span>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            <li className="wiz-warn-box-text">A redacao deve ser escrita diretamente neste campo — nao serao aceitos arquivos externos</li>
            <li className="wiz-warn-box-text">Minimo de 500 e maximo de 1.500 caracteres incluindo espacos</li>
            <li className="wiz-warn-box-text">Texto comprovadamente elaborado por IA recebera nota zero</li>
            <li className="wiz-warn-box-text">Revise antes de passar para a proxima etapa — a redacao e salva junto ao rascunho</li>
          </ul>
        </div>
      </div>

      <div style={{ width: 760, maxWidth: "100%", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ padding: "24px 28px 20px" }}>
          <h2 className="wiz-card-title">Redacao — Proposta de Pesquisa</h2>
          <p style={{ fontSize: 13, color: "#94A3B8", margin: "4px 0 0" }}>Edital {formState.temaRedacao ? "" : "092/2025"} · {formState.temaRedacao ? "Tema definido" : "Mestrado em Engenharia Eletrica"}</p>
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />

        <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label className="wiz-field-label" style={{ fontSize: 13, fontWeight: 600 }}>Tema da Redacao</label>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#000", background: "#FEF2F2", borderRadius: 4, padding: "2px 6px" }}>Obrigatorio</span>
          </div>
          <input style={{ height: 44, borderRadius: 8, border: "1px solid #CBD5E1", padding: "0 14px", fontSize: 13 }}
            value={formState.temaRedacao} onChange={(e) => { setFieldErrors((current) => { const next = { ...current }; delete next.temaRedacao; return next; }); setFormState((s) => ({ ...s, temaRedacao: e.target.value })); }}
            placeholder="Descreva o tema central da sua proposta de pesquisa"
          />
          <FieldError message={fieldErrors.temaRedacao} />
          <span className="wiz-field-hint">Descreva o tema central da sua proposta de pesquisa</span>
        </div>

        <div style={{ height: 1, background: "#F1F5F9" }} />

        <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label className="wiz-field-label" style={{ fontSize: 13, fontWeight: 600 }}>Texto da Redacao</label>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#000", background: "#FEF2F2", borderRadius: 4, padding: "2px 6px" }}>Obrigatorio</span>
          </div>
          <textarea style={{ minHeight: 240, borderRadius: 8, border: "1px solid #CBD5E1", padding: "16px 16px 40px", lineHeight: 1.65, fontSize: 13, resize: "vertical" }}
            value={formState.redacaoTexto} onChange={(e) => { setFieldErrors((current) => { const next = { ...current }; delete next.redacaoTexto; return next; }); setFormState((s) => ({ ...s, redacaoTexto: e.target.value })); }}
          />
          <FieldError message={fieldErrors.redacaoTexto} />
          <div className="wiz-char-counter">
            <div className="wiz-char-bar"><div className="wiz-char-bar-fill" style={{ width: `${pct}%` }} /></div>
            <span className="wiz-char-pill"><strong>{redacaoLength}</strong><span>/ 1500</span></span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 11, fontWeight: 500 }}>
            <span style={{ color: "#334155" }}>Minimo: 500</span>
            <span style={{ color: "#94A3B8" }}>Maximo: 1.500</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: withinRange ? "#334155" : "#DC2626" }}>{redacaoLength} caracteres · {withinRange ? "dentro do limite" : "fora do limite"}</span>
          </div>
        </div>

        <div style={{ height: 1, background: "#F1F5F9" }} />

        <div style={{ padding: "20px 28px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#334155" }}>
            Criterios de Avaliacao — Etapa 1
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: "#64748B" }}>Nota minima: 7,0</span>
          </div>
          {[
            { name: "Adequacao e Dominio do Tema", w: "50%", primary: true },
            { name: "Organizacao Textual e Coerencia", w: "15%", primary: false },
            { name: "Objetividade e Capacidade de Sintese", w: "15%", primary: false },
            { name: "Estrutura", w: "10%", primary: false },
            { name: "Grafia, Acentuacao e Gramatica", w: "10%", primary: false },
          ].map((c) => (
            <div key={c.name} className="wiz-rubric-row">
              {c.name}
              <span className={`wiz-rubric-badge ${c.primary ? "wiz-rubric-badge--primary" : "wiz-rubric-badge--muted"}`}>{c.w}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: "#F1F5F9" }} />
        <div className="wiz-ai-warn" style={{ margin: "0 28px 24px", marginTop: 16 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>
          Redacao identificada como gerada por IA recebe nota 0,0 — conforme regras do edital
        </div>
      </div>
    </>
  );
}

/* ================================================================
   Step 4 — Documentos
   ================================================================ */

function Step4Documentos({ inscricaoId, documentos, anexoIvDocumento, downloading, uploadingAnexoIv, uploadingDocumento, onDownloadAnexoIv, onUploadAnexoIv, onDocFileSelect, onAddDocumento, docFormTipo, setDocFormTipo, docFormNome, setDocFormNome, docFormUrl, docFormFilename, fileRef, fieldErrors }: {
  inscricaoId: string | null; documentos: Array<{ id: string; tipo: string; nome: string; nomeArquivo?: string }>; anexoIvDocumento: { id: string; tipo: string; nome: string; nomeArquivo?: string } | null;
  downloading: boolean; uploadingAnexoIv: boolean; uploadingDocumento: boolean;
  onDownloadAnexoIv: () => void; onUploadAnexoIv: (f: File) => void; onDocFileSelect: (f: File) => void; onAddDocumento: (e: FormEvent) => void;
  docFormTipo: string; setDocFormTipo: (v: string) => void; docFormNome: string; setDocFormNome: (v: string) => void;
  docFormUrl: string; docFormFilename: string; fileRef: React.RefObject<HTMLInputElement | null>; fieldErrors: FieldErrors;
}) {
  const docsSemAnexoIv = documentos.filter((d) => d.tipo !== "ANEXO_IV");

  return (
    <>
      <div style={{ width: 760, maxWidth: "100%", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ padding: "28px 28px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 className="wiz-card-title">Documentos da Inscricao</h2>
          <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Envie todos os documentos obrigatorios em formato PDF. O sistema ira consolidar o pacote ao final.</p>
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />

        {/* Anexo IV section */}
        <div className="wiz-annex">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {svgFileBadge}
            <span className="wiz-annex-title">Anexo IV — Ficha Cadastral</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: "#1B3A6B", borderRadius: 99, padding: "3px 10px" }}>Obrigatorio</span>
          </div>
          <span className="wiz-annex-desc">Baixe o Anexo IV preenchido com os dados do formulario, assine o PDF fora da plataforma e reenvie o arquivo assinado.</span>
          <div className="wiz-annex-steps">
            <span className="wiz-annex-step-num">1</span><span className="wiz-annex-step-label">Baixar PDF</span>
            <span className="wiz-annex-connector" />
            <span className="wiz-annex-step-num">2</span><span className="wiz-annex-step-label">Assinar fora</span>
            <span className="wiz-annex-connector" />
            <span className="wiz-annex-step-num">3</span><span className="wiz-annex-step-label">Reenviar assinado</span>
          </div>
          <div className="wiz-annex-actions">
            <button type="button" className="wiz-annex-dl-btn" disabled={downloading || !inscricaoId} onClick={onDownloadAnexoIv}>
              {svgDownload("#2563EB")} {downloading ? "Baixando..." : "Baixar Anexo IV preenchido"}
            </button>
            <span style={{ flex: 1 }} />
            <FileField
              disabled={uploadingAnexoIv || !inscricaoId}
              hint={anexoIvDocumento ? `Reenviado: ${anexoIvDocumento.nomeArquivo ?? "Anexo IV assinado"}` : ""}
              label="Enviar Anexo IV assinado (PDF)"
              onFileSelect={onUploadAnexoIv}
            />
          </div>
          <span className="wiz-annex-hint">O PDF ja contem seus dados preenchidos nas etapas anteriores</span>
        </div>

        {/* Document list */}
        <div style={{ padding: "8px 0" }}>
          {docsSemAnexoIv.length > 0 ? docsSemAnexoIv.map((doc) => (
            <div key={doc.id} className="wiz-doc-row">
              <div className="wiz-doc-icon wiz-doc-icon--green">{svgCircleCheck("#22C55E")}</div>
              <div className="wiz-doc-info">
                <span className="wiz-doc-title">{getStatusLabel(doc.tipo)}</span>
                {doc.nomeArquivo ? <span className="wiz-doc-file-pill">{doc.nomeArquivo}</span> : null}
              </div>
            </div>
          )) : (
            <div style={{ padding: "24px 28px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
              Nenhum documento registrado ainda. Use o formulario abaixo para adicionar.
            </div>
          )}
        </div>

        {/* Add document form */}
        <div style={{ borderTop: "1px solid #F1F5F9", padding: "20px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#334155", margin: 0 }}>Adicionar documento</h3>
          <form onSubmit={onAddDocumento} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="wiz-field-row">
              <div className="wiz-field">
                <label className="wiz-field-label">Tipo</label>
                <select value={docFormTipo} onChange={(e) => setDocFormTipo(e.target.value)}>
                  {documentoTipoOptionsSemAnexoIv.map((t) => <option key={t} value={t}>{getStatusLabel(t)}</option>)}
                </select>
              </div>
              <div className="wiz-field">
                <label className="wiz-field-label">Nome</label>
                <input value={docFormNome} onChange={(e) => setDocFormNome(e.target.value)} placeholder="Nome do documento" />
              </div>
            </div>
            <FileField disabled={uploadingDocumento} hint={docFormFilename ? `Arquivo: ${docFormFilename}` : "Envie o PDF do documento"} label="Arquivo" onFileSelect={onDocFileSelect} />
            <button type="submit" className="wiz-btn-next" disabled={uploadingDocumento || !docFormUrl} style={{ alignSelf: "flex-start" }}>
              Registrar documento
            </button>
          </form>
        </div>
      </div>

      {/* Progress bar */}
      <div className="wiz-progress-bar">
        {Object.entries(fieldErrors).some(([key]) => key.startsWith("documento:")) ? (
          <div className="wiz-document-errors">
            {Object.entries(fieldErrors).filter(([key]) => key.startsWith("documento:")).map(([key, message]) => (
              <div key={key} className="wiz-document-error-item">{message}</div>
            ))}
          </div>
        ) : null}
        <div className="wiz-progress-label">
          <strong>Documentos enviados</strong>
          <span>{documentos.length} registrado(s)</span>
        </div>
        <div className="wiz-progress-track">
          <div className="wiz-progress-fill" style={{ width: `${Math.min((documentos.length / 7) * 100, 100)}%` }} />
        </div>
      </div>
    </>
  );
}

/* ================================================================
   Step 5 — Revisao e Submissao
   ================================================================ */

function Step5Revisao({ formState, edital, cursoLabel, documentos, confirmChecks, setConfirmChecks, checklist, inscricaoStatus, goToStep }: {
  formState: InscricaoEditorState; edital: EditalDetalhe; cursoLabel: string;
  documentos: Array<{ id: string; tipo: string; nome: string; nomeArquivo?: string }>;
  confirmChecks: boolean[]; setConfirmChecks: React.Dispatch<React.SetStateAction<boolean[]>>;
  checklist: SubmissionChecklistViewItem[]; inscricaoStatus: string; goToStep: (s: number) => void;
}) {
  const f = formState.fichaInscricao;
  const linhaLabel = edital.linhasPesquisa.find((l) => l.id === formState.linhaPesquisaId)?.nome ?? "Nao definida";

  function toggleCheck(i: number) {
    setConfirmChecks((c) => c.map((v, j) => j === i ? !v : v));
  }

  return (
    <>
      <div style={{ width: 760, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Revisao da Inscricao</h1>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0 }}>Confira todos os dados antes de submeter. Apos a submissao, a inscricao podera ser cancelada para edicao dentro do prazo do edital.</p>
      </div>

      {inscricaoStatus === "SUBMETIDA" ? (
        <div className="wiz-info-box" style={{ width: 760, maxWidth: "100%" }}>
          {svgInfo}
          <span style={{ fontWeight: 600 }}>Inscricao ja submetida. Voce pode cancelar a submissao para editar dentro do prazo do edital.</span>
        </div>
      ) : null}

      <div className="wiz-warn-box" style={{ width: 760, maxWidth: "100%", borderRadius: 8, padding: "14px 16px" }}>
        {svgTriangleAlert("#F59E0B")}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>Atencao — Leia antes de submeter</span>
          <span style={{ fontSize: 12, color: "#92400E" }}>Voce podera cancelar a inscricao para edicao ate o prazo final do edital. Todos os dados, incluindo a redacao, poderao ser alterados enquanto a janela de inscricao estiver aberta.</span>
        </div>
      </div>

      {/* Review card */}
      <div className="wiz-review-card">
        {/* Section 1: Dados Pessoais */}
        <div className="wiz-review-section-hdr">
          {svgUser} <span className="wiz-review-section-title">Dados Pessoais</span>
          <button type="button" className="wiz-review-edit-btn" onClick={() => goToStep(0)}>{svgPencilSm} Editar</button>
        </div>
        <div className="wiz-review-grid">
          <div className="wiz-review-field"><span className="wiz-review-field-label">Nome Completo</span><span className="wiz-review-field-value">{String(f.nomeCompleto || "—")}</span></div>
          <div className="wiz-review-field"><span className="wiz-review-field-label">CPF</span><span className="wiz-review-field-value">{String(f.cpf || "—")}</span></div>
          <div className="wiz-review-field"><span className="wiz-review-field-label">E-mail</span><span className="wiz-review-field-value">{String(f.email || "—")}</span></div>
          <div className="wiz-review-field"><span className="wiz-review-field-label">Telefone</span><span className="wiz-review-field-value">{String(f.telefoneWhatsapp || "—")}</span></div>
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />

        {/* Section 2: Dados Academicos */}
        <div className="wiz-review-section-hdr">
          {svgGradCap} <span className="wiz-review-section-title">Dados Academicos</span>
          <button type="button" className="wiz-review-edit-btn" onClick={() => goToStep(1)}>{svgPencilSm} Editar</button>
        </div>
        <div className="wiz-review-grid">
          <div className="wiz-review-field"><span className="wiz-review-field-label">Curso Pretendido</span><span className="wiz-review-field-value">{cursoLabel}</span></div>
          <div className="wiz-review-field"><span className="wiz-review-field-label">Linha de Pesquisa</span><span className="wiz-review-field-value">{linhaLabel}</span></div>
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />

        {/* Section 3: Redacao */}
        <div className="wiz-review-section-hdr">
          {svgFilePen} <span className="wiz-review-section-title">Redacao — Proposta de Pesquisa</span>
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: "#065F46", background: "#F0FDF4", borderRadius: 99, padding: "4px 10px" }}>
            {formState.redacaoTexto.length} caracteres
          </span>
        </div>
        <div style={{ padding: "16px 24px", fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
          {formState.redacaoTexto ? `"${formState.redacaoTexto.slice(0, 300)}${formState.redacaoTexto.length > 300 ? "..." : ""}"` : "Nenhuma redacao preenchida."}
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />

        {/* Section 4: Documentos */}
        <div className="wiz-review-section-hdr">
          {svgPaperclip} <span className="wiz-review-section-title">Documentos</span>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#065F46", background: "#F0FDF4", borderRadius: 99, padding: "4px 10px" }}>
            {svgCircleCheck("#22C55E")} {documentos.length} registrado(s)
          </span>
        </div>
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
          {documentos.map((doc) => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              {svgCircleCheck("#22C55E")}
              <span style={{ color: doc.tipo === "ANEXO_IV" ? "#1E293B" : "#334155", fontWeight: doc.tipo === "ANEXO_IV" ? 600 : 400 }}>{getStatusLabel(doc.tipo)}</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: "#94A3B8", fontSize: 11 }}>{doc.nomeArquivo ?? ""}</span>
            </div>
          ))}
          {documentos.length === 0 ? <span style={{ color: "#94A3B8", fontSize: 12 }}>Nenhum documento registrado.</span> : null}
        </div>
      </div>

      {/* Confirmation card */}
      <div className="wiz-confirm-card">
        <h3 className="wiz-confirm-title">Confirme antes de enviar</h3>
        {[
          `Li e compreendi todas as regras do Edital ${edital.numero}`,
          "Declaro que as informacoes prestadas sao veridicas e os documentos sao autenticos",
          "Confirmo que baixei, assinei e reenviei o Anexo IV assinado em PDF",
          "Estou ciente de que, apos a submissao, a edicao so sera possivel mediante cancelamento dentro do prazo do edital",
        ].map((text, i) => (
          <div key={i} className="wiz-confirm-row">
            <button type="button" className={`wiz-confirm-check ${confirmChecks[i] ? "wiz-confirm-check--on" : "wiz-confirm-check--off"}`} onClick={() => toggleCheck(i)}>
              {confirmChecks[i] ? svgCheckSm : null}
            </button>
            <span>{text}</span>
            {!confirmChecks[i] && i === 3 ? <span style={{ fontSize: 10, fontWeight: 600, color: "#DC2626", background: "#FEF2F2", borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>Pendente</span> : null}
          </div>
        ))}
      </div>

      {checklist.length > 0 ? (
        <div style={{ width: 760, maxWidth: "100%", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <strong style={{ fontSize: 13, color: "#991B1B" }}>Checklist de pendencias retornado pelo backend:</strong>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {checklist.map((item) => (
              <li key={item.key} style={{ fontSize: 12, color: "#991B1B" }}>
                <strong>{item.label}:</strong> {item.pendencia ?? (item.presente && item.pdfValido ? "ok" : "pendente")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
