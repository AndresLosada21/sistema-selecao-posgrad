import {
  ModalidadeConcorrencia,
  TipoDocumentoInscricao,
  type DocumentoInscricao,
  type Edital,
  type Inscricao,
} from "@prisma/client";

export const REDACAO_LIMITS = {
  min: 500,
  max: 1500,
} as const;

export type FichaInscricao = {
  nomeCompleto?: string;
  rg?: string;
  rgDataExpedicao?: string;
  cpf?: string;
  passaporte?: string;
  nacionalidade?: string;
  naturalidade?: string;
  email?: string;
  telefoneWhatsapp?: string;
  dataNascimento?: string;
  estadoCivil?: string;
  genero?: "MASCULINO" | "FEMININO";
  tipoSanguineo?: string;
  fatorRh?: string;
  racaCor?: "BRANCA" | "PRETA" | "PARDA" | "AMARELA" | "INDIGENA" | "QUILOMBOLA" | "NAO_DECLARADA";
  pessoaComDeficiencia?: boolean;
  concorreAcoesAfirmativas?: boolean;
  vaiSolicitarBolsa?: boolean;
  nomePai?: string;
  nomeMae?: string;
  enderecoResidencial?: string;
  cepResidencial?: string;
  bairroResidencial?: string;
  ufResidencial?: string;
  cidadeResidencial?: string;
  empregadoSituacao?: "EMPREGADO" | "NAO_EMPREGADO" | "APOSENTADO";
  regimeTrabalho?: "PARCIAL" | "INTEGRAL" | "DEDICACAO_EXCLUSIVA";
  instituicaoTrabalho?: string;
  unidadeDepartamentoTrabalho?: string;
  enderecoTrabalho?: string;
  cepTrabalho?: string;
  cidadeBairroTrabalho?: string;
};

type DocumentoResumo = Pick<
  DocumentoInscricao,
  "tipo" | "nome" | "nomeArquivo" | "urlArquivo" | "mimeType" | "tamanhoBytes" | "statusValidacao"
>;

type RequiredDocumentRule = {
  tipo: TipoDocumentoInscricao;
  label: string;
};

export type SubmissionChecklistItem = {
  tipo: TipoDocumentoInscricao;
  label: string;
  presente: boolean;
  pdfValido: boolean;
  pendencia: string | null;
  documento: {
    nomeArquivo: string;
    urlArquivo: string;
    statusValidacao: string;
  } | null;
};

export type SubmissionValidationResult = {
  ok: boolean;
  errors: string[];
  checklist: SubmissionChecklistItem[];
  redacaoCaracteres: number;
};

type SubmissionValidationInput = {
  modalidadeConcorrencia?: ModalidadeConcorrencia | null;
  fichaInscricao: FichaInscricao | null;
  temaRedacao?: string | null;
  redacaoTexto?: string | null;
  documentos: DocumentoResumo[];
  pagamentoDispensado: boolean;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function hasValue(value: string | null | undefined) {
  return normalizeString(value).length > 0;
}

export type ReservasConcorrencia = {
  acoesAfirmativas: boolean;
  pcd: boolean;
};

export function resolveReservasConcorrencia(input: {
  fichaInscricao?: FichaInscricao | null;
  modalidadeConcorrencia?: ModalidadeConcorrencia | null;
}) {
  const ficha = input.fichaInscricao ?? null;
  const acoesAfirmativas = typeof ficha?.concorreAcoesAfirmativas === "boolean"
    ? ficha.concorreAcoesAfirmativas
    : input.modalidadeConcorrencia === ModalidadeConcorrencia.ACOES_AFIRMATIVAS;
  const pcd = typeof ficha?.pessoaComDeficiencia === "boolean"
    ? ficha.pessoaComDeficiencia
    : input.modalidadeConcorrencia === ModalidadeConcorrencia.PCD;

  return {
    acoesAfirmativas,
    pcd,
  } satisfies ReservasConcorrencia;
}

export function resolveLegacyModalidadeConcorrencia(input: {
  reservas: ReservasConcorrencia;
  modalidadeAtual?: ModalidadeConcorrencia | null;
}) {
  if (input.reservas.acoesAfirmativas && input.reservas.pcd) {
    if (
      input.modalidadeAtual === ModalidadeConcorrencia.ACOES_AFIRMATIVAS
      || input.modalidadeAtual === ModalidadeConcorrencia.PCD
    ) {
      return input.modalidadeAtual;
    }

    return ModalidadeConcorrencia.ACOES_AFIRMATIVAS;
  }

  if (input.reservas.acoesAfirmativas) {
    return ModalidadeConcorrencia.ACOES_AFIRMATIVAS;
  }

  if (input.reservas.pcd) {
    return ModalidadeConcorrencia.PCD;
  }

  return ModalidadeConcorrencia.AMPLA_CONCORRENCIA;
}

function isEstrangeiro(nacionalidade: string | undefined) {
  const normalized = normalizeString(nacionalidade).toUpperCase();
  return normalized.length > 0 && normalized !== "BRASILEIRA" && normalized !== "BRASILEIRO";
}

function isPdfDocument(documento: DocumentoResumo | undefined) {
  if (!documento) {
    return false;
  }

  const mimeType = normalizeString(documento.mimeType).toLowerCase();
  const nomeArquivo = normalizeString(documento.nomeArquivo).toLowerCase();
  const urlArquivo = normalizeString(documento.urlArquivo).toLowerCase();

  return mimeType === "application/pdf" || nomeArquivo.endsWith(".pdf") || urlArquivo.endsWith(".pdf");
}

function getRequiredDocumentRules(input: {
  fichaInscricao: FichaInscricao;
  modalidadeConcorrencia?: ModalidadeConcorrencia | null;
  pagamentoDispensado: boolean;
}) {
  const reservas = resolveReservasConcorrencia(input);
  const rules: RequiredDocumentRule[] = [
    { tipo: TipoDocumentoInscricao.ANEXO_IV, label: "Anexo IV assinado" },
    { tipo: TipoDocumentoInscricao.ANEXO_V, label: "Declaracao de titulos" },
    { tipo: TipoDocumentoInscricao.DIPLOMA, label: "Diploma de graduacao ou declaracao de conclusao/finalista" },
    { tipo: TipoDocumentoInscricao.HISTORICO, label: "Historico escolar de graduacao" },
    { tipo: TipoDocumentoInscricao.CURRICULO, label: "Curriculo Lattes com documentacao comprobatoria" },
  ];

  if (isEstrangeiro(input.fichaInscricao.nacionalidade) || hasValue(input.fichaInscricao.passaporte)) {
    rules.push({ tipo: TipoDocumentoInscricao.RNE_PASSAPORTE, label: "RNE ou passaporte" });
  } else {
    rules.push({ tipo: TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO, label: "Documento de identidade com foto" });
  }

  if (!input.pagamentoDispensado) {
    rules.push({ tipo: TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO, label: "Comprovante de pagamento" });
  }

  if (input.fichaInscricao.pessoaComDeficiencia) {
    rules.push({ tipo: TipoDocumentoInscricao.LAUDO_PCD, label: "Laudo medico PCD" });
  }

  if (reservas.acoesAfirmativas) {
    rules.push({
      tipo: TipoDocumentoInscricao.ANEXO_VIII_AUTODECLARACAO,
      label: "Autodeclaracao e ciencia da gravacao de imagem",
    });
  }

  if (input.fichaInscricao.racaCor === "INDIGENA" || input.fichaInscricao.racaCor === "QUILOMBOLA") {
    rules.push({
      tipo: TipoDocumentoInscricao.COMPROVANTE_ETNICO,
      label: "Comprovante de povo, etnia, comunidade ou associacao",
    });
  }

  return rules;
}

export function mergeFichaInscricao(
  atual: FichaInscricao | null | undefined,
  incoming: FichaInscricao | null | undefined,
) {
  if (!incoming) {
    return atual ?? null;
  }

  const merged = {
    ...(atual ?? {}),
    ...incoming,
  } satisfies FichaInscricao;

  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined),
  ) as FichaInscricao;
}

export function countRedacaoCharacters(redacaoTexto: string | null | undefined) {
  return normalizeString(redacaoTexto).length;
}

export function getFichaInscricaoSubmissionErrors(fichaInscricao: FichaInscricao | null | undefined) {
  if (!fichaInscricao) {
    return ["ficha de inscricao ausente"];
  }

  const errors: string[] = [];
  const requiredFields: Array<[keyof FichaInscricao, string]> = [
    ["nomeCompleto", "nome completo"],
    ["nacionalidade", "nacionalidade"],
    ["naturalidade", "naturalidade"],
    ["email", "e-mail"],
    ["telefoneWhatsapp", "telefone/whatsapp"],
    ["dataNascimento", "data de nascimento"],
    ["estadoCivil", "estado civil"],
    ["genero", "genero"],
    ["tipoSanguineo", "tipo sanguineo"],
    ["fatorRh", "fator RH"],
    ["racaCor", "raca/cor"],
    ["nomePai", "nome do pai"],
    ["nomeMae", "nome da mae"],
    ["enderecoResidencial", "endereco residencial"],
    ["cepResidencial", "CEP residencial"],
    ["bairroResidencial", "bairro residencial"],
    ["ufResidencial", "UF residencial"],
    ["cidadeResidencial", "cidade residencial"],
    ["empregadoSituacao", "situacao de trabalho"],
  ];

  for (const [field, label] of requiredFields) {
    if (!hasValue(fichaInscricao[field] as string | undefined)) {
      errors.push(label);
    }
  }

  if (fichaInscricao.pessoaComDeficiencia === undefined) {
    errors.push("indicacao de pessoa com deficiencia");
  }

  if (fichaInscricao.concorreAcoesAfirmativas === undefined) {
    errors.push("indicacao de vaga de acoes afirmativas");
  }

  if (fichaInscricao.vaiSolicitarBolsa === undefined) {
    errors.push("indicacao de solicitacao de bolsa");
  }

  if (isEstrangeiro(fichaInscricao.nacionalidade) || hasValue(fichaInscricao.passaporte)) {
    if (!hasValue(fichaInscricao.passaporte)) {
      errors.push("passaporte");
    }

    return errors;
  }

  if (!hasValue(fichaInscricao.rg)) {
    errors.push("RG");
  }

  if (!hasValue(fichaInscricao.rgDataExpedicao)) {
    errors.push("data de expedicao do RG");
  }

  if (!hasValue(fichaInscricao.cpf)) {
    errors.push("CPF");
  }

  if (fichaInscricao.empregadoSituacao === "EMPREGADO") {
    const trabalhoFields: Array<[keyof FichaInscricao, string]> = [
      ["regimeTrabalho", "regime de trabalho"],
      ["instituicaoTrabalho", "instituicao/local de trabalho"],
      ["unidadeDepartamentoTrabalho", "unidade/departamento"],
      ["enderecoTrabalho", "endereco do trabalho"],
      ["cepTrabalho", "CEP do trabalho"],
      ["cidadeBairroTrabalho", "cidade e bairro do trabalho"],
    ];

    for (const [field, label] of trabalhoFields) {
      if (!hasValue(fichaInscricao[field] as string | undefined)) {
        errors.push(label);
      }
    }
  }

  return errors;
}

export function validateInscricaoForSubmission(input: SubmissionValidationInput): SubmissionValidationResult {
  const errors: string[] = [];
  const fichaErrors = getFichaInscricaoSubmissionErrors(input.fichaInscricao);
  const redacaoCaracteres = countRedacaoCharacters(input.redacaoTexto);

  if (!hasValue(input.temaRedacao)) {
    errors.push("tema da redacao");
  }

  if (redacaoCaracteres < REDACAO_LIMITS.min || redacaoCaracteres > REDACAO_LIMITS.max) {
    errors.push(`redacao com tamanho entre ${REDACAO_LIMITS.min} e ${REDACAO_LIMITS.max} caracteres`);
  }

  errors.push(...fichaErrors);

  const requiredDocumentRules = input.fichaInscricao
    ? getRequiredDocumentRules({
        fichaInscricao: input.fichaInscricao,
        modalidadeConcorrencia: input.modalidadeConcorrencia,
        pagamentoDispensado: input.pagamentoDispensado,
      })
    : [];

  const checklist = requiredDocumentRules.map((rule) => {
    const documento = input.documentos.find((current) => current.tipo === rule.tipo);
    const pdfValido = isPdfDocument(documento);
    const presente = Boolean(documento);

    let pendencia: string | null = null;

    if (!presente) {
      pendencia = `${rule.label} ausente`;
    } else if (!pdfValido) {
      pendencia = `${rule.label} deve estar em PDF`;
    }

    if (pendencia) {
      errors.push(pendencia);
    }

    return {
      tipo: rule.tipo,
      label: rule.label,
      presente,
      pdfValido,
      pendencia,
      documento: documento
        ? {
            nomeArquivo: documento.nomeArquivo,
            urlArquivo: documento.urlArquivo,
            statusValidacao: documento.statusValidacao,
          }
        : null,
    } satisfies SubmissionChecklistItem;
  });

  return {
    ok: errors.length === 0,
    errors,
    checklist,
    redacaoCaracteres,
  };
}

export function buildInscricaoSubmissionSnapshot(input: {
  edital: Pick<Edital, "id" | "numero" | "titulo" | "cursoNivel">;
  inscricao: Pick<Inscricao, "id" | "modalidadeConcorrencia" | "linhaPesquisaId"> & {
    linhaPesquisaNome?: string | null;
  };
  fichaInscricao: FichaInscricao;
  temaRedacao: string;
  redacaoTexto: string;
  checklist: SubmissionChecklistItem[];
  documentos: DocumentoResumo[];
  pagamentoDispensado: boolean;
  versaoSubmissao: number;
}) {
  const orderedDocumentTypes = input.checklist.map((item) => item.tipo);
  const documentosOrdenados = [...input.documentos].sort((left, right) => {
    const leftIndex = orderedDocumentTypes.indexOf(left.tipo);
    const rightIndex = orderedDocumentTypes.indexOf(right.tipo);
    const safeLeftIndex = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const safeRightIndex = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

    if (safeLeftIndex !== safeRightIndex) {
      return safeLeftIndex - safeRightIndex;
    }

    return left.nomeArquivo.localeCompare(right.nomeArquivo);
  });

  return {
    versaoSubmissao: input.versaoSubmissao,
    geradoEm: new Date().toISOString(),
    edital: input.edital,
    inscricao: {
      id: input.inscricao.id,
      modalidadeConcorrencia: input.inscricao.modalidadeConcorrencia,
      reservasConcorrencia: resolveReservasConcorrencia({
        fichaInscricao: input.fichaInscricao,
        modalidadeConcorrencia: input.inscricao.modalidadeConcorrencia,
      }),
      linhaPesquisaId: input.inscricao.linhaPesquisaId,
      linhaPesquisaNome: input.inscricao.linhaPesquisaNome ?? null,
      pagamentoDispensado: input.pagamentoDispensado,
      pacoteDocumentalNomeArquivo: `inscricao-${input.inscricao.id}-v${input.versaoSubmissao}.pdf`,
    },
    fichaInscricao: input.fichaInscricao,
    redacao: {
      tema: input.temaRedacao,
      caracteres: countRedacaoCharacters(input.redacaoTexto),
      texto: input.redacaoTexto,
    },
    checklist: input.checklist,
    documentos: documentosOrdenados.map((documento, index) => ({
      ordem: index + 1,
      tipo: documento.tipo,
      nome: documento.nome,
      nomeArquivo: documento.nomeArquivo,
      urlArquivo: documento.urlArquivo,
      mimeType: documento.mimeType ?? null,
      tamanhoBytes: documento.tamanhoBytes ?? null,
      statusValidacao: documento.statusValidacao,
      pdfValido: isPdfDocument(documento),
    })),
  };
}
