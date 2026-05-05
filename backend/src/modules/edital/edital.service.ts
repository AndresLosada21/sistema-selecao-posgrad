import type { Prisma, TipoCronogramaEdital } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { toIsoOrNull } from "../../lib/serialization.js";

import type {
  AdminEditalDetalhe,
  ApplyTemaRedacaoPacoteInput,
  ApplyTemaRedacaoPacoteResult,
  EditalDetalhe,
  EditalFaseResumo,
  EditalListFilters,
  EditalListResult,
  EditalResumo,
  EditalWithRelations,
  LinhaPesquisaResumo,
  TemaRedacaoPacoteListResult,
  TemaRedacaoResumo,
  UpsertCronogramaInput,
  UpsertEditalInput,
  UpsertLinhaPesquisaInput,
  UpsertTemaRedacaoInput,
} from "./edital.types.js";
import { conflict, notFound } from "../../lib/http-errors.js";
import {
  getTemaRedacaoPacoteBySlug,
  listTemaRedacaoPacoteSummaries,
  normalizeTemaRedacaoKey,
} from "./temas-redacao-padroes.js";

function buildEditalWhere(filters: EditalListFilters): Prisma.EditalWhereInput {
  const where: Prisma.EditalWhereInput = {
    cursoNivel: filters.cursoNivel,
  };

  if (filters.ativosSomente) {
    where.status = {
      in: ["PUBLICADO", "EM_ANDAMENTO"],
    };
  } else if (filters.status?.length) {
    where.status = {
      in: filters.status,
    };
  }

  if (filters.q) {
    where.OR = [
      { numero: { contains: filters.q, mode: "insensitive" } },
      { titulo: { contains: filters.q, mode: "insensitive" } },
      { descricao: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  return where;
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

function mapTemaRedacao(tema: EditalWithRelations["temasRedacao"][number]): TemaRedacaoResumo {
  return {
    id: tema.id,
    titulo: tema.titulo,
    descricao: tema.descricao,
    ordem: tema.ordem,
    ativo: tema.ativo,
  };
}

function sortCronogramas(a: { inicioEm: Date }, b: { inicioEm: Date }) {
  return a.inicioEm.getTime() - b.inicioEm.getTime();
}

function sortTemasRedacao(a: { ordem: number; titulo: string }, b: { ordem: number; titulo: string }) {
  if (a.ordem !== b.ordem) {
    return a.ordem - b.ordem;
  }

  return a.titulo.localeCompare(b.titulo, "pt-BR");
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

export async function listEditais(filters: EditalListFilters): Promise<EditalListResult> {
  const where = buildEditalWhere(filters);
  const now = new Date();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const [total, editais] = await Promise.all([
    prisma.edital.count({ where }),
    prisma.edital.findMany({
      where,
      include: {
        cronogramas: true,
        linhasPesquisa: true,
        temasRedacao: true,
      },
      orderBy: [{ ano: "desc" }, { publicadoEm: "desc" }, { criadoEm: "desc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    items: editais.map((edital) => mapEditalResumo(edital, now)),
    total,
    page,
    pageSize,
  };
}

export async function listAdminEditais(filters?: EditalListFilters): Promise<EditalListResult> {
  return await listEditais({ ...filters, ativosSomente: false });
}

export async function getEditalById(editalId: string): Promise<EditalDetalhe | null> {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
    include: {
      cronogramas: true,
      linhasPesquisa: true,
      temasRedacao: true,
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
    temasRedacao: edital.temasRedacao.filter((item) => item.ativo).sort(sortTemasRedacao).map(mapTemaRedacao),
    temasRedacaoConfigurados: edital.temasRedacao.length > 0,
  };
}

function getMotivoBloqueioEstrutural(input: { status: string; hasParticipacoes: boolean; hasPublicacoes: boolean }) {
  if (["PUBLICADO", "EM_ANDAMENTO", "ENCERRADO", "CANCELADO"].includes(input.status) && (input.hasParticipacoes || input.hasPublicacoes)) {
    return "Nao e permitido alterar estrutura de linhas, cronogramas ou temas em edital ja operacionalizado. Use retificacao/publicacao apropriada.";
  }

  return null;
}

export async function getAdminEditalById(editalId: string): Promise<AdminEditalDetalhe | null> {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
    include: {
      cronogramas: true,
      linhasPesquisa: true,
      temasRedacao: true,
      participacoes: { select: { id: true }, take: 1 },
      publicacoesOficiais: { select: { id: true }, take: 1 },
    },
  });

  if (!edital) {
    return null;
  }

  const now = new Date();
  const resumo = mapEditalResumo(edital, now);
  const motivoBloqueioEstrutural = getMotivoBloqueioEstrutural({
    status: edital.status,
    hasParticipacoes: edital.participacoes.length > 0,
    hasPublicacoes: edital.publicacoesOficiais.length > 0,
  });

  return {
    ...resumo,
    cronogramas: [...edital.cronogramas].sort(sortCronogramas).map((item) => mapCronograma(item, now)),
    temasRedacao: [...edital.temasRedacao].sort(sortTemasRedacao).map(mapTemaRedacao),
    temasRedacaoConfigurados: edital.temasRedacao.length > 0,
    permiteMutacaoEstrutural: !motivoBloqueioEstrutural,
    motivoBloqueioEstrutural,
  };
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

async function assertNoCronogramaTipoDuplicado(input: { editalId: string; tipo: string; ignoreId?: string }) {
  const existente = await prisma.cronogramaEdital.findFirst({
    where: {
      editalId: input.editalId,
      tipo: input.tipo as never,
      ...(input.ignoreId ? { id: { not: input.ignoreId } } : {}),
    },
  });

  if (existente) {
    throw conflict("Ja existe cronograma deste tipo para o edital informado.", "CRONOGRAMA_TIPO_DUPLICADO");
  }
}

async function assertEditalEstruturaMinimaParaPublicacao(editalId: string) {
  const [linhasCount, cronogramas] = await prisma.$transaction([
    prisma.linhaPesquisa.count({ where: { editalId } }),
    prisma.cronogramaEdital.findMany({ where: { editalId }, select: { tipo: true, inicioEm: true, fimEm: true } }),
  ]);

  if (linhasCount === 0) {
    throw conflict("Nao e permitido publicar edital sem ao menos uma linha de pesquisa cadastrada.", "EDITAL_SEM_LINHAS_PESQUISA");
  }

  if (cronogramas.length === 0) {
    throw conflict("Nao e permitido publicar edital sem cronogramas cadastrados.", "EDITAL_SEM_CRONOGRAMA");
  }

  if (!cronogramas.some((cronograma) => cronograma.tipo === "INSCRICAO")) {
    throw conflict("Nao e permitido publicar edital sem janela de inscricao cadastrada.", "EDITAL_SEM_JANELA_INSCRICAO");
  }

  const tipos = new Set<string>();
  for (const cronograma of cronogramas) {
    if (tipos.has(cronograma.tipo)) {
      throw conflict("Nao e permitido publicar edital com cronogramas duplicados por tipo.", "EDITAL_COM_CRONOGRAMA_DUPLICADO");
    }
    tipos.add(cronograma.tipo);
  }

  const dependencies: Array<{ tipo: TipoCronogramaEdital; dependeDe: TipoCronogramaEdital }> = [
    { tipo: "RECURSO_HOMOLOGACAO", dependeDe: "HOMOLOGACAO_PRELIMINAR" },
    { tipo: "RECURSO_ETAPA_1", dependeDe: "ETAPA_1" },
    { tipo: "RECURSO_ETAPA_2", dependeDe: "ETAPA_2" },
    { tipo: "RECURSO_CLASSIFICACAO", dependeDe: "CLASSIFICACAO_PRELIMINAR" },
  ];

  for (const dependency of dependencies) {
    if (tipos.has(dependency.tipo) && !tipos.has(dependency.dependeDe)) {
      throw conflict(`Nao e permitido cadastrar ${dependency.tipo} sem a fase base ${dependency.dependeDe}.`, "EDITAL_CRONOGRAMA_SEM_FASE_BASE");
    }
  }

  const cronogramaByTipo = new Map(cronogramas.map((cronograma) => [cronograma.tipo, cronograma]));
  for (const dependency of dependencies) {
    const faseBase = cronogramaByTipo.get(dependency.dependeDe);
    const faseRecurso = cronogramaByTipo.get(dependency.tipo);

    if (faseBase && faseRecurso && faseBase.fimEm > faseRecurso.inicioEm) {
      throw conflict(`Nao e permitido abrir ${dependency.tipo} antes do encerramento de ${dependency.dependeDe}.`, "EDITAL_CRONOGRAMA_SEQUENCIA_INVALIDA");
    }
  }
}

async function assertEditalPodeReceberMutacaoEstrutural(editalId: string) {
  const edital = await prisma.edital.findUnique({
    where: { id: editalId },
    include: {
      participacoes: { select: { id: true }, take: 1 },
      publicacoesOficiais: { select: { id: true }, take: 1 },
    },
  });

  if (!edital) {
    throw notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO");
  }

  const motivoBloqueioEstrutural = getMotivoBloqueioEstrutural({
    status: edital.status,
    hasParticipacoes: edital.participacoes.length > 0,
    hasPublicacoes: edital.publicacoesOficiais.length > 0,
  });

  if (motivoBloqueioEstrutural) {
    throw conflict(motivoBloqueioEstrutural, "EDITAL_ESTRUTURA_BLOQUEADA");
  }

  return edital;
}

type TemaRedacaoRepository = Pick<Prisma.TransactionClient, "temaRedacaoEdital">;

async function assertNoActiveTemaRedacaoDuplicadoInRepository(
  db: TemaRedacaoRepository,
  input: { editalId: string; titulo: string; ignoreId?: string; ativo: boolean },
) {
  if (!input.ativo) {
    return;
  }

  const existentes = await db.temaRedacaoEdital.findMany({
    where: {
      editalId: input.editalId,
      ativo: true,
      ...(input.ignoreId ? { id: { not: input.ignoreId } } : {}),
    },
    select: { titulo: true },
  });

  const incomingKey = normalizeTemaRedacaoKey(input.titulo);
  const existente = existentes.find((tema) => normalizeTemaRedacaoKey(tema.titulo) === incomingKey);

  if (existente) {
    throw conflict("Ja existe um tema de redacao ativo com este titulo neste edital.", "TEMA_REDACAO_DUPLICADO");
  }
}

async function applyTemaRedacaoPacoteInRepository(
  db: Prisma.TransactionClient,
  editalId: string,
  pacoteSlug: string,
  modo: "MERGE" | "REPLACE_INACTIVE",
) {
  const pacote = getTemaRedacaoPacoteBySlug(pacoteSlug);

  if (!pacote) {
    throw notFound("Pacote de temas de redacao nao encontrado.", "TEMA_REDACAO_PACOTE_NAO_ENCONTRADO");
  }

  const pacoteResumo = listTemaRedacaoPacoteSummaries().find((item) => item.slug === pacote.slug)!;
  const existentes = await db.temaRedacaoEdital.findMany({
    where: { editalId },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
  });

  const existentesByKey = new Map(existentes.map((tema) => [normalizeTemaRedacaoKey(tema.titulo), tema]));
  const pacoteKeys = new Set(pacote.temas.map((tema) => normalizeTemaRedacaoKey(tema.titulo)));

  const criados: string[] = [];
  const reativados: string[] = [];
  const atualizados: string[] = [];
  const inativados: string[] = [];
  const jaExistentes: string[] = [];

  if (modo === "REPLACE_INACTIVE") {
    for (const temaExistente of existentes) {
      if (!temaExistente.ativo) {
        continue;
      }

      const normalizedKey = normalizeTemaRedacaoKey(temaExistente.titulo);

      if (pacoteKeys.has(normalizedKey)) {
        continue;
      }

      await db.temaRedacaoEdital.update({
        where: { id: temaExistente.id },
        data: { ativo: false },
      });
      inativados.push(temaExistente.titulo);
    }
  }

  for (const temaPacote of pacote.temas) {
    const normalizedKey = normalizeTemaRedacaoKey(temaPacote.titulo);
    const existente = existentesByKey.get(normalizedKey);

    if (!existente) {
      await db.temaRedacaoEdital.create({
        data: {
          editalId,
          titulo: temaPacote.titulo,
          descricao: temaPacote.descricao,
          ordem: temaPacote.ordem,
          ativo: true,
        },
      });
      criados.push(temaPacote.titulo);
      continue;
    }

    if (!existente.ativo) {
      await db.temaRedacaoEdital.update({
        where: { id: existente.id },
        data: {
          titulo: temaPacote.titulo,
          descricao: temaPacote.descricao,
          ordem: temaPacote.ordem,
          ativo: true,
        },
      });
      reativados.push(temaPacote.titulo);
      continue;
    }

    const precisaAtualizar = existente.titulo !== temaPacote.titulo
      || (existente.descricao ?? null) !== (temaPacote.descricao ?? null)
      || existente.ordem !== temaPacote.ordem;

    if (precisaAtualizar) {
      await db.temaRedacaoEdital.update({
        where: { id: existente.id },
        data: {
          titulo: temaPacote.titulo,
          descricao: temaPacote.descricao,
          ordem: temaPacote.ordem,
        },
      });
      atualizados.push(temaPacote.titulo);
      continue;
    }

    jaExistentes.push(existente.titulo);
  }

  const totalAtivosDepois = await db.temaRedacaoEdital.count({
    where: { editalId, ativo: true },
  });

  return {
    editalId,
    pacote: pacoteResumo,
    modo,
    criados,
    reativados,
    atualizados,
    inativados,
    jaExistentes,
    totalAtivosDepois,
  } satisfies ApplyTemaRedacaoPacoteResult;
}

export async function createEdital(input: UpsertEditalInput, criadoPorId: string) {
  if (input.status === "PUBLICADO" || input.status === "EM_ANDAMENTO") {
    throw conflict("Crie o edital primeiro em rascunho e publique apenas depois de cadastrar linhas e cronogramas minimos.", "EDITAL_ESTRUTURA_MINIMA_PENDENTE");
  }

  return await prisma.$transaction(async (tx) => {
    const edital = await tx.edital.create({
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

    if (input.temaPacoteInicialSlug) {
      await applyTemaRedacaoPacoteInRepository(tx, edital.id, input.temaPacoteInicialSlug, "MERGE");
    }

    for (const tema of input.temasRedacaoIniciais ?? []) {
      await assertNoActiveTemaRedacaoDuplicadoInRepository(tx, {
        editalId: edital.id,
        titulo: tema.titulo,
        ativo: tema.ativo ?? true,
      });

      await tx.temaRedacaoEdital.create({
        data: {
          editalId: edital.id,
          titulo: tema.titulo,
          descricao: tema.descricao,
          ordem: tema.ordem ?? 0,
          ativo: tema.ativo ?? true,
        },
      });
    }

    return edital;
  });
}

export async function updateEdital(editalId: string, input: UpsertEditalInput) {
  const edital = await prisma.edital.findUnique({ where: { id: editalId } });

  if (!edital) {
    throw notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO");
  }

  if (input.status === "PUBLICADO" || input.status === "EM_ANDAMENTO") {
    await assertEditalEstruturaMinimaParaPublicacao(editalId);
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
  await assertEditalPodeReceberMutacaoEstrutural(editalId);

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

export async function updateLinhaPesquisa(editalId: string, linhaPesquisaId: string, input: UpsertLinhaPesquisaInput) {
  const linha = await prisma.linhaPesquisa.findUnique({ where: { id: linhaPesquisaId } });

  if (!linha || linha.editalId !== editalId) {
    throw notFound("Linha de pesquisa nao encontrada.", "LINHA_PESQUISA_NAO_ENCONTRADA");
  }

  await assertEditalPodeReceberMutacaoEstrutural(linha.editalId);

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

export async function deleteLinhaPesquisa(editalId: string, linhaPesquisaId: string) {
  const linha = await prisma.linhaPesquisa.findUnique({
    where: { id: linhaPesquisaId },
    include: { inscricoes: true, classificacoesFinais: true },
  });

  if (!linha || linha.editalId !== editalId) {
    throw notFound("Linha de pesquisa nao encontrada.", "LINHA_PESQUISA_NAO_ENCONTRADA");
  }

  await assertEditalPodeReceberMutacaoEstrutural(linha.editalId);

  if (linha.inscricoes.length || linha.classificacoesFinais.length) {
    throw conflict("Nao e permitido excluir linha de pesquisa com historico operacional vinculado.", "LINHA_COM_HISTORICO");
  }

  await prisma.linhaPesquisa.delete({ where: { id: linhaPesquisaId } });
}

export async function createCronograma(editalId: string, input: UpsertCronogramaInput) {
  await assertEditalPodeReceberMutacaoEstrutural(editalId);
  await assertNoCronogramaTipoDuplicado({ editalId, tipo: input.tipo });

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

export async function updateCronograma(editalId: string, cronogramaId: string, input: UpsertCronogramaInput) {
  const cronograma = await prisma.cronogramaEdital.findUnique({ where: { id: cronogramaId } });

  if (!cronograma || cronograma.editalId !== editalId) {
    throw notFound("Cronograma nao encontrado.", "CRONOGRAMA_NAO_ENCONTRADO");
  }

  await assertEditalPodeReceberMutacaoEstrutural(cronograma.editalId);

  await assertNoCronogramaTipoDuplicado({ editalId: cronograma.editalId, tipo: input.tipo, ignoreId: cronograma.id });

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

export async function deleteCronograma(editalId: string, cronogramaId: string) {
  const cronograma = await prisma.cronogramaEdital.findUnique({ where: { id: cronogramaId } });

  if (!cronograma || cronograma.editalId !== editalId) {
    throw notFound("Cronograma nao encontrado.", "CRONOGRAMA_NAO_ENCONTRADO");
  }

  await assertEditalPodeReceberMutacaoEstrutural(cronograma.editalId);

  await prisma.cronogramaEdital.delete({ where: { id: cronogramaId } });
}

async function assertNoActiveTemaRedacaoDuplicado(input: { editalId: string; titulo: string; ignoreId?: string; ativo: boolean }) {
  await assertNoActiveTemaRedacaoDuplicadoInRepository(prisma, input);
}

export async function listTemaRedacaoPacotes(): Promise<TemaRedacaoPacoteListResult> {
  const items = listTemaRedacaoPacoteSummaries();

  return {
    items,
    total: items.length,
  };
}

export async function createTemaRedacao(editalId: string, input: UpsertTemaRedacaoInput) {
  const edital = await prisma.edital.findUnique({ where: { id: editalId } });

  if (!edital) {
    throw notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO");
  }

  await assertEditalPodeReceberMutacaoEstrutural(editalId);

  await assertNoActiveTemaRedacaoDuplicado({
    editalId,
    titulo: input.titulo,
    ativo: input.ativo ?? true,
  });

  return await prisma.temaRedacaoEdital.create({
    data: {
      editalId,
      titulo: input.titulo,
      descricao: input.descricao,
      ordem: input.ordem ?? 0,
      ativo: input.ativo ?? true,
    },
  });
}

export async function updateTemaRedacao(temaId: string, input: UpsertTemaRedacaoInput) {
  const tema = await prisma.temaRedacaoEdital.findUnique({ where: { id: temaId } });

  if (!tema) {
    throw notFound("Tema de redacao nao encontrado.", "TEMA_REDACAO_NAO_ENCONTRADO");
  }

  await assertEditalPodeReceberMutacaoEstrutural(tema.editalId);

  await assertNoActiveTemaRedacaoDuplicado({
    editalId: tema.editalId,
    titulo: input.titulo,
    ignoreId: tema.id,
    ativo: input.ativo ?? tema.ativo,
  });

  return await prisma.temaRedacaoEdital.update({
    where: { id: temaId },
    data: {
      titulo: input.titulo,
      descricao: input.descricao,
      ordem: input.ordem ?? 0,
      ativo: input.ativo ?? tema.ativo,
    },
  });
}

export async function applyTemaRedacaoPacote(
  editalId: string,
  input: ApplyTemaRedacaoPacoteInput,
): Promise<ApplyTemaRedacaoPacoteResult> {
  const edital = await prisma.edital.findUnique({ where: { id: editalId }, select: { id: true } });

  if (!edital) {
    throw notFound("Edital nao encontrado.", "EDITAL_NAO_ENCONTRADO");
  }

  await assertEditalPodeReceberMutacaoEstrutural(editalId);

  const pacote = getTemaRedacaoPacoteBySlug(input.slug);

  if (!pacote) {
    throw notFound("Pacote de temas de redacao nao encontrado.", "TEMA_REDACAO_PACOTE_NAO_ENCONTRADO");
  }

  const modo = input.modo ?? "MERGE";

  return await prisma.$transaction(async (tx) => applyTemaRedacaoPacoteInRepository(tx, editalId, pacote.slug, modo));
}

export async function deleteTemaRedacao(temaId: string) {
  const tema = await prisma.temaRedacaoEdital.findUnique({
    where: { id: temaId },
    include: {
      inscricoes: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!tema) {
    throw notFound("Tema de redacao nao encontrado.", "TEMA_REDACAO_NAO_ENCONTRADO");
  }

  await assertEditalPodeReceberMutacaoEstrutural(tema.editalId);

  const inscricaoLegada = await prisma.inscricao.findFirst({
    where: {
      temaRedacaoEditalId: null,
      temaRedacao: {
        equals: tema.titulo.trim(),
        mode: "insensitive",
      },
      participacaoEdital: {
        editalId: tema.editalId,
      },
    },
    select: { id: true },
  });

  if (tema.inscricoes.length > 0 || inscricaoLegada) {
    await prisma.temaRedacaoEdital.update({
      where: { id: temaId },
      data: { ativo: false },
    });
    return;
  }

  await prisma.temaRedacaoEdital.delete({ where: { id: temaId } });
}
