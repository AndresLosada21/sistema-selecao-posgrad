import { prisma } from "../../lib/prisma.js";

export async function recordAuditEvent(input: {
  entidade: string;
  entidadeId?: string;
  acao: string;
  descricao?: string;
  payload?: Record<string, unknown> | null;
  criadoPorId?: string | null;
}) {
  await (prisma as any).auditoriaEvento.create({
    data: {
      entidade: input.entidade,
      entidadeId: input.entidadeId,
      acao: input.acao,
      descricao: input.descricao,
      payload: input.payload ?? undefined,
      criadoPorId: input.criadoPorId ?? undefined,
    },
  });
}
