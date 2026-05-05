export type TemaRedacaoPacoteTema = {
  titulo: string;
  descricao?: string;
  ordem: number;
};

export type TemaRedacaoPacoteDefinicao = {
  slug: string;
  nome: string;
  versao: string;
  descricao?: string;
  temas: TemaRedacaoPacoteTema[];
};

type TemaRedacaoPacoteResumo = Omit<TemaRedacaoPacoteDefinicao, "temas"> & {
  totalTemas: number;
  temasPreview: string[];
};

const PPGEE_V1_TEMAS = [
  "Modelagem e verificacao automatica de sistemas ciber-fisicos com enfase em sistemas da area de energia eletrica e co-projeto hardware-software",
  "Modelagem e sintese de sistemas ciber-fisicos com enfase em sistemas da area de energia eletrica",
  "Otimizacao de sistemas por meio de tecnicas de verificacao formal e sintese com uso de computacao paralela e concorrente",
  "Fontes renovaveis de energia",
  "Circuitos integrados analogicos e digitais",
  "Aplicacoes em blockchain (TimeChain)",
  "Sistemas de sensores (imagem, eletroquimicos, magneticos etc.)",
  "Criptografia aplicada",
  "Estudos de arquiteturas blockchain EVM, BVM e SVM",
  "Otimizacao de interfaces eletronicas para sensores",
  "Internet das coisas",
  "Redes 5G",
  "Redes de sensores sem fio",
  "Redes tolerantes a atrasos e desconexoes",
  "Redes de satelites",
  "Sistemas RFID",
  "Sistemas embarcados para comunicacao sem fio",
  "Processamento digital de imagens",
  "Visao computacional",
  "Reconhecimento de padroes",
  "Diagnostico por imagem",
  "Sensoriamento remoto",
  "Otimizacao de processos",
  "Monitorizacao das atividades humanas",
  "Aprendizado profundo (deep learning)",
  "Engenharia biomedica e engenharia clinica",
  "Processamento digital de sinais (PDS)",
  "Compressao de sinais",
  "Processamento de sinais biomedicos",
  "Codificacao de canal",
  "Correlacao de ruido em matriz de pixels com tecnologia CMOS",
  "Analise do espectro de ruido em matriz de pixels com tecnologia CMOS em regime linear e lin-log sob temperaturas criogenicas",
  "Quantificacao de emaranhamento quantico em microcavidades semicondutoras",
  "Estudo de squeezing de polaritons em microcavidades semicondutoras",
  "Estudo de eletrodinamica quantica de cavidades semicondutoras aplicadas em microcavidades",
  "Caracterizacao e construcao de um transistor puramente optico usando microcavidades semicondutoras",
  "Circuitos e sistemas integrados analogicos e de RF",
  "Optoeletronica",
  "Sensores a fibra optica",
  "MEMS",
  "Microfabricacao",
  "Dinamica e controle de sistemas eletricos de potencia",
  "Controle a incertezas parametricas",
  "Controle de ordem fracionaria",
  "Estudo de conversores e aplicacoes de microrredes",
  "Sistemas industriais",
  "Robotica industrial",
  "Sistemas de controle: controle otimo e nao-linear, controle em rede, teoria da dissipatividade, controle baseado em dados e por aprendizado, aplicacoes a robotica e sistemas de energia",
  "Sistemas ciberfisicos e embarcados: modelagem, analise, controle e verificacao",
  "Supervisao e seguranca de sistemas: deteccao e diagnostico de falhas, deteccao de anomalias, deteccao e mitigacao de ataques ciberneticos, controle tolerante a falhas e controle ciberseguro",
  "Prognostico e gerenciamento de saude: manutencao preditiva e prescritiva, predicao de vida util, modelagem de degradacao e controle health-aware",
  "Inteligencia computacional: modelagem fuzzy, raciocinio automatizado, computacao granular, seguranca e confiabilidade de redes neurais, IA explicavel e aplicacoes de IA em controle, deteccao de eventos e series temporais",
  "Controle de processos",
  "Controle preditivo",
  "Controle robusto",
  "Controle baseado em dados",
  "Identificacao e modelagem de processos",
  "Aplicacao de controle inteligente e supervisorios",
  "Tecnicas de controle avancado",
  "Modelagem de sistemas a eventos discretos (redes de Petri) em automacao industrial e micro-redes eletricas",
  "Controle de balanceamento de fases em redes eletricas inteligentes",
  "Aplicacoes de controle inteligente em micro-redes e processos industriais",
  "Desenvolvimento de sistemas de automacao industrial inteligentes e IoT",
  "Aplicacoes de inteligencia artificial em controle e automacao de sistemas: micro-redes eletricas, automacao industrial e telemedicina",
  "Transicao energetica: planejamento energetico, mercados de energia, geracao, operacao, comercializacao, riscos e servicos ancilares",
  "Gerenciamento energetico de microrredes: condicao isolada e hibrida, coordenacao hidro-termo-solar-eolica, armazenamento de energia e H2",
  "Metodos computacionais de otimizacao aplicados a problemas do setor de energia e industrial",
  "Inteligencia artificial e automacao aplicada a industria: otimizacao de processos produtivos, inspecao automatica e melhoria de KPIs",
  "Matematica aplicada a problemas industriais: programacao linear, inteira-mista, nao-linear e estocastica",
  "Aplicacoes de big data e data science no setor industrial",
  "Verificacao de software e model checking",
  "Testes automatizados e sintese de programas",
  "Seguranca de software",
  "Sistemas embarcados e sistemas ciberfisicos (CPS)",
  "Metodos formais em IA, redes neurais e sistemas confiaveis",
  "Construcao de sistemas de software e IA confiaveis por meio de verificacao e validacao",
  "Desenvolvimento de ferramentas, competicoes e benchmarks para verificacao e testes de software",
  "Aplicacoes interdisciplinares de metodos formais em firmware, hardware, dispositivos embarcados e mercados locais de energia",
  "Redes eletricas inteligentes e legadas, geracao distribuida, armazenamento de energia e mobilidade eletrica",
  "Solucoes baseadas em IA, aprendizado de maquina, sistemas multiagentes e LLMs aplicadas a automacao de processos e sistemas eletricos",
  "Aplicacoes de visao computacional, IA explicavel e outras tecnicas de IA no apoio a automacao, operacao, supervisao e tomada de decisao em sistemas de energia eletrica",
  "Avaliacao probabilistica dos impactos tecnicos e economicos da operacao de sistemas de energia eletrica",
  "Alocacao otima, dimensionamento, coordenacao e controle de microrredes e sistemas de distribuicao",
  "Protecao e controle de sistemas eletricos de potencia (SEP)",
  "Transmissao, distribuicao e consumo de energia",
  "Analise de transitorios eletromagneticos em SEP",
  "Simulacao digital de SEP (OPAL-RT, RTDS, ATP e PSCAD)",
  "Eficiencia energetica e gerenciamento de energia eletrica",
  "Controle e automacao de sistemas",
  "Automacao industrial e Industria 4.0",
  "Desenvolvimento de solucoes e aplicacoes industriais",
  "Sistemas ciber-fisicos e digital twin",
  "Agentes inteligentes e inteligencia artificial distribuida",
  "Automacao e debugging de sistemas de inteligencia artificial",
  "Inteligencia artificial para Industria 4.0",
  "Explicabilidade e IA responsavel",
  "Gerenciamento de dados para inteligencia artificial: pre-processamento, aumento de dados, dados sinteticos, proveniencia e explicacoes",
  "Projeto de controle robusto",
  "Sistemas de automacao industrial e aplicacoes de sistemas ciber-fisicos",
  "Aplicacoes de micro-redes de energia, controle e supervisao",
  "Representacoes nao-lineares: modelagem fuzzy e representacao algebrico-diferencial",
  "Sistemas de controle nao-lineares, robustos, baseados em dados e baseados em eventos",
  "Otimizacao aplicada a sistemas de controle",
  "Controle de sistemas de grande escala",
  "Estimacao distribuida",
  "Sistemas multi-agentes",
  "Planejamento de trajetoria e controle de movimento para veiculos autonomos",
  "Localizacao e mapeamento (SLAM) baseado em visao e LiDAR",
  "Controle servo-visual",
  "Sistemas embarcados",
  "Novas aplicacoes para a industria (Industria 4.0, Industrial IoT e gemeos digitais)",
  "Novas abordagens de ensino de engenharia e computacao",
  "Aplicacoes eletronicas para bem-estar, saude e tecnologias assistivas (eHealth systems)",
  "Ambientes inteligentes e solucoes de inteligencia artificial para uso domestico e industrial (Society 5.0)",
  "Reconhecimento e deteccao aplicados a PDS",
  "Visao computacional aplicada a PDS",
  "Seguranca e estabilidade de sistemas de potencia",
  "Inteligencia artificial e mineracao de dados em engenharia",
  "Redes de distribuicao ativas e smart grids",
  "Avaliacao do impacto das fontes conectadas por inversores",
  "Eficiencia e gestao energetica",
  "Tecnologias sociais em energia",
  "Inovacao frugal e gestao da inovacao",
] as const;

export function normalizeTemaRedacaoKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildPacote(input: Omit<TemaRedacaoPacoteDefinicao, "temas"> & { temas: readonly string[] }) {
  const seen = new Set<string>();
  const temas: TemaRedacaoPacoteTema[] = [];

  for (const titulo of input.temas) {
    const normalizedTitle = titulo.replace(/\s+/g, " ").trim();

    if (!normalizedTitle) {
      continue;
    }

    const key = normalizeTemaRedacaoKey(normalizedTitle);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    temas.push({
      titulo: normalizedTitle,
      ordem: temas.length,
    });
  }

  return {
    slug: input.slug,
    nome: input.nome,
    versao: input.versao,
    descricao: input.descricao,
    temas,
  } satisfies TemaRedacaoPacoteDefinicao;
}

export const TEMA_REDACAO_PACOTES = [
  buildPacote({
    slug: "ppgee-v1",
    nome: "Pacote padrao PPGEE",
    versao: "2026.05",
    descricao: "Colecao fixa de temas tecnicos para redacao, com possibilidade de complementacao manual e inativacao individual no edital.",
    temas: PPGEE_V1_TEMAS,
  }),
] as const satisfies readonly TemaRedacaoPacoteDefinicao[];

export function listTemaRedacaoPacoteSummaries(): TemaRedacaoPacoteResumo[] {
  return TEMA_REDACAO_PACOTES.map((pacote) => ({
    slug: pacote.slug,
    nome: pacote.nome,
    versao: pacote.versao,
    descricao: pacote.descricao,
    totalTemas: pacote.temas.length,
    temasPreview: pacote.temas.slice(0, 8).map((tema) => tema.titulo),
  }));
}

export function getTemaRedacaoPacoteBySlug(slug: string) {
  return TEMA_REDACAO_PACOTES.find((pacote) => pacote.slug === slug) ?? null;
}
