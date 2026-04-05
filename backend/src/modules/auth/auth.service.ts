import { Role, StatusConta } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { sendOperationalNotification } from "../operacao/notification.service.js";

import type { AuthenticatedUser, ParticipacaoResumo } from "./auth.types.js";

function sanitizeUser(user: {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  emailVerificadoEm?: Date | null;
  statusConta: StatusConta;
  perfis: { role: Role }[];
}): AuthenticatedUser {
  return {
    id: user.id,
    nomeCompleto: user.nomeCompleto,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    emailVerificadoEm: user.emailVerificadoEm?.toISOString() ?? null,
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
  const existingUser = await prisma.usuario.findFirst({
    where: {
      OR: [
        { email: input.email },
        ...(input.cpf ? [{ cpf: input.cpf }] : []),
      ],
    },
  });

  if (existingUser) {
    return {
      error: existingUser.email === input.email ? ("EMAIL_ALREADY_IN_USE" as const) : ("CPF_ALREADY_IN_USE" as const),
    };
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

type OneTimeTokenPurpose = "PASSWORD_RESET" | "EMAIL_VERIFICATION";

function buildCredentialFingerprint(senhaHash: string) {
  return createHash("sha256").update(senhaHash).digest("hex").slice(0, 16);
}

function createOneTimeToken(user: { id: string; email: string; senhaHash: string }, purpose: OneTimeTokenPurpose, expiresIn: string) {
  return jwt.sign({ email: user.email, purpose, credentialFingerprint: buildCredentialFingerprint(user.senhaHash) }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
  });
}

async function resolveOneTimeToken(token: string, purpose: OneTimeTokenPurpose) {
  const payload = jwt.verify(token, env.JWT_SECRET) as {
    sub?: string;
    purpose?: string;
    credentialFingerprint?: string;
  };

  if (!payload.sub || payload.purpose !== purpose || !payload.credentialFingerprint) {
    return null;
  }

  const user = await prisma.usuario.findUnique({ where: { id: payload.sub }, include: { perfis: true } });

  if (!user) {
    return null;
  }

  if (buildCredentialFingerprint(user.senhaHash) !== payload.credentialFingerprint) {
    return null;
  }

  return user;
}

export async function ensureUserParticipation(editalId: string, userId: string) {
  const participacao = await prisma.participacaoEdital.upsert({
    where: {
      usuarioId_editalId: {
        usuarioId: userId,
        editalId,
      },
    },
    update: {},
    create: {
      usuarioId: userId,
      editalId,
      status: "ATIVA",
    },
    include: {
      edital: true,
      inscricao: true,
      pedidoIsencao: true,
    },
  });

  return {
    id: participacao.id,
    status: participacao.status,
    edital: {
      id: participacao.edital.id,
      numero: participacao.edital.numero,
      titulo: participacao.edital.titulo,
      cursoNivel: participacao.edital.cursoNivel,
      status: participacao.edital.status,
    },
    inscricao: participacao.inscricao ? { id: participacao.inscricao.id, status: participacao.inscricao.status } : null,
    pedidoIsencao: participacao.pedidoIsencao ? { id: participacao.pedidoIsencao.id, status: participacao.pedidoIsencao.status } : null,
  } satisfies ParticipacaoResumo;
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.usuario.findUnique({ where: { email } });

  if (!user || user.statusConta === StatusConta.BLOQUEADA) {
    return { accepted: true as const };
  }

  const token = createOneTimeToken(user, "PASSWORD_RESET", "30m");
  await sendOperationalNotification({ to: user.email, subject: "Recuperacao de senha do portal", text: `Use o token a seguir para redefinir sua senha: ${token}` });

  return {
    accepted: true as const,
    resetTokenPreview: env.NODE_ENV === "production" ? undefined : token,
  };
}

export async function confirmPasswordReset(input: { token: string; senha: string }) {
  const user = await resolveOneTimeToken(input.token, "PASSWORD_RESET");

  if (!user) {
    return { error: "INVALID_OR_EXPIRED_TOKEN" as const };
  }

  const senhaHash = await bcrypt.hash(input.senha, 10);
  await prisma.usuario.update({ where: { id: user.id }, data: { senhaHash, statusConta: StatusConta.ATIVA } });
  return { accepted: true as const };
}

export async function requestEmailVerification(userId: string) {
  const user = await prisma.usuario.findUnique({ where: { id: userId } });

  if (!user) {
    return null;
  }

  const token = createOneTimeToken(user, "EMAIL_VERIFICATION", "24h");
  await sendOperationalNotification({ to: user.email, subject: "Verificacao de e-mail do portal", text: `Use o token a seguir para verificar seu e-mail: ${token}` });
  return {
    accepted: true as const,
    verificationTokenPreview: env.NODE_ENV === "production" ? undefined : token,
  };
}

export async function confirmEmailVerification(token: string) {
  const user = await resolveOneTimeToken(token, "EMAIL_VERIFICATION");

  if (!user) {
    return { error: "INVALID_OR_EXPIRED_TOKEN" as const };
  }

  await prisma.usuario.update({ where: { id: user.id }, data: { emailVerificadoEm: new Date(), statusConta: StatusConta.ATIVA } });
  return { accepted: true as const };
}
