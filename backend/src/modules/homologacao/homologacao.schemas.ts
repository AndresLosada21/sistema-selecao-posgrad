import { StatusConfirmacaoReserva, StatusPagamentoInscricao, TipoDocumentoInscricao } from "@prisma/client";
import { z } from "zod";

export const inscricaoIdParamSchema = z.object({
  inscricaoId: z.string().min(1),
});

export const listInscricoesAdminQuerySchema = z.object({
  editalId: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const homologacaoMotivoSchema = z.object({
  codigo: z.string().trim().min(1),
  itemEdital: z.string().trim().min(1),
  titulo: z.string().trim().min(3),
  descricao: z.string().trim().min(3),
  documentoTipo: z.nativeEnum(TipoDocumentoInscricao).optional(),
  sanavel: z.boolean().default(false),
});

export const homologacaoDecisionSchema = z.object({
  homologada: z.boolean(),
  parecer: z.string().trim().min(5),
  motivos: z.array(homologacaoMotivoSchema).max(10).default([]),
}).superRefine((data, context) => {
  if (!data.homologada && data.motivos.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["motivos"],
      message: "Todo indeferimento deve informar ao menos um motivo objetivo vinculado ao edital.",
    });
  }
});

export const confirmacaoReservaSchema = z.object({
  confirmacaoAcoesAfirmativas: z.nativeEnum(StatusConfirmacaoReserva).optional(),
  confirmacaoPcd: z.nativeEnum(StatusConfirmacaoReserva).optional(),
}).refine(
  (data) => data.confirmacaoAcoesAfirmativas !== undefined || data.confirmacaoPcd !== undefined,
  {
    message: "Informe ao menos uma confirmacao operacional de reserva.",
    path: ["confirmacaoAcoesAfirmativas"],
  },
);

export const pagamentoHomologacaoSchema = z.object({
  statusPagamento: z.enum([
    StatusPagamentoInscricao.PENDENTE,
    StatusPagamentoInscricao.PAGO,
    StatusPagamentoInscricao.INVALIDADO,
  ]),
});
