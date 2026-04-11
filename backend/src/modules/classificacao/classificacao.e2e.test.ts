import assert from "node:assert/strict";
import test from "node:test";

import { CursoNivel, ModalidadeConcorrencia, Role, StatusConta, StatusEdital, StatusInscricao } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-real-environments";

const { prisma } = await import("../../lib/prisma.js");
const { app } = await import("../../app.js");

function createToken(userId: string, email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { subject: userId, expiresIn: "7d" });
}

async function createAdmin(suffix: string) {
  const senhaHash = await bcrypt.hash("Senha123456", 10);
  return prisma.usuario.create({
    data: {
      nomeCompleto: `Admin ${suffix}`,
      email: `admin.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role: Role.ADMIN }] },
    },
  });
}

test("recalculo da classificacao falha quando ainda existe contexto incompleto", async () => {
  const suffix = `classificacao-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);

  let editalId = "";
  let linhaId = "";
  let participacaoId = "";
  let inscricaoId = "";
  let candidatoId = "";

  try {
    const edital = await prisma.edital.create({
      data: {
        numero: `CL-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: new Date(),
        criadoPorId: admin.id,
      },
    });
    editalId = edital.id;

    const linha = await prisma.linhaPesquisa.create({
      data: {
        editalId,
        nome: `Linha ${suffix}`,
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 0,
        vagasPcd: 0,
      },
    });
    linhaId = linha.id;

    const candidato = await prisma.usuario.create({
      data: {
        nomeCompleto: `Candidato ${suffix}`,
        email: `candidato.${suffix}@teste.local`,
        senhaHash: await bcrypt.hash("Senha123456", 10),
        statusConta: StatusConta.ATIVA,
        perfis: { create: [{ role: Role.CANDIDATO }] },
      },
    });
    candidatoId = candidato.id;

    const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId } });
    participacaoId = participacao.id;

    const inscricao = await prisma.inscricao.create({
      data: {
        participacaoEditalId: participacaoId,
        linhaPesquisaId: linhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        status: StatusInscricao.CLASSIFICACAO_PRELIMINAR,
      },
    });
    inscricaoId = inscricao.id;

    const recalculo = await request(app)
      .post(`/v1/admin/editais/${editalId}/classificacao/recalcular`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ publicacao: "PRELIMINAR" });

    assert.equal(recalculo.status, 409);
    assert.equal(recalculo.body.code, "CLASSIFICACAO_CONTEXTO_INCOMPLETO");
    assert.ok(Array.isArray(recalculo.body.details));
  } finally {
    if (inscricaoId) await prisma.inscricao.deleteMany({ where: { id: inscricaoId } });
    if (participacaoId) await prisma.participacaoEdital.deleteMany({ where: { id: participacaoId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [admin.id, candidatoId].filter(Boolean) } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidatoId].filter(Boolean) } } });
  }
});
