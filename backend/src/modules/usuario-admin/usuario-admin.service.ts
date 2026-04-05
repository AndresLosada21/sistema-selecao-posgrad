import { Role, StatusConta } from "@prisma/client";

import { conflict, notFound } from "../../lib/http-errors.js";
import { prisma } from "../../lib/prisma.js";
import { recordAuditEvent } from "../operacao/audit.service.js";

type UsuarioAdminWithPerfis = {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  emailVerificadoEm: Date | null;
  statusConta: StatusConta;
  criadoEm: Date;
  atualizadoEm: Date;
  perfis: Array<{ role: Role }>;
  escoposAvaliacao: Array<{ editalId: string; linhaPesquisaId: string | null }>;
};

function mapUsuario(usuario: UsuarioAdminWithPerfis) {
  return {
    id: usuario.id,
    nomeCompleto: usuario.nomeCompleto,
    email: usuario.email,
    cpf: usuario.cpf,
    telefone: usuario.telefone,
    emailVerificadoEm: usuario.emailVerificadoEm?.toISOString() ?? null,
    statusConta: usuario.statusConta,
    perfis: usuario.perfis.map((perfil) => perfil.role),
    escoposAvaliacao: usuario.escoposAvaliacao.map((escopo) => ({
      editalId: escopo.editalId,
      linhaPesquisaId: escopo.linhaPesquisaId,
    })),
    criadoEm: usuario.criadoEm.toISOString(),
    atualizadoEm: usuario.atualizadoEm.toISOString(),
  };
}

export async function listUsuariosAdmin(pagination?: { page: number; pageSize: number }) {
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 20;

  const [usuarios, total] = await prisma.$transaction([
    prisma.usuario.findMany({
      include: { perfis: true, escoposAvaliacao: true } as any,
      orderBy: { criadoEm: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.usuario.count(),
  ]);

  return {
    items: (usuarios as unknown as UsuarioAdminWithPerfis[]).map((usuario) => mapUsuario(usuario)),
    total,
    page,
    pageSize,
  };
}

export async function updateUsuarioStatus(usuarioId: string, statusConta: StatusConta) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { perfis: true, escoposAvaliacao: true } as any }) as unknown as UsuarioAdminWithPerfis | null;
  if (!usuario) throw notFound("Usuario nao encontrado.", "USUARIO_NAO_ENCONTRADO");
  const updated = await prisma.usuario.update({ where: { id: usuarioId }, data: { statusConta }, include: { perfis: true, escoposAvaliacao: true } as any }) as unknown as UsuarioAdminWithPerfis;
  await recordAuditEvent({ entidade: "USUARIO", entidadeId: usuarioId, acao: "USUARIO_STATUS_ATUALIZADO", descricao: `Status alterado para ${statusConta}.` });
  return mapUsuario(updated);
}

export async function updateUsuarioPerfis(usuarioId: string, perfis: Role[], actorUserId: string) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { perfis: true, escoposAvaliacao: true } as any }) as unknown as UsuarioAdminWithPerfis | null;
  if (!usuario) throw notFound("Usuario nao encontrado.", "USUARIO_NAO_ENCONTRADO");

  if (!perfis.includes(Role.ADMIN) && usuario.perfis.some((perfil) => perfil.role === Role.ADMIN)) {
    const adminCount = await prisma.usuarioPerfil.count({ where: { role: Role.ADMIN } });
    if (adminCount <= 1) {
      throw conflict("Nao e permitido remover o ultimo admin do sistema.", "LAST_ADMIN_PROTECTED");
    }
  }

  if (usuarioId === actorUserId && !perfis.includes(Role.ADMIN)) {
    throw conflict("Nao e permitido remover o proprio perfil admin durante a sessao atual.", "SELF_ADMIN_PROTECTED");
  }

  await prisma.usuarioPerfil.deleteMany({ where: { usuarioId } });
  await prisma.usuarioPerfil.createMany({ data: perfis.map((role) => ({ usuarioId, role })) });
  if (!perfis.includes(Role.AVALIADOR)) {
    await (prisma as any).avaliadorEscopo.deleteMany({ where: { usuarioId } });
  }
  const updated = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, include: { perfis: true, escoposAvaliacao: true } as any }) as unknown as UsuarioAdminWithPerfis;
  await recordAuditEvent({ entidade: "USUARIO", entidadeId: usuarioId, acao: "USUARIO_PERFIS_ATUALIZADOS", descricao: "Perfis operacionais atualizados.", payload: { perfis } });
  return mapUsuario(updated);
}

export async function updateUsuarioEscoposAvaliacao(usuarioId: string, escopos: Array<{ editalId: string; linhaPesquisaId?: string | null }>) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, include: { perfis: true, escoposAvaliacao: true } as any }) as unknown as UsuarioAdminWithPerfis | null;
  if (!usuario) throw notFound("Usuario nao encontrado.", "USUARIO_NAO_ENCONTRADO");
  if (!usuario.perfis.some((perfil) => perfil.role === Role.AVALIADOR)) {
    throw conflict("O usuario precisa possuir perfil AVALIADOR para receber escopos de avaliacao.", "USER_NOT_EVALUATOR");
  }

  await (prisma as any).avaliadorEscopo.deleteMany({ where: { usuarioId } });
  if (escopos.length) {
    await (prisma as any).avaliadorEscopo.createMany({ data: escopos.map((escopo) => ({ usuarioId, editalId: escopo.editalId, linhaPesquisaId: escopo.linhaPesquisaId ?? null })) });
  }

  const updated = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, include: { perfis: true, escoposAvaliacao: true } as any }) as unknown as UsuarioAdminWithPerfis;
  await recordAuditEvent({ entidade: "USUARIO", entidadeId: usuarioId, acao: "ESCOPOS_AVALIADOR_ATUALIZADOS", descricao: "Escopos de avaliacao atualizados.", payload: { escopos } });
  return mapUsuario(updated);
}
