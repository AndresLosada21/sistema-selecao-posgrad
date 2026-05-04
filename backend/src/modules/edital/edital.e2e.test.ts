import assert from "node:assert/strict";
import test from "node:test";

import { CursoNivel, Role, StatusConta, StatusEdital, TipoCronogramaEdital } from "@prisma/client";
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

async function createCandidate(suffix: string) {
  const senhaHash = await bcrypt.hash("Senha123456", 10);

  return prisma.usuario.create({
    data: {
      nomeCompleto: `Candidato ${suffix}`,
      email: `candidato.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
    },
  });
}

test("lista publica de editais respeita total paginado e bloqueia rascunhos", async () => {
  const suffix = `edital-list-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);
  const now = new Date();

  const createdEditais: string[] = [];

  try {
    const draft = await prisma.edital.create({
      data: {
        numero: `RAS-${suffix}`,
        titulo: `Edital rascunho ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
        criadoPorId: admin.id,
      },
    });
    createdEditais.push(draft.id);

    const publicado = await prisma.edital.create({
      data: {
        numero: `PUB-${suffix}`,
        titulo: `Edital publicado ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: now,
        criadoPorId: admin.id,
      },
    });
    createdEditais.push(publicado.id);

    const emAndamento = await prisma.edital.create({
      data: {
        numero: `AND-${suffix}`,
        titulo: `Edital em andamento ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.EM_ANDAMENTO,
        publicadoEm: now,
        criadoPorId: admin.id,
      },
    });
    createdEditais.push(emAndamento.id);

    const publicList = await request(app).get(`/v1/editais?status=PUBLICADO,EM_ANDAMENTO&q=${suffix}&page=1&pageSize=1`);
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.total, 2);
    assert.equal(publicList.body.page, 1);
    assert.equal(publicList.body.pageSize, 1);
    assert.equal(publicList.body.items.length, 1);
    assert.equal(publicList.body.items[0].status === StatusEdital.PUBLICADO || publicList.body.items[0].status === StatusEdital.EM_ANDAMENTO, true);

    const draftFilter = await request(app).get(`/v1/editais?status=RASCUNHO&q=${suffix}&page=1&pageSize=10`);
    assert.equal(draftFilter.status, 403);
    assert.equal(draftFilter.body.code, "FORBIDDEN");

    const adminDraftList = await request(app)
      .get(`/v1/admin/editais?status=RASCUNHO&q=${suffix}&page=1&pageSize=10`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminDraftList.status, 200);
    assert.equal(adminDraftList.body.total, 1);
    assert.equal(adminDraftList.body.items.length, 1);
    assert.equal(adminDraftList.body.items[0].id, draft.id);
    assert.equal(adminDraftList.body.items[0].status, StatusEdital.RASCUNHO);
  } finally {
    if (createdEditais.length) {
      await prisma.edital.deleteMany({ where: { id: { in: createdEditais } } });
    }

    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});

test("backend bloqueia publicacao de edital sem estrutura minima e cronograma duplicado por tipo", async () => {
  const suffix = `edital-guard-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);

  let editalId = "";
  let linhaId = "";
  try {
    const created = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `RASC-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
      });

    assert.equal(created.status, 201);
    editalId = created.body.id;

    const publishWithoutStructure = await request(app)
      .put(`/v1/admin/editais/${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `RASC-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
      });

    assert.equal(publishWithoutStructure.status, 409);

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

    const cronograma1 = await request(app)
      .post(`/v1/admin/editais/${editalId}/cronogramas`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: TipoCronogramaEdital.INSCRICAO,
        titulo: "Inscricao",
        inicioEm: new Date(Date.now() + 60_000).toISOString(),
        fimEm: new Date(Date.now() + 120_000).toISOString(),
      });
    assert.equal(cronograma1.status, 201);

    const cronogramaDuplicado = await request(app)
      .post(`/v1/admin/editais/${editalId}/cronogramas`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: TipoCronogramaEdital.INSCRICAO,
        titulo: "Inscricao duplicada",
        inicioEm: new Date(Date.now() + 180_000).toISOString(),
        fimEm: new Date(Date.now() + 240_000).toISOString(),
      });
    assert.equal(cronogramaDuplicado.status, 409);
  } finally {
    if (editalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});

test("admin recebe codigo e mensagem especificos ao editar cronograma de edital operacionalizado", async () => {
  const suffix = `edital-cronograma-guard-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const candidato = await createCandidate(suffix);
  const adminToken = createToken(admin.id, admin.email);

  const edital = await prisma.edital.create({
    data: {
      numero: `OPER-${suffix}`,
      titulo: `Edital operacionalizado ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.DOUTORADO,
      status: StatusEdital.EM_ANDAMENTO,
      publicadoEm: new Date(),
      criadoPorId: admin.id,
    },
  });

  const cronograma = await prisma.cronogramaEdital.create({
    data: {
      editalId: edital.id,
      tipo: TipoCronogramaEdital.INSCRICAO,
      titulo: "Inscricao online doutorado",
      inicioEm: new Date("2026-04-16T23:13:00.000Z"),
      fimEm: new Date("2026-04-29T23:13:00.000Z"),
    },
  });

  const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId: edital.id } });

  try {
    const response = await request(app)
      .put(`/v1/admin/editais/${edital.id}/cronogramas/${cronograma.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: TipoCronogramaEdital.INSCRICAO,
        titulo: "Inscricao online doutorado",
        inicioEm: new Date("2026-04-16T23:13:00.000Z").toISOString(),
        fimEm: new Date("2026-04-29T23:13:00.000Z").toISOString(),
      });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "EDITAL_ESTRUTURA_BLOQUEADA");
    assert.equal(response.body.message, "Nao e permitido alterar estrutura de linhas ou cronogramas em edital ja operacionalizado. Use retificacao/publicacao apropriada.");
  } finally {
    await prisma.participacaoEdital.deleteMany({ where: { id: participacao.id } });
    await prisma.cronogramaEdital.deleteMany({ where: { id: cronograma.id } });
    await prisma.edital.deleteMany({ where: { id: edital.id } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidato.id] } } });
  }
});
