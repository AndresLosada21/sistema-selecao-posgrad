import {
  StatusIsencao,
  StatusParticipacaoEdital,
  TipoCronogramaEdital,
  type CursoNivel,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";

type CreatePedidoIsencaoInput = {
  editalId: string;
  usuarioId: string;
  cursoNivel: CursoNivel;
  inscritoCadUnico: boolean;
  nis?: string;
  justificativa?: string;
  comprovanteUrl?: string;
  comprovanteNomeArquivo?: string;
};

export async function createOrUpdatePedidoIsencao(input: CreatePedidoIsencaoInput) {
  const edital = await prisma.edital.findUnique({
    where: { id: input.editalId },
  });

  if (!edital) {
    return { error: "EDITAL_NAO_ENCONTRADO" as const };
  }

  if (edital.cursoNivel !== input.cursoNivel) {
    return { error: "CURSO_NIVEL_INCOMPATIVEL" as const };
  }

  const windowStatus = await isCronogramaWindowOpen(input.editalId, TipoCronogramaEdital.PEDIDO_ISENCAO);

  if (!windowStatus.open) {
    return {
      error: "JANELA_ISENCAO_FECHADA" as const,
      reason: windowStatus.reason,
    };
  }

  const participacao = await prisma.participacaoEdital.upsert({
    where: {
      usuarioId_editalId: {
        usuarioId: input.usuarioId,
        editalId: input.editalId,
      },
    },
    update: {},
    create: {
      usuarioId: input.usuarioId,
      editalId: input.editalId,
      status: StatusParticipacaoEdital.ATIVA,
    },
  });

  const pedido = await prisma.pedidoIsencao.upsert({
    where: {
      participacaoEditalId: participacao.id,
    },
    update: {
      cursoNivel: input.cursoNivel,
      inscritoCadUnico: input.inscritoCadUnico,
      nis: input.nis,
      justificativa: input.justificativa,
      comprovanteUrl: input.comprovanteUrl,
      comprovanteNomeArquivo: input.comprovanteNomeArquivo,
      status: StatusIsencao.SOLICITADA,
    },
    create: {
      participacaoEditalId: participacao.id,
      cursoNivel: input.cursoNivel,
      inscritoCadUnico: input.inscritoCadUnico,
      nis: input.nis,
      justificativa: input.justificativa,
      comprovanteUrl: input.comprovanteUrl,
      comprovanteNomeArquivo: input.comprovanteNomeArquivo,
      status: StatusIsencao.SOLICITADA,
    },
    include: {
      participacaoEdital: {
        include: {
          edital: true,
        },
      },
    },
  });

  return { pedido };
}

export async function listPedidosIsencaoDoUsuario(usuarioId: string) {
  const pedidos = await prisma.pedidoIsencao.findMany({
    where: {
      participacaoEdital: {
        usuarioId,
      },
    },
    include: {
      participacaoEdital: {
        include: {
          edital: true,
        },
      },
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  return pedidos.map((pedido) => ({
    id: pedido.id,
    status: pedido.status,
    cursoNivel: pedido.cursoNivel,
    inscritoCadUnico: pedido.inscritoCadUnico,
    nis: pedido.nis,
    justificativa: pedido.justificativa,
    comprovanteUrl: pedido.comprovanteUrl,
    comprovanteNomeArquivo: pedido.comprovanteNomeArquivo,
    parecerPreliminar: pedido.parecerPreliminar,
    parecerFinal: pedido.parecerFinal,
    edital: {
      id: pedido.participacaoEdital.edital.id,
      numero: pedido.participacaoEdital.edital.numero,
      titulo: pedido.participacaoEdital.edital.titulo,
      cursoNivel: pedido.participacaoEdital.edital.cursoNivel,
      status: pedido.participacaoEdital.edital.status,
    },
    criadoEm: pedido.criadoEm.toISOString(),
    atualizadoEm: pedido.atualizadoEm.toISOString(),
  }));
}
