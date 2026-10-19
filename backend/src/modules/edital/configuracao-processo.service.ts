import {
  DesempateClassificacao,
  ModalidadeEtapa1,
  type Prisma,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { conflict, notFound } from "../../lib/http-errors.js";
import {
  getPerfilProcessoPacoteBySlug,
  listPerfilProcessoPacoteSummaries,
  somaPesosCriteriosAtivos,
  type CriterioEtapa1Pacote,
  type PerfilProcessoPacoteDefinicao,
} from "./perfis-processo-padroes.js";

export const CONFIGURACAO_PROCESSO_PADRAO = {
  modalidadeEtapa1: ModalidadeEtapa1.REDACAO,
  pesoEtapa1: 1,
  pesoEtapa2: 2,
  notaMinimaEtapa1: 7,
  desempate: DesempateClassificacao.ETAPA1_ETAPA2_IDADE,
  avaliadoresEtapa1: 1,
  exigeDiplomaGraduacao: true,
  exigeHistoricoGraduacao: true,
  exigeGrupoPesquisa: false,
  permiteCancelarSubmissao: true,
  unificarReservasAcoesAfirmativasPcd: false,
} as const;

export type ConfiguracaoProcessoResumo = {
  editalId: string;
  modalidadeEtapa1: ModalidadeEtapa1;
  pesoEtapa1: number;
  pesoEtapa2: number;
  notaMinimaEtapa1: number;
  desempate: DesempateClassificacao;
  avaliadoresEtapa1: number;
  exigeDiplomaGraduacao: boolean;
  exigeHistoricoGraduacao: boolean;
  exigeGrupoPesquisa: boolean;
  permiteCancelarSubmissao: boolean;
  unificarReservasAcoesAfirmativasPcd: boolean;
  configurada: boolean;
};

export type CriterioEtapa1Resumo = {
  id: string | null;
  chaveInterna: string;
  label: string;
  peso: number;
  notaMaxima: number;
  ordem: number;
  ativo: boolean;
};

export type ConfiguracaoProcessoComCriterios = ConfiguracaoProcessoResumo & {
  criterios: CriterioEtapa1Resumo[];
};

export type UpsertConfiguracaoProcessoInput = {
  modalidadeEtapa1: ModalidadeEtapa1;
  pesoEtapa1: number;
  pesoEtapa2: number;
  notaMinimaEtapa1: number;
  desempate: DesempateClassificacao;
  avaliadoresEtapa1: number;
  exigeDiplomaGraduacao: boolean;
  exigeHistoricoGraduacao: boolean;
  exigeGrupoPesquisa: boolean;
  permiteCancelarSubmissao: boolean;
  unificarReservasAcoesAfirmativasPcd: boolean;
};

export type UpsertCriterioEtapa1Input = {
  chaveInterna: string;
  label: string;
  peso: number;
  notaMaxima: number;
  ordem?: number;
  ativo?: boolean;
};

export type GrupoPesquisaResumo = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export type UpsertGrupoPesquisaInput = {
  nome: string;
  descricao?: string;
  ativo?: boolean;
};

type ConfiguracaoProcessoRow = {
  editalId: string;
  modalidadeEtapa1: ModalidadeEtapa1;
  pesoEtapa1: number;
  pesoEtapa2: number;
  notaMinimaEtapa1: Prisma.Decimal;
  desempate: DesempateClassificacao;
  avaliadoresEtapa1: number;
  exigeDiplomaGraduacao: boolean;
  exigeHistoricoGraduacao: boolean;
  exigeGrupoPesquisa: boolean;
  permiteCancelarSubmissao: boolean;
  unificarReservasAcoesAfirmativasPcd: boolean;
};

type CriterioEtapa1Row = {
  id: string;
  chaveInterna: string;
  label: string;
  peso: number;
  notaMaxima: Prisma.Decimal;
  ordem: number;
  ativo: boolean;
};

export function resolveConfiguracaoProcesso(row: ConfiguracaoProcessoRow | null): ConfiguracaoProcessoResumo {
  if (!row) {
    return { editalId: "", ...CONFIGURACAO_PROCESSO_PADRAO, configurada: false };
  }

  return {
    editalId: row.editalId,
    modalidadeEtapa1: row.modalidadeEtapa1,
    pesoEtapa1: row.pesoEtapa1,
    pesoEtapa2: row.pesoEtapa2,
    notaMinimaEtapa1: row.notaMinimaEtapa1.toNumber(),
    desempate: row.desempate,
    avaliadoresEtapa1: row.avaliadoresEtapa1,
    exigeDiplomaGraduacao: row.exigeDiplomaGraduacao,
    exigeHistoricoGraduacao: row.exigeHistoricoGraduacao,
    exigeGrupoPesquisa: row.exigeGrupoPesquisa,
    permiteCancelarSubmissao: row.permiteCancelarSubmissao,
    unificarReservasAcoesAfirmativasPcd: row.unificarReservasAcoesAfirmativasPcd,
    configurada: true,
  };
}

export function mapCriterioEtapa1(criterio: CriterioEtapa1Row): CriterioEtapa1Resumo {
  return {
    id: criterio.id,
    chaveInterna: criterio.chaveInterna,
    label: criterio.label,
    peso: criterio.peso,
    notaMaxima: criterio.notaMaxima.toNumber(),
    ordem: criterio.ordem,
    ativo: criterio.ativo,
  };
}

function configuracaoPadraoDoEdital(editalId: string): ConfiguracaoProcessoResumo {
  return { editalId, ...CONFIGURACAO_PROCESSO_PADRAO, configurada: false };
}

async function assertEditalExiste(editalId: string) {
  const edital = await prisma.edital.findUnique({ where: { id: editalId }, select: { id: true } });

  if (!edital) {
    throw notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO");
  }
}

export function validateConfiguracaoProcessoInput(input: UpsertConfiguracaoProcessoInput) {
  if (input.pesoEtapa1 < 1 || input.pesoEtapa2 < 1) {
    throw conflict("Os pesos das etapas devem ser no minimo 1.", "CONFIGURACAO_PESOS_INVALIDOS");
  }

  if (input.notaMinimaEtapa1 < 0 || input.notaMinimaEtapa1 > 10) {
    throw conflict("A nota minima da etapa 1 deve estar entre 0 e 10.", "CONFIGURACAO_NOTA_MINIMA_INVALIDA");
  }

  if (input.avaliadoresEtapa1 < 1 || input.avaliadoresEtapa1 > 10) {
    throw conflict("A quantidade de avaliadores da etapa 1 deve estar entre 1 e 10.", "CONFIGURACAO_AVALIADORES_INVALIDA");
  }
}

export function validateRubricaEtapa1(criterios: CriterioEtapa1Pacote[]) {
  const ativos = criterios.filter((criterio) => criterio.ativo !== false);

  if (ativos.length === 0) {
    throw conflict("O edital precisa de ao menos um criterio ativo na etapa 1.", "RUBRICA_ETAPA_1_VAZIA");
  }

  const soma = somaPesosCriteriosAtivos(ativos);

  if (soma !== 100) {
    throw conflict(
      `A soma dos pesos dos criterios ativos da etapa 1 deve ser 100%. Valor atual: ${soma}%.`,
      "RUBRICA_ETAPA_1_PESOS_INVALIDOS",
    );
  }

  const chaves = new Set<string>();

  for (const criterio of ativos) {
    if (criterio.peso <= 0) {
      throw conflict(`O criterio ${criterio.chaveInterna} deve ter peso positivo.`, "RUBRICA_ETAPA_1_PESO_INVALIDO");
    }

    if (criterio.notaMaxima <= 0) {
      throw conflict(`O criterio ${criterio.chaveInterna} deve ter nota maxima positiva.`, "RUBRICA_ETAPA_1_NOTA_MAXIMA_INVALIDA");
    }

    if (chaves.has(criterio.chaveInterna)) {
      throw conflict(`O criterio ${criterio.chaveInterna} esta duplicado.`, "RUBRICA_ETAPA_1_CRITERIO_DUPLICADO");
    }

    chaves.add(criterio.chaveInterna);
  }
}

export async function getConfiguracaoProcesso(editalId: string): Promise<ConfiguracaoProcessoResumo> {
  const configuracao = await prisma.configuracaoProcessoEdital.findUnique({ where: { editalId } });

  return configuracao ? resolveConfiguracaoProcesso(configuracao) : configuracaoPadraoDoEdital(editalId);
}

export async function getConfiguracaoProcessoComCriterios(editalId: string): Promise<ConfiguracaoProcessoComCriterios> {
  const [configuracao, criterios] = await Promise.all([
    getConfiguracaoProcesso(editalId),
    prisma.criterioAvaliacaoEtapa1Edital.findMany({
      where: { editalId, ativo: true },
      orderBy: [{ ordem: "asc" }, { chaveInterna: "asc" }],
    }),
  ]);

  return { ...configuracao, criterios: criterios.map(mapCriterioEtapa1) };
}

export async function listCriteriosEtapa1(editalId: string): Promise<CriterioEtapa1Resumo[]> {
  await assertEditalExiste(editalId);
  const criterios = await prisma.criterioAvaliacaoEtapa1Edital.findMany({
    where: { editalId },
    orderBy: [{ ordem: "asc" }, { chaveInterna: "asc" }],
  });

  return criterios.map(mapCriterioEtapa1);
}

export async function upsertConfiguracaoProcesso(
  editalId: string,
  input: UpsertConfiguracaoProcessoInput,
): Promise<ConfiguracaoProcessoResumo> {
  await assertEditalExiste(editalId);
  validateConfiguracaoProcessoInput(input);

  const data = {
    modalidadeEtapa1: input.modalidadeEtapa1,
    pesoEtapa1: input.pesoEtapa1,
    pesoEtapa2: input.pesoEtapa2,
    notaMinimaEtapa1: input.notaMinimaEtapa1,
    desempate: input.desempate,
    avaliadoresEtapa1: input.avaliadoresEtapa1,
    exigeDiplomaGraduacao: input.exigeDiplomaGraduacao,
    exigeHistoricoGraduacao: input.exigeHistoricoGraduacao,
    exigeGrupoPesquisa: input.exigeGrupoPesquisa,
    permiteCancelarSubmissao: input.permiteCancelarSubmissao,
    unificarReservasAcoesAfirmativasPcd: input.unificarReservasAcoesAfirmativasPcd,
  };

  const configuracao = await prisma.configuracaoProcessoEdital.upsert({
    where: { editalId },
    update: data,
    create: { editalId, ...data },
  });

  return resolveConfiguracaoProcesso(configuracao);
}

export async function upsertCriterioEtapa1(
  editalId: string,
  input: UpsertCriterioEtapa1Input,
): Promise<CriterioEtapa1Resumo> {
  await assertEditalExiste(editalId);

  const existentes = await prisma.criterioAvaliacaoEtapa1Edital.findMany({ where: { editalId } });
  const ativos = existentes
    .filter((criterio) => criterio.chaveInterna !== input.chaveInterna && criterio.ativo)
    .map((criterio) => ({
      chaveInterna: criterio.chaveInterna,
      label: criterio.label,
      peso: criterio.peso,
      notaMaxima: criterio.notaMaxima.toNumber(),
      ordem: criterio.ordem,
    }));

  if (input.ativo !== false) {
    validateRubricaEtapa1([
      ...ativos,
      {
        chaveInterna: input.chaveInterna,
        label: input.label,
        peso: input.peso,
        notaMaxima: input.notaMaxima,
        ordem: input.ordem ?? 0,
        ativo: true,
      },
    ]);
  }

  const resultado = await prisma.criterioAvaliacaoEtapa1Edital.upsert({
    where: { editalId_chaveInterna: { editalId, chaveInterna: input.chaveInterna } },
    update: {
      label: input.label,
      peso: input.peso,
      notaMaxima: input.notaMaxima,
      ordem: input.ordem ?? 0,
      ativo: input.ativo ?? true,
    },
    create: {
      editalId,
      chaveInterna: input.chaveInterna,
      label: input.label,
      peso: input.peso,
      notaMaxima: input.notaMaxima,
      ordem: input.ordem ?? 0,
      ativo: input.ativo ?? true,
    },
  });

  return mapCriterioEtapa1(resultado);
}

export async function deleteCriterioEtapa1(editalId: string, criterioId: string) {
  const criterio = await prisma.criterioAvaliacaoEtapa1Edital.findUnique({ where: { id: criterioId } });

  if (!criterio || criterio.editalId !== editalId) {
    throw notFound("Criterio da etapa 1 nao encontrado.", "CRITERIO_ETAPA_1_NAO_ENCONTRADO");
  }

  await prisma.criterioAvaliacaoEtapa1Edital.delete({ where: { id: criterioId } });
}

export async function listPerfilProcessoPacotes() {
  const items = listPerfilProcessoPacoteSummaries();

  return { items, total: items.length };
}

async function applyPerfilProcessoPacoteInTransaction(
  tx: Prisma.TransactionClient,
  editalId: string,
  pacote: PerfilProcessoPacoteDefinicao,
) {
  validateRubricaEtapa1(pacote.criterios);

  await tx.configuracaoProcessoEdital.upsert({
    where: { editalId },
    update: {
      modalidadeEtapa1: pacote.modalidadeEtapa1,
      pesoEtapa1: pacote.pesoEtapa1,
      pesoEtapa2: pacote.pesoEtapa2,
      notaMinimaEtapa1: pacote.notaMinimaEtapa1,
      desempate: pacote.desempate,
      avaliadoresEtapa1: pacote.avaliadoresEtapa1,
      exigeDiplomaGraduacao: pacote.exigeDiplomaGraduacao,
      exigeHistoricoGraduacao: pacote.exigeHistoricoGraduacao,
      exigeGrupoPesquisa: pacote.exigeGrupoPesquisa,
      permiteCancelarSubmissao: pacote.permiteCancelarSubmissao,
      unificarReservasAcoesAfirmativasPcd: pacote.unificarReservasAcoesAfirmativasPcd,
    },
    create: {
      editalId,
      modalidadeEtapa1: pacote.modalidadeEtapa1,
      pesoEtapa1: pacote.pesoEtapa1,
      pesoEtapa2: pacote.pesoEtapa2,
      notaMinimaEtapa1: pacote.notaMinimaEtapa1,
      desempate: pacote.desempate,
      avaliadoresEtapa1: pacote.avaliadoresEtapa1,
      exigeDiplomaGraduacao: pacote.exigeDiplomaGraduacao,
      exigeHistoricoGraduacao: pacote.exigeHistoricoGraduacao,
      exigeGrupoPesquisa: pacote.exigeGrupoPesquisa,
      permiteCancelarSubmissao: pacote.permiteCancelarSubmissao,
      unificarReservasAcoesAfirmativasPcd: pacote.unificarReservasAcoesAfirmativasPcd,
    },
  });

  const chavesPacote = new Set(pacote.criterios.map((criterio) => criterio.chaveInterna));

  await tx.criterioAvaliacaoEtapa1Edital.updateMany({
    where: { editalId, chaveInterna: { notIn: [...chavesPacote] }, ativo: true },
    data: { ativo: false },
  });

  for (const criterio of pacote.criterios) {
    await tx.criterioAvaliacaoEtapa1Edital.upsert({
      where: { editalId_chaveInterna: { editalId, chaveInterna: criterio.chaveInterna } },
      update: {
        label: criterio.label,
        peso: criterio.peso,
        notaMaxima: criterio.notaMaxima,
        ordem: criterio.ordem,
        ativo: true,
      },
      create: {
        editalId,
        chaveInterna: criterio.chaveInterna,
        label: criterio.label,
        peso: criterio.peso,
        notaMaxima: criterio.notaMaxima,
        ordem: criterio.ordem,
        ativo: true,
      },
    });
  }

  return await (async () => {
    const configuracao = await tx.configuracaoProcessoEdital.findUniqueOrThrow({ where: { editalId } });
    const criteriosAtivos = await tx.criterioAvaliacaoEtapa1Edital.findMany({
      where: { editalId, ativo: true },
      orderBy: [{ ordem: "asc" }, { chaveInterna: "asc" }],
    });

    return {
      ...resolveConfiguracaoProcesso(configuracao),
      criterios: criteriosAtivos.map(mapCriterioEtapa1),
    } satisfies ConfiguracaoProcessoComCriterios;
  })();
}

export async function applyPerfilProcessoPacote(editalId: string, slug: string) {
  await assertEditalExiste(editalId);

  const pacote = getPerfilProcessoPacoteBySlug(slug);

  if (!pacote) {
    throw notFound("Pacote de perfil de processo nao encontrado.", "PERFIL_PROCESSO_PACOTE_NAO_ENCONTRADO");
  }

  return await prisma.$transaction(async (tx) => applyPerfilProcessoPacoteInTransaction(tx, editalId, pacote));
}

export async function assertConfiguracaoCompletaParaPublicacao(editalId: string) {
  const configuracao = await prisma.configuracaoProcessoEdital.findUnique({ where: { editalId } });
  const criterios = await prisma.criterioAvaliacaoEtapa1Edital.findMany({
    where: { editalId, ativo: true },
    select: { chaveInterna: true, label: true, peso: true, notaMaxima: true, ordem: true },
  });

  if (!configuracao) {
    throw conflict(
      "Nao e permitido publicar edital sem configuracao de processo (modalidade da etapa 1, pesos, nota minima e desempate).",
      "EDITAL_SEM_CONFIGURACAO_PROCESSO",
    );
  }

  validateConfiguracaoProcessoInput({
    modalidadeEtapa1: configuracao.modalidadeEtapa1,
    pesoEtapa1: configuracao.pesoEtapa1,
    pesoEtapa2: configuracao.pesoEtapa2,
    notaMinimaEtapa1: configuracao.notaMinimaEtapa1.toNumber(),
    desempate: configuracao.desempate,
    avaliadoresEtapa1: configuracao.avaliadoresEtapa1,
    exigeDiplomaGraduacao: configuracao.exigeDiplomaGraduacao,
    exigeHistoricoGraduacao: configuracao.exigeHistoricoGraduacao,
    exigeGrupoPesquisa: configuracao.exigeGrupoPesquisa,
    permiteCancelarSubmissao: configuracao.permiteCancelarSubmissao,
    unificarReservasAcoesAfirmativasPcd: configuracao.unificarReservasAcoesAfirmativasPcd,
  });

  validateRubricaEtapa1(
    criterios.map((criterio) => ({
      chaveInterna: criterio.chaveInterna,
      label: criterio.label,
      peso: criterio.peso,
      notaMaxima: criterio.notaMaxima.toNumber(),
      ordem: criterio.ordem,
    })),
  );
}

export async function listGruposPesquisa(editalId: string): Promise<GrupoPesquisaResumo[]> {
  await assertEditalExiste(editalId);
  const grupos = await prisma.grupoPesquisa.findMany({
    where: { editalId },
    orderBy: [{ nome: "asc" }],
  });

  return grupos.map((grupo) => ({
    id: grupo.id,
    nome: grupo.nome,
    descricao: grupo.descricao,
    ativo: grupo.ativo,
  }));
}

export async function createGrupoPesquisa(
  editalId: string,
  input: UpsertGrupoPesquisaInput,
): Promise<GrupoPesquisaResumo> {
  await assertEditalExiste(editalId);

  const grupo = await prisma.grupoPesquisa.create({
    data: {
      editalId,
      nome: input.nome,
      descricao: input.descricao,
      ativo: input.ativo ?? true,
    },
  });

  return { id: grupo.id, nome: grupo.nome, descricao: grupo.descricao, ativo: grupo.ativo };
}

export async function updateGrupoPesquisa(
  editalId: string,
  grupoId: string,
  input: UpsertGrupoPesquisaInput,
): Promise<GrupoPesquisaResumo> {
  const grupo = await prisma.grupoPesquisa.findUnique({ where: { id: grupoId } });

  if (!grupo || grupo.editalId !== editalId) {
    throw notFound("Grupo de pesquisa nao encontrado.", "GRUPO_PESQUISA_NAO_ENCONTRADO");
  }

  const atualizado = await prisma.grupoPesquisa.update({
    where: { id: grupoId },
    data: {
      nome: input.nome,
      descricao: input.descricao,
      ativo: input.ativo ?? grupo.ativo,
    },
  });

  return {
    id: atualizado.id,
    nome: atualizado.nome,
    descricao: atualizado.descricao,
    ativo: atualizado.ativo,
  };
}

export async function deleteGrupoPesquisa(editalId: string, grupoId: string) {
  const grupo = await prisma.grupoPesquisa.findUnique({
    where: { id: grupoId },
    include: { inscricoes: { select: { id: true }, take: 1 } },
  });

  if (!grupo || grupo.editalId !== editalId) {
    throw notFound("Grupo de pesquisa nao encontrado.", "GRUPO_PESQUISA_NAO_ENCONTRADO");
  }

  if (grupo.inscricoes.length > 0) {
    await prisma.grupoPesquisa.update({ where: { id: grupoId }, data: { ativo: false } });
    return;
  }

  await prisma.grupoPesquisa.delete({ where: { id: grupoId } });
}

