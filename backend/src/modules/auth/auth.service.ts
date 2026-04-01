import { Role, StatusConta } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

import type { AuthenticatedUser, ParticipacaoResumo } from "./auth.types.js";

function sanitizeUser(user: {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  statusConta: StatusConta;
  perfis: { role: Role }[];
}): AuthenticatedUser {
  return {
    id: user.id,
    nomeCompleto: user.nomeCompleto,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    statusConta: user.statusConta,
    perfis: user.perfis.map((perfil) => perfil.role),
  };
}

function createAccessToken(user: { id: string; email: string }) {
  return jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: "7d",
  });
}

export async function registerCandidate(input: {
  nomeCompleto: string;
  email: string;
  senha: string;
  telefone?: string;
  cpf?: string;
}) {
  const existingUser = await prisma.usuario.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    return { error: "EMAIL_ALREADY_IN_USE" as const };
  }

  const senhaHash = await bcrypt.hash(input.senha, 10);

  const user = await prisma.usuario.create({
    data: {
      nomeCompleto: input.nomeCompleto,
      email: input.email,
      senhaHash,
      telefone: input.telefone,
      cpf: input.cpf,
      statusConta: StatusConta.ATIVA,
      perfis: {
        create: [{ role: Role.CANDIDATO }],
      },
    },
    include: {
      perfis: true,
    },
  });

  return {
    user: sanitizeUser(user),
    token: createAccessToken(user),
  };
}

export async function login(input: { email: string; senha: string }) {
  const user = await prisma.usuario.findUnique({
    where: { email: input.email },
    include: {
      perfis: true,
    },
  });

  if (!user) {
    return { error: "INVALID_CREDENTIALS" as const };
  }

  if (user.statusConta === StatusConta.BLOQUEADA) {
    return { error: "ACCOUNT_BLOCKED" as const };
  }

  const passwordMatches = await bcrypt.compare(input.senha, user.senhaHash);

  if (!passwordMatches) {
    return { error: "INVALID_CREDENTIALS" as const };
  }

  return {
    user: sanitizeUser(user),
    token: createAccessToken(user),
  };
}

export async function getAuthenticatedUser(userId: string) {
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    include: {
      perfis: true,
    },
  });

  if (!user) {
    return null;
  }

  return sanitizeUser(user);
}

export async function listUserParticipations(userId: string): Promise<ParticipacaoResumo[]> {
  const participacoes = await prisma.participacaoEdital.findMany({
    where: { usuarioId: userId },
    include: {
      edital: true,
      inscricao: true,
      pedidoIsencao: true,
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  return participacoes.map((participacao) => ({
    id: participacao.id,
    status: participacao.status,
    edital: {
      id: participacao.edital.id,
      numero: participacao.edital.numero,
      titulo: participacao.edital.titulo,
      cursoNivel: participacao.edital.cursoNivel,
      status: participacao.edital.status,
    },
    inscricao: participacao.inscricao
      ? {
          id: participacao.inscricao.id,
          status: participacao.inscricao.status,
        }
      : null,
    pedidoIsencao: participacao.pedidoIsencao
      ? {
          id: participacao.pedidoIsencao.id,
          status: participacao.pedidoIsencao.status,
        }
      : null,
  }));
}
