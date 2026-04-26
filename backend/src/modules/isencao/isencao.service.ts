import {
  Prisma,
  StatusIsencao,
  StatusParticipacaoEdital,
  TipoCronogramaEdital,
  type CursoNivel,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { recordAuditEvent } from "../operacao/audit.service.js";
import { sendOperationalNotificationSafely } from "../operacao/notification.service.js";
import { isCronogramaWindowOpen } from "../edital/edital-window.service.js";
import { isPrivateUploadOwnedByUser, parsePrivateUploadUrl, privateUploadExists } from "../upload/upload.service.js";

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

  const pedidoExistente = await prisma.pedidoIsencao.findUnique({
    where: {
      participacaoEditalId: participacao.id,
    },
  });

  if (pedidoExistente) {
    return {
      error: "PEDIDO_ISENCAO_JA_EXISTENTE" as const,
      statusAtual: pedidoExistente.status,
    };
  }

  if (!input.inscritoCadUnico) {
    if (!input.justificativa?.trim()) {
      return { error: "JUSTIFICATIVA_OBRIGATORIA" as const };
    }

    if (!input.comprovanteUrl || !input.comprovanteNomeArquivo) {
      return { error: "COMPROVANTE_OBRIGATORIO" as const };
    }
  }

  const payload = input.inscritoCadUnico
    ? {
        nis: input.nis,
        justificativa: null,
        comprovanteUrl: null,
        comprovanteNomeArquivo: null,
      }
    : {
        nis: input.nis,
        justificativa: input.justificativa,
        comprovanteUrl: input.comprovanteUrl,
      comprovanteNomeArquivo: input.comprovanteNomeArquivo,
    };

  if (!input.inscritoCadUnico && payload.comprovanteUrl && !isPrivateUploadOwnedByUser(payload.comprovanteUrl, input.usuarioId)) {
    return { error: "UPLOAD_SEM_PERMISSAO" as const };
  }

  const comprovantePrivado = parsePrivateUploadUrl(payload.comprovanteUrl);
  if (!input.inscritoCadUnico && payload.comprovanteUrl && !comprovantePrivado) {
    return { error: "UPLOAD_EXTERNO_NAO_PERMITIDO" as const };
  }
  if (comprovantePrivado && !(await privateUploadExists(comprovantePrivado.ownerId, comprovantePrivado.filename))) {
    return { error: "UPLOAD_NAO_ENCONTRADO" as const };
  }

  let pedido: Prisma.PedidoIsencaoGetPayload<{
    include: {
      participacaoEdital: {
        include: {
          edital: true;
        };
      };
    };
  }>;

  try {
    pedido = await prisma.pedidoIsencao.create({
      data: {
        participacaoEditalId: participacao.id,
        cursoNivel: input.cursoNivel,
        inscritoCadUnico: input.inscritoCadUnico,
        ...payload,
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const pedidoConcorrente = await prisma.pedidoIsencao.findUnique({
        where: {
          participacaoEditalId: participacao.id,
        },
      });

      return {
        error: "PEDIDO_ISENCAO_JA_EXISTENTE" as const,
        statusAtual: pedidoConcorrente?.status ?? null,
      };
    }

    throw error;
  }

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

type PedidoIsencaoAdminWithRelations = Prisma.PedidoIsencaoGetPayload<{
  include: {
    participacaoEdital: {
      include: {
        edital: true;
        usuario: true;
      };
    };
  };
}>;

function mapPedidoAdmin(pedido: PedidoIsencaoAdminWithRelations) {
  return {
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
    candidato: {
      id: pedido.participacaoEdital.usuario.id,
      nomeCompleto: pedido.participacaoEdital.usuario.nomeCompleto,
      email: pedido.participacaoEdital.usuario.email,
    },
    criadoEm: pedido.criadoEm.toISOString(),
    atualizadoEm: pedido.atualizadoEm.toISOString(),
  };
}

export async function listPedidosIsencaoAdmin(filters?: { editalId?: string; status?: StatusIsencao; page: number; pageSize: number }) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const where: Prisma.PedidoIsencaoWhereInput = {
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.editalId
      ? {
          participacaoEdital: {
            editalId: filters.editalId,
          },
        }
      : {}),
  };

  const [pedidos, total] = await prisma.$transaction([
    prisma.pedidoIsencao.findMany({
      where,
      include: {
        participacaoEdital: {
          include: {
            edital: true,
            usuario: true,
          },
        },
      },
      orderBy: { criadoEm: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.pedidoIsencao.count({ where }),
  ]);

  return {
    items: pedidos.map((pedido) => mapPedidoAdmin(pedido)),
    total,
    page,
    pageSize,
  };
}

export async function getPedidoIsencaoAdminById(pedidoIsencaoId: string) {
  const pedido = await prisma.pedidoIsencao.findUnique({
    where: { id: pedidoIsencaoId },
    include: {
      participacaoEdital: {
        include: {
          edital: true,
          usuario: true,
        },
      },
    },
  });

  if (!pedido) {
    return null;
  }

  return mapPedidoAdmin(pedido);
}

export async function decidirIsencaoPreliminar(pedidoIsencaoId: string, input: { deferida: boolean; parecer: string }, actorUserId?: string) {
  const updated = await prisma.pedidoIsencao.update({
    where: { id: pedidoIsencaoId },
    data: {
      status: input.deferida ? StatusIsencao.DEFERIDA_PRELIMINAR : StatusIsencao.INDEFERIDA_PRELIMINAR,
      parecerPreliminar: input.parecer,
      resultadoPreliminarEm: new Date(),
    },
    include: {
      participacaoEdital: { include: { usuario: true, edital: true } },
    },
  });

  await recordAuditEvent({ entidade: "PEDIDO_ISENCAO", entidadeId: pedidoIsencaoId, acao: "DECISAO_PRELIMINAR_ISENCAO", descricao: input.deferida ? "Pedido deferido preliminarmente." : "Pedido indeferido preliminarmente.", payload: { status: updated.status }, criadoPorId: actorUserId });
  await sendOperationalNotificationSafely({ to: updated.participacaoEdital.usuario.email, subject: `Resultado preliminar da isencao - ${updated.participacaoEdital.edital.numero}`, text: `Seu pedido de isencao recebeu resultado preliminar: ${updated.status}.` });
  return updated;
}

export async function decidirIsencaoFinal(pedidoIsencaoId: string, input: { deferida: boolean; parecer: string }, actorUserId?: string) {
  const pedido = await prisma.pedidoIsencao.findUnique({ where: { id: pedidoIsencaoId } });

  if (!pedido) {
    return null;
  }

  const updated = await prisma.pedidoIsencao.update({
    where: { id: pedidoIsencaoId },
    data: {
      status: input.deferida ? StatusIsencao.DEFERIDA_FINAL : StatusIsencao.INDEFERIDA_FINAL,
      parecerFinal: input.parecer,
      resultadoFinalEm: new Date(),
    },
    include: {
      participacaoEdital: { include: { usuario: true, edital: true } },
    },
  });

  await recordAuditEvent({ entidade: "PEDIDO_ISENCAO", entidadeId: pedidoIsencaoId, acao: "DECISAO_FINAL_ISENCAO", descricao: input.deferida ? "Pedido deferido no resultado final." : "Pedido indeferido no resultado final.", payload: { status: updated.status }, criadoPorId: actorUserId });
  await sendOperationalNotificationSafely({ to: updated.participacaoEdital.usuario.email, subject: `Resultado final da isencao - ${updated.participacaoEdital.edital.numero}`, text: `Seu pedido de isencao recebeu resultado final: ${updated.status}.` });
  return updated;
}
