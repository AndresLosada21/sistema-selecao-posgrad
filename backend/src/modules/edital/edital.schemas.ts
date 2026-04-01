import { CursoNivel, StatusEdital } from "@prisma/client";
import { z } from "zod";

const booleanFromQuery = z
  .union([z.boolean(), z.enum(["true", "false"]), z.undefined()])
  .transform((value) => value === true || value === "true");

export const listEditaisQuerySchema = z.object({
  cursoNivel: z.nativeEnum(CursoNivel).optional(),
  status: z.nativeEnum(StatusEdital).optional(),
  ativosSomente: booleanFromQuery.optional(),
});

export const editalParamsSchema = z.object({
  editalId: z.string().min(1),
});
