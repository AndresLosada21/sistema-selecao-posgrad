import assert from "node:assert/strict";
import test from "node:test";

import { CursoNivel, Role, StatusConta, StatusEdital } from "@prisma/client";
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
