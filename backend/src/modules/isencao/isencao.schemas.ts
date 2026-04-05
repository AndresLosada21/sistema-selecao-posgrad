import { CursoNivel } from "@prisma/client";
import { z } from "zod";
import { pdfFileUrlSchema } from "../../lib/file-url.schemas.js";

export const editalIdParamSchema = z.object({
  editalId: z.string().min(1),
});

export const pedidoIsencaoIdParamSchema = z.object({
  pedidoIsencaoId: z.string().min(1),
});

export const createIsencaoSchema = z
  .object({
    cursoNivel: z.nativeEnum(CursoNivel),
    inscritoCadUnico: z.boolean(),
    nis: z.string().trim().min(1).optional(),
    justificativa: z.string().trim().min(10).optional(),
    comprovanteUrl: pdfFileUrlSchema.optional(),
    comprovanteNomeArquivo: z.string().trim().min(3).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.inscritoCadUnico) {
      if (!data.justificativa) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["justificativa"],
          message: "Justificativa obrigatoria para candidato sem CadUnico.",
        });
      }

      if (!data.comprovanteUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["comprovanteUrl"],
          message: "Comprovante obrigatorio para candidato sem CadUnico.",
        });
      }

      if (!data.comprovanteNomeArquivo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["comprovanteNomeArquivo"],
          message: "Nome do arquivo do comprovante obrigatorio.",
        });
      }
    }
  });

export const decidirIsencaoSchema = z.object({
  deferida: z.boolean(),
  parecer: z.string().trim().min(5),
});
