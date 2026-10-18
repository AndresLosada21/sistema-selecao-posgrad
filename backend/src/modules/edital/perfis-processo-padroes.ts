import { CursoNivel, DesempateClassificacao, ModalidadeEtapa1 } from "@prisma/client";

export type CriterioEtapa1Pacote = {
  chaveInterna: string;
  label: string;
  peso: number;
  notaMaxima: number;
  ordem: number;
  ativo?: boolean;
};

export type PerfilProcessoPacoteDefinicao = {
  slug: string;
  nome: string;
  versao: string;
  cursoNivel: CursoNivel;
  descricao: string;
  modalidadeEtapa1: ModalidadeEtapa1;
  avaliadoresEtapa1: number;
  pesoEtapa1: number;
  pesoEtapa2: number;
  notaMinimaEtapa1: number;
  desempate: DesempateClassificacao;
  exigeDiplomaGraduacao: boolean;
  exigeHistoricoGraduacao: boolean;
  exigeGrupoPesquisa: boolean;
  permiteCancelarSubmissao: boolean;
  criterios: CriterioEtapa1Pacote[];
};

export type PerfilProcessoPacoteResumo = Omit<PerfilProcessoPacoteDefinicao, "criterios"> & {
  totalCriterios: number;
  criteriosPreview: string[];
};

const CRITERIOS_REDACAO: CriterioEtapa1Pacote[] = [
  { chaveInterna: "adequacaoDominioTema", label: "Adequação e domínio do tema", peso: 50, notaMaxima: 10, ordem: 0 },
  { chaveInterna: "estrutura", label: "Estrutura", peso: 10, notaMaxima: 10, ordem: 1 },
  { chaveInterna: "organizacaoCoerencia", label: "Organização textual e coerência", peso: 15, notaMaxima: 10, ordem: 2 },
  { chaveInterna: "objetividadeSintese", label: "Objetividade e capacidade de síntese", peso: 15, notaMaxima: 10, ordem: 3 },
  { chaveInterna: "grafiaGramatica", label: "Grafia, acentuação e gramática", peso: 10, notaMaxima: 10, ordem: 4 },
];

const CRITERIOS_PRE_PROJETO: CriterioEtapa1Pacote[] = [
  { chaveInterna: "clareza", label: "Clareza", peso: 20, notaMaxima: 10, ordem: 0 },
  { chaveInterna: "objetividade", label: "Objetividade", peso: 20, notaMaxima: 10, ordem: 1 },
  { chaveInterna: "coerencia", label: "Coerência", peso: 20, notaMaxima: 10, ordem: 2 },
  { chaveInterna: "relevancia", label: "Relevância", peso: 30, notaMaxima: 10, ordem: 3 },
  { chaveInterna: "referencias", label: "Referências", peso: 10, notaMaxima: 10, ordem: 4 },
];

export const PERFIL_PROCESSO_PACOTES = [
  {
    slug: "ppgee-092-2025-mestrado",
    nome: "Perfil de processo - Edital PPGEE 092/2025 (mestrado)",
    versao: "2025.092",
    cursoNivel: CursoNivel.MESTRADO,
    descricao: "Redacao avaliada por um corretor, peso maior na etapa 2 e desempate por etapa 1, etapa 2 e idade.",
    modalidadeEtapa1: ModalidadeEtapa1.REDACAO,
    avaliadoresEtapa1: 1,
    pesoEtapa1: 1,
    pesoEtapa2: 2,
    notaMinimaEtapa1: 7,
    desempate: DesempateClassificacao.ETAPA1_ETAPA2_IDADE,
    exigeDiplomaGraduacao: true,
    exigeHistoricoGraduacao: true,
    exigeGrupoPesquisa: false,
    permiteCancelarSubmissao: true,
    criterios: CRITERIOS_REDACAO,
  },
  {
    slug: "ppgee-073-2026-doutorado",
    nome: "Perfil de processo - Edital PPGEE 073/2026 (doutorado)",
    versao: "2026.073",
    cursoNivel: CursoNivel.DOUTORADO,
    descricao: "Pre-projeto avaliado por banca de dois avaliadores, peso maior na etapa 1 e desempate por etapa 1 e idade.",
    modalidadeEtapa1: ModalidadeEtapa1.PRE_PROJETO,
    avaliadoresEtapa1: 2,
    pesoEtapa1: 2,
    pesoEtapa2: 1,
    notaMinimaEtapa1: 7,
    desempate: DesempateClassificacao.ETAPA1_IDADE,
    exigeDiplomaGraduacao: false,
    exigeHistoricoGraduacao: false,
    exigeGrupoPesquisa: true,
    permiteCancelarSubmissao: false,
    criterios: CRITERIOS_PRE_PROJETO,
  },
] as const satisfies readonly PerfilProcessoPacoteDefinicao[];

export function listPerfilProcessoPacoteSummaries(): PerfilProcessoPacoteResumo[] {
  return PERFIL_PROCESSO_PACOTES.map((pacote) => ({
    slug: pacote.slug,
    nome: pacote.nome,
    versao: pacote.versao,
    cursoNivel: pacote.cursoNivel,
    descricao: pacote.descricao,
    modalidadeEtapa1: pacote.modalidadeEtapa1,
    avaliadoresEtapa1: pacote.avaliadoresEtapa1,
    pesoEtapa1: pacote.pesoEtapa1,
    pesoEtapa2: pacote.pesoEtapa2,
    notaMinimaEtapa1: pacote.notaMinimaEtapa1,
    desempate: pacote.desempate,
    exigeDiplomaGraduacao: pacote.exigeDiplomaGraduacao,
    exigeHistoricoGraduacao: pacote.exigeHistoricoGraduacao,
    exigeGrupoPesquisa: pacote.exigeGrupoPesquisa,
    permiteCancelarSubmissao: pacote.permiteCancelarSubmissao,
    totalCriterios: pacote.criterios.length,
    criteriosPreview: pacote.criterios.map((criterio) => `${criterio.label} (${criterio.peso}%)`),
  }));
}

export function getPerfilProcessoPacoteBySlug(slug: string): PerfilProcessoPacoteDefinicao | null {
  return PERFIL_PROCESSO_PACOTES.find((pacote) => pacote.slug === slug) ?? null;
}

export function somaPesosCriteriosAtivos(criterios: CriterioEtapa1Pacote[]) {
  return criterios.reduce((total, criterio) => total + criterio.peso, 0);
}

