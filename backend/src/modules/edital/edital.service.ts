import type { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

import type {
  EditalDetalhe,
  EditalFaseResumo,
  EditalListFilters,
  EditalResumo,
  EditalWithRelations,
  LinhaPesquisaResumo,
} from "./edital.types.js";

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
    tipo: cronograma.tipo,
    titulo: cronograma.titulo,
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
    status: filters.status,
  };

  const now = new Date();

  if (filters.ativosSomente) {
    where.status = {
      in: ["PUBLICADO", "EM_ANDAMENTO"],
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
