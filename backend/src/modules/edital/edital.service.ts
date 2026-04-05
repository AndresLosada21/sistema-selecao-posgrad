import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

import type {
  EditalDetalhe,
  EditalFaseResumo,
  EditalListFilters,
  EditalResumo,
  EditalWithRelations,
  LinhaPesquisaResumo,
  UpsertCronogramaInput,
  UpsertEditalInput,
  UpsertLinhaPesquisaInput,
} from "./edital.types.js";
import { conflict, notFound } from "../../lib/http-errors.js";

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapLinhaPesquisa(linha: EditalWithRelations["linhasPesquisa"][number]): LinhaPesquisaResumo {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    vagasAmplaConcorrencia: linha.vagasAmplaConcorrencia,
    vagasAcoesAfirmativas: linha.vagasAcoesAfirmativas,
    vagasPcd: linha.vagasPcd,
    totalVagas:
      linha.vagasAmplaConcorrencia + linha.vagasAcoesAfirmativas + linha.vagasPcd,
  };
}

function mapCronograma(cronograma: EditalWithRelations["cronogramas"][number], now: Date): EditalFaseResumo {
  const ativaAgora = cronograma.inicioEm <= now && cronograma.fimEm >= now;
  const futura = cronograma.inicioEm > now;

  return {
    id: cronograma.id,
    tipo: cronograma.tipo,
    titulo: cronograma.titulo,
    descricao: cronograma.descricao,
    inicioEm: cronograma.inicioEm.toISOString(),
    fimEm: cronograma.fimEm.toISOString(),
    ativaAgora,
    futura,
    encerrada: cronograma.fimEm < now,
  };
}

function sortCronogramas(a: { inicioEm: Date }, b: { inicioEm: Date }) {
  return a.inicioEm.getTime() - b.inicioEm.getTime();
}

function mapEditalResumo(edital: EditalWithRelations, now: Date): EditalResumo {
  const cronogramasOrdenados = [...edital.cronogramas].sort(sortCronogramas);
  const cronogramasResumo = cronogramasOrdenados.map((item) => mapCronograma(item, now));
  const faseAtual = cronogramasResumo.find((item) => item.ativaAgora) ?? null;
  const proximaFase = cronogramasResumo.find((item) => item.futura) ?? null;

  return {
    id: edital.id,
    numero: edital.numero,
    titulo: edital.titulo,
    descricao: edital.descricao,
    ano: edital.ano,
    semestre: edital.semestre,
    cursoNivel: edital.cursoNivel,
    status: edital.status,
    publicadoEm: toIsoOrNull(edital.publicadoEm),
    possuiJanelaAtiva: faseAtual !== null,
    faseAtual,
    proximaFase,
    linhasPesquisa: edital.linhasPesquisa.map(mapLinhaPesquisa),
  };
}

export async function listEditais(filters: EditalListFilters): Promise<EditalResumo[]> {
  const where: Prisma.EditalWhereInput = {
    cursoNivel: filters.cursoNivel,
  };

  const now = new Date();

  if (filters.ativosSomente) {
    where.status = {
      in: ["PUBLICADO", "EM_ANDAMENTO"],
    };
  } else if (filters.status?.length) {
    where.status = {
      in: filters.status,
    };
  }

  const editais = await prisma.edital.findMany({
    where,
    include: {
      cronogramas: true,
      linhasPesquisa: true,
    },
    orderBy: [{ ano: "desc" }, { publicadoEm: "desc" }, { criadoEm: "desc" }],
  });

  return editais.map((edital) => mapEditalResumo(edital, now));
}

export async function listAdminEditais(filters?: EditalListFilters): Promise<EditalResumo[]> {
  return await listEditais({ ...filters, ativosSomente: false });
}

export async function getEditalById(editalId: string): Promise<EditalDetalhe | null> {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
    include: {
      cronogramas: true,
      linhasPesquisa: true,
    },
  });

  if (!edital) {
    return null;
  }

  const now = new Date();
  const resumo = mapEditalResumo(edital, now);

  return {
    ...resumo,
    cronogramas: [...edital.cronogramas].sort(sortCronogramas).map((item) => mapCronograma(item, now)),
  };
}

export async function getAdminEditalById(editalId: string): Promise<EditalDetalhe | null> {
  return await getEditalById(editalId);
}

function resolvePublicadoEm(input: UpsertEditalInput) {
  if (input.publicadoEm) {
    return new Date(input.publicadoEm);
  }

  if (input.status === "PUBLICADO" || input.status === "EM_ANDAMENTO") {
    return new Date();
  }

  return null;
}

export async function createEdital(input: UpsertEditalInput, criadoPorId: string) {
  return await prisma.edital.create({
    data: {
      numero: input.numero,
      titulo: input.titulo,
      descricao: input.descricao,
      ano: input.ano,
      semestre: input.semestre,
      cursoNivel: input.cursoNivel,
      status: input.status,
      publicadoEm: resolvePublicadoEm(input),
      criadoPorId,
    },
  });
}

export async function updateEdital(editalId: string, input: UpsertEditalInput) {
  const edital = await prisma.edital.findUnique({ where: { id: editalId } });

  if (!edital) {
    throw notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO");
  }

  return await prisma.edital.update({
    where: { id: editalId },
    data: {
      numero: input.numero,
      titulo: input.titulo,
      descricao: input.descricao,
      ano: input.ano,
      semestre: input.semestre,
      cursoNivel: input.cursoNivel,
      status: input.status,
      publicadoEm: resolvePublicadoEm(input),
    },
  });
}

export async function deleteEdital(editalId: string) {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
    include: { participacoes: true },
  });

  if (!edital) {
    throw notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO");
  }

  if (edital.participacoes.length) {
    throw conflict("Nao e permitido excluir edital com participacoes vinculadas.", "EDITAL_COM_PARTICIPACOES");
  }

  await prisma.edital.delete({ where: { id: editalId } });
}

export async function createLinhaPesquisa(editalId: string, input: UpsertLinhaPesquisaInput) {
  return await prisma.linhaPesquisa.create({
    data: {
      editalId,
      nome: input.nome,
      descricao: input.descricao,
      vagasAmplaConcorrencia: input.vagasAmplaConcorrencia,
      vagasAcoesAfirmativas: input.vagasAcoesAfirmativas,
      vagasPcd: input.vagasPcd,
    },
  });
}

export async function updateLinhaPesquisa(linhaPesquisaId: string, input: UpsertLinhaPesquisaInput) {
  const linha = await prisma.linhaPesquisa.findUnique({ where: { id: linhaPesquisaId } });

  if (!linha) {
    throw notFound("Linha de pesquisa nao encontrada.", "LINHA_PESQUISA_NAO_ENCONTRADA");
  }

  return await prisma.linhaPesquisa.update({
    where: { id: linhaPesquisaId },
    data: {
      nome: input.nome,
      descricao: input.descricao,
      vagasAmplaConcorrencia: input.vagasAmplaConcorrencia,
      vagasAcoesAfirmativas: input.vagasAcoesAfirmativas,
      vagasPcd: input.vagasPcd,
    },
  });
}

export async function deleteLinhaPesquisa(linhaPesquisaId: string) {
  const linha = await prisma.linhaPesquisa.findUnique({
    where: { id: linhaPesquisaId },
    include: { inscricoes: true, classificacoesFinais: true },
  });

  if (!linha) {
    throw notFound("Linha de pesquisa nao encontrada.", "LINHA_PESQUISA_NAO_ENCONTRADA");
  }

  if (linha.inscricoes.length || linha.classificacoesFinais.length) {
    throw conflict("Nao e permitido excluir linha de pesquisa com historico operacional vinculado.", "LINHA_COM_HISTORICO");
  }

  await prisma.linhaPesquisa.delete({ where: { id: linhaPesquisaId } });
}

export async function createCronograma(editalId: string, input: UpsertCronogramaInput) {
  return await prisma.cronogramaEdital.create({
    data: {
      editalId,
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao,
      inicioEm: new Date(input.inicioEm),
      fimEm: new Date(input.fimEm),
    },
  });
}

export async function updateCronograma(cronogramaId: string, input: UpsertCronogramaInput) {
  const cronograma = await prisma.cronogramaEdital.findUnique({ where: { id: cronogramaId } });

  if (!cronograma) {
    throw notFound("Cronograma nao encontrado.", "CRONOGRAMA_NAO_ENCONTRADO");
  }

  return await prisma.cronogramaEdital.update({
    where: { id: cronogramaId },
    data: {
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao,
      inicioEm: new Date(input.inicioEm),
      fimEm: new Date(input.fimEm),
    },
  });
}

export async function deleteCronograma(cronogramaId: string) {
  const cronograma = await prisma.cronogramaEdital.findUnique({ where: { id: cronogramaId } });

  if (!cronograma) {
    throw notFound("Cronograma nao encontrado.", "CRONOGRAMA_NAO_ENCONTRADO");
  }

  await prisma.cronogramaEdital.delete({ where: { id: cronogramaId } });
}
