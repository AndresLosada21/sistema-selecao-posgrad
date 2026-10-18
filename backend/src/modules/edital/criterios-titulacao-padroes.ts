export type CriterioTitulacaoPacoteCriterio = {
  chaveInterna: string;
  numeroNormativo: string;
  descricao: string;
  fator: number | null;
  teto: number | null;
  unidade: string;
  regraEspecial?: string;
  metadados?: Record<string, unknown>;
  ordem: number;
};

export type CriterioTitulacaoPacoteDefinicao = {
  slug: string;
  nome: string;
  versao: string;
  descricao?: string;
  criterios: CriterioTitulacaoPacoteCriterio[];
};

type CriterioTitulacaoPacoteResumo = Omit<CriterioTitulacaoPacoteDefinicao, "criterios"> & {
  totalCriterios: number;
  criteriosPreview: string[];
};

const PPGEE_092_2025_CRITERIOS: CriterioTitulacaoPacoteCriterio[] = [
  {
    chaveInterna: "projeto_extensao_graduacao",
    numeroNormativo: "1",
    descricao: "Projeto, aprovado institucionalmente, de extensao realizado durante a graduacao.",
    fator: 0.2,
    teto: 1,
    unidade: "projeto_concluido",
    metadados: { observacao: "0,2 ponto por projeto concluido." },
    ordem: 0,
  },
  {
    chaveInterna: "projeto_pesquisa_inovacao_graduacao",
    numeroNormativo: "2",
    descricao: "Projeto, aprovado institucionalmente, de pesquisa ou inovacao tecnologica realizado durante a graduacao.",
    fator: 0.25,
    teto: 1,
    unidade: "projeto_concluido",
    metadados: { observacao: "0,25 ponto por projeto concluido." },
    ordem: 1,
  },
  {
    chaveInterna: "monitoria_disciplina_graduacao",
    numeroNormativo: "3",
    descricao: "Monitoria, aprovada institucionalmente, de disciplina realizada durante a graduacao.",
    fator: 0.1,
    teto: 0.5,
    unidade: "monitoria_concluida",
    metadados: { observacao: "0,1 ponto por monitoria concluida." },
    ordem: 2,
  },
  {
    chaveInterna: "iniciacao_cientifica_tecnologica",
    numeroNormativo: "4",
    descricao: "Atividades, aprovadas institucionalmente, de iniciacao cientifica ou tecnologica como PIBIC ou PIBITI realizado durante a graduacao.",
    fator: 1.5,
    teto: null,
    unidade: "projeto_concluido",
    metadados: { observacao: "1,5 ponto por projeto concluido." },
    ordem: 3,
  },
  {
    chaveInterna: "artigo_congresso_nacional_primeiro_autor",
    numeroNormativo: "5",
    descricao: "Artigo completo publicado em congresso nacional de qualquer sociedade Brasileira com DOI, com comite tecnico e/ou cientifico no qual o candidato e o primeiro autor.",
    fator: 0.5,
    teto: null,
    unidade: "artigo",
    ordem: 4,
  },
  {
    chaveInterna: "artigo_congresso_internacional_primeiro_autor",
    numeroNormativo: "6",
    descricao: "Artigo completo publicado em congresso internacional com comite tecnico e/ou cientifico com DOI no qual o candidato e o primeiro autor.",
    fator: 1,
    teto: null,
    unidade: "artigo",
    ordem: 5,
  },
  {
    chaveInterna: "artigo_periodico_jcr",
    numeroNormativo: "7",
    descricao: "Artigo completo publicado em periodico com DOI.",
    fator: null,
    teto: null,
    unidade: "jcr",
    regraEspecial: "PONTUACAO_JCR",
    metadados: { regra: "Pontuacao sera o Journal Citation Report." },
    ordem: 6,
  },
  {
    chaveInterna: "artigo_periodico_sociedade_brasileira_sem_jcr",
    numeroNormativo: "8",
    descricao: "Artigo completo publicado em periodico de sociedade Brasileira sem JCR com DOI.",
    fator: 0.3,
    teto: null,
    unidade: "artigo",
    ordem: 7,
  },
  {
    chaveInterna: "docencia_superior",
    numeroNormativo: "9",
    descricao: "Docencia em nivel superior.",
    fator: 0.25,
    teto: 2.5,
    unidade: "disciplina_60h",
    metadados: { observacao: "Pontuacao individual por disciplina de no minimo 60h." },
    ordem: 8,
  },
  {
    chaveInterna: "docencia_tecnico_medio",
    numeroNormativo: "10",
    descricao: "Docencia em nivel tecnico e/ou medio.",
    fator: 0.1,
    teto: 1,
    unidade: "disciplina_60h",
    metadados: { observacao: "Pontuacao individual por disciplina de no minimo 60h." },
    ordem: 9,
  },
  {
    chaveInterna: "disciplina_ppgee_aluno_especial",
    numeroNormativo: "11",
    descricao: "Aprovacao em disciplina do PPGEE/UFAM como aluno especial.",
    fator: 1,
    teto: 4,
    unidade: "disciplina",
    metadados: { janelaSemestresLetivos: 8, observacao: "1 ponto por disciplina feita nos ultimos 08 semestres letivos." },
    ordem: 10,
  },
  {
    chaveInterna: "pibid_iniciacao_docencia",
    numeroNormativo: "13",
    descricao: "Projeto, aprovado institucionalmente, de iniciacao a docencia como PIBID realizado durante a graduacao.",
    fator: 0.1,
    teto: null,
    unidade: "projeto_concluido",
    ordem: 11,
  },
  {
    chaveInterna: "orientacao_atividades_institucionais",
    numeroNormativo: "14",
    descricao: "Orientacao em Atividades Institucionais: Iniciacao Cientifica ou tecnologica e Trabalho de Conclusao de Curso.",
    fator: 0.25,
    teto: 1,
    unidade: "orientacao",
    ordem: 12,
  },
  {
    chaveInterna: "banca_tcc",
    numeroNormativo: "15",
    descricao: "Participacao em Banca Examinadora de Trabalho de Conclusao de Curso.",
    fator: 0.1,
    teto: 1,
    unidade: "participacao",
    ordem: 13,
  },
  {
    chaveInterna: "empresa_junior",
    numeroNormativo: "16",
    descricao: "Participacao em Empresas Junior Institucionalizadas.",
    fator: 0.1,
    teto: 0.5,
    unidade: "semestre_concluido",
    ordem: 14,
  },
  {
    chaveInterna: "pet",
    numeroNormativo: "17",
    descricao: "Participacao em Projetos de Educacao Tutorial Institucionalizadas.",
    fator: 0.25,
    teto: 2,
    unidade: "semestre_concluido",
    ordem: 15,
  },
];

const PPGEE_073_2026_DOUTORADO_CRITERIOS: CriterioTitulacaoPacoteCriterio[] = [
  {
    chaveInterna: "artigo_congresso_nacional",
    numeroNormativo: "1",
    descricao: "Artigo completo publicado em congresso nacional de sociedade cientifica brasileira com DOI e comite tecnico e/ou cientifico.",
    fator: 0.5,
    teto: null,
    unidade: "artigo",
    ordem: 0,
  },
  {
    chaveInterna: "artigo_congresso_internacional",
    numeroNormativo: "2",
    descricao: "Artigo completo publicado em congresso internacional com comite tecnico e/ou cientifico e DOI.",
    fator: 0.5,
    teto: null,
    unidade: "artigo",
    ordem: 1,
  },
  {
    chaveInterna: "artigo_periodico_jcr",
    numeroNormativo: "3",
    descricao: "Artigo completo publicado em periodico com DOI.",
    fator: null,
    teto: null,
    unidade: "jcr",
    regraEspecial: "PONTUACAO_JCR",
    metadados: { regra: "Pontuacao corresponde ao Journal Citation Report." },
    ordem: 2,
  },
  {
    chaveInterna: "artigo_periodico_sociedade_brasileira_sem_jcr",
    numeroNormativo: "4",
    descricao: "Artigo completo publicado em periodico de sociedade brasileira sem JCR com DOI.",
    fator: 0.3,
    teto: null,
    unidade: "artigo",
    ordem: 3,
  },
  {
    chaveInterna: "mestrado_engenharia_eletrica",
    numeroNormativo: "5",
    descricao: "Curso de Mestrado Stricto Sensu em Engenharia Eletrica.",
    fator: 1,
    teto: null,
    unidade: "titulo",
    ordem: 4,
  },
  {
    chaveInterna: "mestrado_area_afim",
    numeroNormativo: "6",
    descricao: "Curso de Mestrado Stricto Sensu em area afim.",
    fator: 0.5,
    teto: null,
    unidade: "titulo",
    ordem: 5,
  },
  {
    chaveInterna: "patente_engenharia_eletrica",
    numeroNormativo: "7",
    descricao: "Patente concedida na area de Engenharia Eletrica.",
    fator: 1,
    teto: 5,
    unidade: "patente",
    ordem: 6,
  },
  {
    chaveInterna: "livro_engenharia_eletrica",
    numeroNormativo: "8",
    descricao: "Livro na area de Engenharia Eletrica.",
    fator: 0.5,
    teto: null,
    unidade: "livro",
    ordem: 7,
  },
];

export const CRITERIO_TITULACAO_PACOTES = [
  {
    slug: "ppgee-092-2025-anexo-ii",
    nome: "Anexo II - Edital PPGEE 092/2025",
    versao: "2025.092",
    descricao: "Criterios oficiais de analise curricular do Anexo II do Edital 092/2025-PROPESP/UFAM-PPGEE-M-2026/1.",
    criterios: PPGEE_092_2025_CRITERIOS,
  },
  {
    slug: "ppgee-073-2026-anexo-ii-doutorado",
    nome: "Anexo II - Edital PPGEE 073/2026 (doutorado)",
    versao: "2026.073",
    descricao: "Criterios oficiais de analise curricular do Anexo II do Edital 073/2026-PROPESP/UFAM-PPGEE-D-2027/1.",
    criterios: PPGEE_073_2026_DOUTORADO_CRITERIOS,
  },
] as const satisfies readonly CriterioTitulacaoPacoteDefinicao[];

export function listCriterioTitulacaoPacoteSummaries(): CriterioTitulacaoPacoteResumo[] {
  return CRITERIO_TITULACAO_PACOTES.map((pacote) => ({
    slug: pacote.slug,
    nome: pacote.nome,
    versao: pacote.versao,
    descricao: pacote.descricao,
    totalCriterios: pacote.criterios.length,
    criteriosPreview: pacote.criterios.slice(0, 6).map((criterio) => `${criterio.numeroNormativo} - ${criterio.descricao}`),
  }));
}

export function getCriterioTitulacaoPacoteBySlug(slug: string) {
  return CRITERIO_TITULACAO_PACOTES.find((pacote) => pacote.slug === slug) ?? null;
}
