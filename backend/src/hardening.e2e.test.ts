import assert from "node:assert/strict";
import test from "node:test";

import { Role, StatusConta } from "@prisma/client";
import bcrypt from "bcryptjs";
import request from "supertest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-real-environments";

const { prisma } = await import("./lib/prisma.js");
const { app } = await import("./app.js");

async function createCandidate(suffix: string) {
  const senhaHash = await bcrypt.hash("Senha123456", 10);

  return prisma.usuario.create({
    data: {
      nomeCompleto: `Candidato ${suffix}`,
      email: `candidate.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role: Role.CANDIDATO }] },
    },
  });
}

async function cleanupUser(userId: string) {
  await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: userId } });
  await prisma.usuario.deleteMany({ where: { id: userId } });
}

test("docs seguem acessiveis com headers basicos de seguranca", async () => {
  const response = await request(app).get("/docs/openapi.json");

  assert.equal(response.status, 200);
  assert.equal(response.headers["x-powered-by"], undefined);
  assert.equal(response.headers["x-dns-prefetch-control"], "off");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.body.openapi.startsWith("3."), true);
});

test("payload acima do limite retorna 413 com resposta json", async () => {
  const hugeValue = "A".repeat(1_200_000);

  const response = await request(app)
    .post("/v1/auth/register")
    .send({
      nomeCompleto: hugeValue,
      email: "payload.grande@teste.local",
      senha: "Senha123456",
    });

  assert.equal(response.status, 413);
  assert.equal(response.body.code, "PAYLOAD_TOO_LARGE");
  assert.equal(response.body.message, "Payload excede o limite permitido.");
  assert.equal(response.headers["content-type"].includes("application/json"), true);
});

test("rate limit bloqueia repeticao de login invalido para a mesma chave", async () => {
  const suffix = `rate-limit-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const candidate = await createCandidate(suffix);

  try {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app)
        .post("/v1/auth/login")
        .send({ email: candidate.email, senha: "SenhaErrada123" });

      assert.equal(response.status, 401);
    }

    const limitedResponse = await request(app)
      .post("/v1/auth/login")
      .send({ email: candidate.email, senha: "SenhaErrada123" });

    assert.equal(limitedResponse.status, 429);
    assert.equal(limitedResponse.body.code, "RATE_LIMITED");
    assert.equal(limitedResponse.body.message, "Muitas tentativas consecutivas. Tente novamente em instantes.");
    assert.equal(limitedResponse.headers["ratelimit-limit"], "5");
  } finally {
    await cleanupUser(candidate.id);
  }
});
