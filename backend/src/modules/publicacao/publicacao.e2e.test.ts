import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  ModalidadeConcorrencia,
  Role,
  StatusClassificacaoFinal,
  StatusConta,
  StatusEdital,
  StatusInscricao,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-real-environments";

const { prisma } = await import("../../lib/prisma.js");
const { app } = await import("../../app.js");

type E2eContext = {
  adminId: string;
  candidatoId: string;
  editalId: string;
  linhaId: string;
  participacaoId: string;
  inscricaoId: string;
};

function parseBinaryResponse(response: any, callback: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];

  response.on("data", (chunk: Buffer | string) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  response.on("end", () => {
    callback(null, Buffer.concat(chunks));
  });
  response.on("error", (error: Error) => {
    callback(error);
  });
}

function createToken(userId: string, email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, {
    subject: userId,
    expiresIn: "7d",
  });
}

async function createE2eContext(): Promise<E2eContext> {
  const suffix = `e2e-publicacao-${Date.now()}`;
  const senhaHash = await bcrypt.hash("Senha123456", 10);

  const admin = await prisma.usuario.create({
    data: {
      nomeCompleto: `Admin ${suffix}`,
      email: `admin.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: {
        create: [{ role: Role.ADMIN }],
      },
    },
  });

  const candidato = await prisma.usuario.create({
    data: {
      nomeCompleto: `Candidato ${suffix}`,
      email: `candidato.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: {
        create: [{ role: Role.CANDIDATO }],
      },
    },
  });

  const edital = await prisma.edital.create({
    data: {
      numero: `E2E-${Date.now()}`,
      titulo: `Edital ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.PUBLICADO,
      publicadoEm: new Date(),
      criadoPorId: admin.id,
    },
  });

  const linha = await prisma.linhaPesquisa.create({
    data: {
      editalId: edital.id,
      nome: `Linha ${suffix}`,
      vagasAmplaConcorrencia: 1,
      vagasAcoesAfirmativas: 1,
      vagasPcd: 0,
    },
  });

  const participacao = await prisma.participacaoEdital.create({
    data: {
      usuarioId: candidato.id,
      editalId: edital.id,
    },
  });

  const inscricao = await prisma.inscricao.create({
    data: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: linha.id,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      status: StatusInscricao.APROVADA,
      dadosFormulario: {
        nomeCompleto: candidato.nomeCompleto,
        email: candidato.email,
      },
      submetidaEm: new Date(),
    },
  });

  await prisma.classificacaoFinal.create({
    data: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: linha.id,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      notaEtapa1: 8.5,
      notaEtapa2: 9,
      notaFinal: 8.83,
      posicaoGeral: 1,
      posicaoLinha: 1,
      status: StatusClassificacaoFinal.APROVADO,
      publicadoFinalEm: new Date(),
    },
  });

  return {
    adminId: admin.id,
    candidatoId: candidato.id,
    editalId: edital.id,
    linhaId: linha.id,
    participacaoId: participacao.id,
    inscricaoId: inscricao.id,
  };
}

async function cleanupE2eContext(context: E2eContext) {
  await prisma.publicacaoOficial.deleteMany({ where: { editalId: context.editalId } });
  await prisma.classificacaoFinal.deleteMany({ where: { participacaoEditalId: context.participacaoId } });
  await prisma.inscricao.deleteMany({ where: { id: context.inscricaoId } });
  await prisma.participacaoEdital.deleteMany({ where: { id: context.participacaoId } });
  await prisma.linhaPesquisa.deleteMany({ where: { id: context.linhaId } });
  await prisma.edital.deleteMany({ where: { id: context.editalId } });
  await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [context.adminId, context.candidatoId] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [context.adminId, context.candidatoId] } } });
}

test("cria publicacao de classificacao e gera PDF oficial", async () => {
  const context = await createE2eContext();

  try {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: context.adminId } });
    const adminToken = createToken(admin.id, admin.email);

    const createResponse = await request(app)
      .post(`/v1/admin/editais/${context.editalId}/publicacoes/classificacao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        fase: "FINAL",
        descricao: "Publicacao E2E de classificacao final.",
      });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.publicacao.versao, 1);
    assert.equal(createResponse.body.preview.tipo, "CLASSIFICACAO_FINAL");

    const listResponse = await request(app).get(`/v1/editais/${context.editalId}/publicacoes`);

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.total, 1);
    assert.equal(listResponse.body.items[0].arquivoUrl, `/v1/publicacoes/${createResponse.body.publicacao.id}/arquivo.pdf`);

    const pdfResponse = await request(app)
      .get(`/v1/publicacoes/${createResponse.body.publicacao.id}/arquivo.pdf`)
      .buffer(true)
      .parse(parseBinaryResponse);

    assert.equal(pdfResponse.status, 200);
    assert.equal(pdfResponse.headers["content-type"], "application/pdf");
    assert.equal(Buffer.isBuffer(pdfResponse.body), true);
    assert.equal(pdfResponse.body.subarray(0, 4).toString(), "%PDF");
  } finally {
    await cleanupE2eContext(context);
  }
});

test("dashboard do candidato expõe publicacoes destacadas e historico versionado", async () => {
  const context = await createE2eContext();

  try {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: context.adminId } });
    const candidato = await prisma.usuario.findUniqueOrThrow({ where: { id: context.candidatoId } });
    const adminToken = createToken(admin.id, admin.email);
    const candidatoToken = createToken(candidato.id, candidato.email);

    const first = await request(app)
      .post(`/v1/admin/editais/${context.editalId}/publicacoes/classificacao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fase: "FINAL", descricao: "Primeira versao E2E." });

    assert.equal(first.status, 201);

    const second = await request(app)
      .post(`/v1/admin/editais/${context.editalId}/publicacoes/classificacao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fase: "FINAL", descricao: "Segunda versao E2E." });

    assert.equal(second.status, 201);
    assert.equal(second.body.publicacao.versao, 2);
    assert.equal(second.body.publicacao.republicacaoDeId, first.body.publicacao.id);

    const dashboardResponse = await request(app)
      .get("/v1/candidato/area")
      .set("Authorization", `Bearer ${candidatoToken}`);

    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboardResponse.body.total, 1);

    const item = dashboardResponse.body.items[0];
    assert.equal(item.publicacoes.length, 2);

    const destaque = item.publicacoesDestaque.find((entry: { tipo: string }) => entry.tipo === "CLASSIFICACAO_FINAL");
    assert.ok(destaque);
    assert.equal(destaque.versao, 2);
    assert.equal(destaque.republicacaoDeId, first.body.publicacao.id);
    assert.equal(destaque.arquivoUrl, `/v1/publicacoes/${second.body.publicacao.id}/arquivo.pdf`);
  } finally {
    await cleanupE2eContext(context);
  }
});
