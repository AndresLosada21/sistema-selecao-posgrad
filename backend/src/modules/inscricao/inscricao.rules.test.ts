import test from "node:test";
import assert from "node:assert/strict";

import { ModalidadeConcorrencia, ModalidadeEtapa1, StatusDocumentoInscricao, TipoDocumentoInscricao } from "@prisma/client";

import { REDACAO_LIMITS, validateInscricaoForSubmission } from "./inscricao.rules.js";

const fichaBase = {
  nomeCompleto: "Carlos Silva",
  rg: "1234567",
  rgDataExpedicao: "2020-01-01",
  cpf: "12345678901",
  nacionalidade: "Brasileira",
  naturalidade: "Manaus",
  email: "candidato@teste.com",
  telefoneWhatsapp: "92999999999",
  dataNascimento: "1995-01-01",
  estadoCivil: "Solteiro",
  genero: "MASCULINO" as const,
  tipoSanguineo: "O",
  fatorRh: "+",
  racaCor: "PARDA" as const,
  pessoaComDeficiencia: false,
  concorreAcoesAfirmativas: true,
  vaiSolicitarBolsa: true,
  nomePai: "Pai da Silva",
  nomeMae: "Mae da Silva",
  enderecoResidencial: "Rua A, 100",
  cepResidencial: "69000000",
  bairroResidencial: "Coroado",
  ufResidencial: "AM",
  cidadeResidencial: "Manaus",
  empregadoSituacao: "EMPREGADO" as const,
  regimeTrabalho: "INTEGRAL" as const,
  instituicaoTrabalho: "UFAM",
  unidadeDepartamentoTrabalho: "CETELI",
  enderecoTrabalho: "Campus UFAM",
  cepTrabalho: "69080000",
  cidadeBairroTrabalho: "Manaus/Coroado",
};

const documentosBase = [
  {
    tipo: TipoDocumentoInscricao.ANEXO_IV,
    nome: "Ficha",
    nomeArquivo: "anexo-iv.pdf",
    urlArquivo: "https://arquivos.test/anexo-iv.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 100,
    statusValidacao: StatusDocumentoInscricao.ENVIADO,
  },
  {
    tipo: TipoDocumentoInscricao.ANEXO_V,
    nome: "Titulos",
    nomeArquivo: "anexo-v.pdf",
    urlArquivo: "https://arquivos.test/anexo-v.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 100,
    statusValidacao: StatusDocumentoInscricao.ENVIADO,
  },
  {
    tipo: TipoDocumentoInscricao.DIPLOMA,
    nome: "Diploma",
    nomeArquivo: "diploma.pdf",
    urlArquivo: "https://arquivos.test/diploma.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 100,
    statusValidacao: StatusDocumentoInscricao.ENVIADO,
  },
  {
    tipo: TipoDocumentoInscricao.HISTORICO,
    nome: "Historico",
    nomeArquivo: "historico.pdf",
    urlArquivo: "https://arquivos.test/historico.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 100,
    statusValidacao: StatusDocumentoInscricao.ENVIADO,
  },
  {
    tipo: TipoDocumentoInscricao.CURRICULO,
    nome: "Curriculo",
    nomeArquivo: "curriculo.pdf",
    urlArquivo: "https://arquivos.test/curriculo.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 100,
    statusValidacao: StatusDocumentoInscricao.ENVIADO,
  },
  {
    tipo: TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO,
    nome: "RG",
    nomeArquivo: "rg.pdf",
    urlArquivo: "https://arquivos.test/rg.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 100,
    statusValidacao: StatusDocumentoInscricao.ENVIADO,
  },
  {
    tipo: TipoDocumentoInscricao.ANEXO_VIII_AUTODECLARACAO,
    nome: "Autodeclaracao",
    nomeArquivo: "anexo-viii.pdf",
    urlArquivo: "https://arquivos.test/anexo-viii.pdf",
    mimeType: "application/pdf",
    tamanhoBytes: 100,
    statusValidacao: StatusDocumentoInscricao.ENVIADO,
  },
];

test("aceita inscricao completa com pagamento dispensado", () => {
  const result = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
    fichaInscricao: fichaBase,
    temaRedacao: "Controle preditivo",
    redacaoTexto: "A".repeat(REDACAO_LIMITS.min),
    documentos: documentosBase,
    pagamentoDispensado: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.redacaoCaracteres, REDACAO_LIMITS.min);
  assert.equal(
    result.checklist.some((item) => item.tipo === TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO),
    false,
  );
});

test("aceita Anexo V automatico quando titulacao estruturada esta disponivel", () => {
  const result = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
    fichaInscricao: fichaBase,
    temaRedacao: "Controle preditivo",
    redacaoTexto: "A".repeat(REDACAO_LIMITS.min),
    documentos: documentosBase.filter((documento) => documento.tipo !== TipoDocumentoInscricao.ANEXO_V),
    pagamentoDispensado: true,
    anexoVAutomaticoDisponivel: true,
  });

  const anexoVChecklist = result.checklist.find((item) => item.tipo === TipoDocumentoInscricao.ANEXO_V);

  assert.equal(result.ok, true);
  assert.equal(anexoVChecklist?.presente, true);
  assert.equal(anexoVChecklist?.documento?.urlArquivo, "AUTO:ANEXO_V");
});

test("exige comprovante de pagamento, laudo PCD e comprovante etnico quando aplicavel", () => {
  const result = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.PCD,
    fichaInscricao: {
      ...fichaBase,
      racaCor: "INDIGENA",
      pessoaComDeficiencia: true,
      concorreAcoesAfirmativas: true,
    },
    temaRedacao: "Controle robusto",
    redacaoTexto: "B".repeat(REDACAO_LIMITS.min),
    documentos: documentosBase,
    pagamentoDispensado: false,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" | "), /Comprovante de pagamento ausente/);
  assert.match(result.errors.join(" | "), /Laudo medico PCD ausente/);
  assert.match(result.errors.join(" | "), /Comprovante de povo, etnia, comunidade ou associacao ausente/);
});

test("rejeita redacao fora do intervalo previsto", () => {
  const result = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
    fichaInscricao: {
      ...fichaBase,
      concorreAcoesAfirmativas: false,
    },
    temaRedacao: "Identificacao e modelagem de processos",
    redacaoTexto: "curta demais",
    documentos: [
      ...documentosBase,
      {
        tipo: TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO,
        nome: "GRU",
        nomeArquivo: "gru.pdf",
        urlArquivo: "https://arquivos.test/gru.pdf",
        mimeType: "application/pdf",
        tamanhoBytes: 100,
        statusValidacao: StatusDocumentoInscricao.ENVIADO,
      },
    ],
    pagamentoDispensado: false,
  });

  assert.equal(result.ok, false);
  assert.match(
    result.errors.join(" | "),
    new RegExp(`redacao com tamanho entre ${REDACAO_LIMITS.min} e ${REDACAO_LIMITS.max} caracteres`),
  );
});

test("aceita simultaneamente documentos de acoes afirmativas e PCD quando ambos os campos estao marcados", () => {
  const result = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
    fichaInscricao: {
      ...fichaBase,
      pessoaComDeficiencia: true,
      concorreAcoesAfirmativas: true,
    },
    temaRedacao: "Controle robusto",
    redacaoTexto: "C".repeat(REDACAO_LIMITS.min),
    documentos: [
      ...documentosBase,
      {
        tipo: TipoDocumentoInscricao.LAUDO_PCD,
        nome: "Laudo",
        nomeArquivo: "laudo-pcd.pdf",
        urlArquivo: "https://arquivos.test/laudo-pcd.pdf",
        mimeType: "application/pdf",
        tamanhoBytes: 100,
        statusValidacao: StatusDocumentoInscricao.ENVIADO,
      },
    ],
    pagamentoDispensado: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.checklist.some((item) => item.tipo === TipoDocumentoInscricao.ANEXO_VIII_AUTODECLARACAO), true);
  assert.equal(result.checklist.some((item) => item.tipo === TipoDocumentoInscricao.LAUDO_PCD), true);
});

test("aceita submissao de doutorado com pre-projeto e sem redacao", () => {
  const result = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
    modalidadeEtapa1: ModalidadeEtapa1.PRE_PROJETO,
    fichaInscricao: fichaBase,
    temaRedacao: null,
    redacaoTexto: null,
    documentos: [
      ...documentosBase,
      {
        tipo: TipoDocumentoInscricao.PRE_PROJETO,
        nome: "Pre-projeto",
        nomeArquivo: "pre-projeto.pdf",
        urlArquivo: "https://arquivos.test/pre-projeto.pdf",
        mimeType: "application/pdf",
        tamanhoBytes: 100,
        statusValidacao: StatusDocumentoInscricao.ENVIADO,
      },
    ],
    pagamentoDispensado: true,
    exigeDiplomaGraduacao: false,
    exigeHistoricoGraduacao: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.redacaoCaracteres, 0);
  assert.equal(result.checklist.some((item) => item.tipo === TipoDocumentoInscricao.DIPLOMA), false);
  assert.equal(result.checklist.some((item) => item.tipo === TipoDocumentoInscricao.HISTORICO), false);
  assert.equal(result.checklist.some((item) => item.tipo === TipoDocumentoInscricao.PRE_PROJETO), true);
});

test("rejeita submissao de doutorado sem pre-projeto", () => {
  const result = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
    modalidadeEtapa1: ModalidadeEtapa1.PRE_PROJETO,
    fichaInscricao: fichaBase,
    temaRedacao: null,
    redacaoTexto: null,
    documentos: documentosBase,
    pagamentoDispensado: true,
    exigeDiplomaGraduacao: false,
    exigeHistoricoGraduacao: false,
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" | "), /Pre-projeto em PDF ausente/);
  assert.doesNotMatch(result.errors.join(" | "), /redacao com tamanho entre/);
  assert.doesNotMatch(result.errors.join(" | "), /tema da redacao/);
});

test("exige diploma e historico apenas quando o edital determina", () => {
  const documentosSemDiploma = documentosBase.filter(
    (documento) => documento.tipo !== TipoDocumentoInscricao.DIPLOMA && documento.tipo !== TipoDocumentoInscricao.HISTORICO,
  );

  const mestrado = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
    modalidadeEtapa1: ModalidadeEtapa1.REDACAO,
    fichaInscricao: fichaBase,
    temaRedacao: "Controle preditivo",
    redacaoTexto: "A".repeat(REDACAO_LIMITS.min),
    documentos: documentosSemDiploma,
    pagamentoDispensado: true,
  });

  const doutorado = validateInscricaoForSubmission({
    modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
    modalidadeEtapa1: ModalidadeEtapa1.REDACAO,
    fichaInscricao: fichaBase,
    temaRedacao: "Controle preditivo",
    redacaoTexto: "A".repeat(REDACAO_LIMITS.min),
    documentos: documentosSemDiploma,
    pagamentoDispensado: true,
    exigeDiplomaGraduacao: false,
    exigeHistoricoGraduacao: false,
  });

  assert.equal(mestrado.ok, false);
  assert.match(mestrado.errors.join(" | "), /Diploma de graduacao/);
  assert.match(mestrado.errors.join(" | "), /Historico escolar/);
  assert.equal(doutorado.ok, true);
});