import assert from "node:assert/strict";
import test from "node:test";

import { Role, StatusConta } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-real-environments";

const { prisma } = await import("../../lib/prisma.js");
const { app } = await import("../../app.js");

function createToken(userId: string, email: string, expiresIn: SignOptions["expiresIn"] = "7d") {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { subject: userId, expiresIn });
}

async function createUser(input: {
  suffix: string;
  role: Role;
  statusConta?: StatusConta;
  senha?: string;
}) {
  const senha = input.senha ?? "Senha123456";
  const senhaHash = await bcrypt.hash(senha, 10);

  return prisma.usuario.create({
    data: {
      nomeCompleto: `${input.role} ${input.suffix}`,
      email: `${input.role.toLowerCase()}.${input.suffix}@teste.local`,
      senhaHash,
      statusConta: input.statusConta ?? StatusConta.ATIVA,
      perfis: { create: [{ role: input.role }] },
    },
  });
}

async function cleanupUsers(ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
}

test("register, login e me funcionam para conta ativa", async () => {
  const suffix = `auth-register-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let userId = "";

  try {
    const registerResponse = await request(app)
      .post("/v1/auth/register")
      .send({
        nomeCompleto: `Candidato ${suffix}`,
        email: `candidato.${suffix}@teste.local`,
        senha: "Senha123456",
        telefone: "92999999999",
        cpf: `${Date.now()}`.slice(-11),
      });

    assert.equal(registerResponse.status, 201);
    assert.equal(registerResponse.body.user.statusConta, StatusConta.ATIVA);
    userId = registerResponse.body.user.id;

    const loginResponse = await request(app)
      .post("/v1/auth/login")
      .send({ email: `candidato.${suffix}@teste.local`, senha: "Senha123456" });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.user.id, userId);

    const meResponse = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);

    assert.equal(meResponse.status, 200);
    assert.equal(meResponse.body.id, userId);
    assert.equal(meResponse.body.email, `candidato.${suffix}@teste.local`);
  } finally {
    if (userId) {
      await cleanupUsers([userId]);
    }
  }
});

test("login de conta bloqueada retorna 401", async () => {
  const suffix = `auth-blocked-login-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const user = await createUser({ suffix, role: Role.CANDIDATO, statusConta: StatusConta.BLOQUEADA });

  try {
    const response = await request(app)
      .post("/v1/auth/login")
      .send({ email: user.email, senha: "Senha123456" });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "ACCOUNT_BLOCKED");
    assert.equal(response.body.message, "Conta bloqueada. Procure a secretaria do programa.");
  } finally {
    await cleanupUsers([user.id]);
  }
});

test("rota protegida rejeita ausencia de bearer, token malformado e token expirado", async () => {
  const suffix = `auth-invalid-token-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const user = await createUser({ suffix, role: Role.CANDIDATO });

  try {
    const noBearerResponse = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", createToken(user.id, user.email));

    assert.equal(noBearerResponse.status, 401);
    assert.equal(noBearerResponse.body.code, "UNAUTHORIZED");
    assert.equal(noBearerResponse.body.message, "Autenticacao obrigatoria.");

    const malformedResponse = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", "Bearer token-invalido");

    assert.equal(malformedResponse.status, 401);
    assert.equal(malformedResponse.body.code, "INVALID_TOKEN");
    assert.equal(malformedResponse.body.message, "Token invalido ou expirado.");

    const expiredResponse = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${createToken(user.id, user.email, "-1s")}`);

    assert.equal(expiredResponse.status, 401);
    assert.equal(expiredResponse.body.code, "INVALID_TOKEN");
    assert.equal(expiredResponse.body.message, "Token invalido ou expirado.");
  } finally {
    await cleanupUsers([user.id]);
  }
});

test("token emitido antes do bloqueio deixa de funcionar em rotas protegidas", async () => {
  const suffix = `auth-block-after-token-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser({ suffix, role: Role.ADMIN });
  const token = createToken(admin.id, admin.email);

  try {
    await prisma.usuario.update({
      where: { id: admin.id },
      data: { statusConta: StatusConta.BLOQUEADA },
    });

    const meResponse = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(meResponse.status, 401);
    assert.equal(meResponse.body.code, "SESSION_INVALID");
    assert.equal(meResponse.body.message, "Sessao invalida ou conta indisponivel.");

    const adminResponse = await request(app)
      .get("/v1/admin/homologacao/fundamentos")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(adminResponse.status, 401);
    assert.equal(adminResponse.body.code, "SESSION_INVALID");
    assert.equal(adminResponse.body.message, "Sessao invalida ou conta indisponivel.");

    const dashboardResponse = await request(app)
      .get("/v1/candidato/area")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(dashboardResponse.status, 401);
    assert.equal(dashboardResponse.body.code, "SESSION_INVALID");
    assert.equal(dashboardResponse.body.message, "Sessao invalida ou conta indisponivel.");
  } finally {
    await cleanupUsers([admin.id]);
  }
});

test("token de usuario removido deixa de funcionar", async () => {
  const suffix = `auth-deleted-user-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const user = await createUser({ suffix, role: Role.CANDIDATO });
  const token = createToken(user.id, user.email);

  await cleanupUsers([user.id]);

  const response = await request(app)
    .get("/v1/auth/me")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 401);
  assert.equal(response.body.code, "SESSION_INVALID");
  assert.equal(response.body.message, "Sessao invalida ou conta indisponivel.");
});
