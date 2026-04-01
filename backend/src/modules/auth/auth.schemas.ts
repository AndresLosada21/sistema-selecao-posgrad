import { z } from "zod";

export const registerSchema = z.object({
  nomeCompleto: z.string().min(5),
  email: z.string().email(),
  senha: z.string().min(8),
  telefone: z.string().min(8).optional(),
  cpf: z.string().min(11).max(14).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(8),
});
