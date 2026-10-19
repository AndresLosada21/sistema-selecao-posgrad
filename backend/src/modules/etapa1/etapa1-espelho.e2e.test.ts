import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  ModalidadeConcorrencia,
  Role,
  StatusAvaliacaoEtapa,
  StatusConta,
  StatusEdital,
  StatusInscricao,
  TipoCronogramaEdital,
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

function createToken(userId: string, email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { subject: userId, expiresIn: "7d" });
}

async function createAdmin(suffix: string) {
  return prisma.usuario.create({
    data: {
      nomeCompleto: `Admin ${suffix}`,
      email: `admin.${suffix}@teste.local`,
      senhaHash: await bcrypt.hash("Senha123456", 10),
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role: Role.ADMIN }] },
    },
  });
}

async function createCandidato(suffix: string) {
  return prisma.usuario.create({
    data: {
      nomeCompleto: `Candidato ${suffix}`,
      email: `candidato.${suffix}@teste.local`,
      senhaHash: await bcrypt.hash("Senha123456", 10),
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role: Role.CANDIDATO }] },
    },
  });
}

type Janela = { tipo: TipoCronogramaEdital; inicioEm: Date; fimEm: Date };

async function createEspelhoScenario(input: { suffix: string; janelas: Janela[] }) {
  const admin = await createAdmin(input.suffix);
  const candidato = await createCandidato(input.suffix);

  const edital = await prisma.edital.create({
    data: {
      numero: `ESP-${input.suffix}`,
      titulo: `Edital espelho ${input.suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.DOUTORADO,
      status: StatusEdital.PUBLICADO,
      publicadoEm: new Date(),
      criadoPorId: admin.id,
    },
  });

  const linha = await prisma.linhaPesquisa.create({
    data: {
      editalId: edital.id,
      nome: `Linha ${input.suffix}`,
      vagasAmplaConcorrencia: 1,
      vagasAcoesAfirmativas: 0,
      vagasPcd: 0,
    },
  });

  const participacao = await prisma.participacaoEdital.create({
    data: { usuarioId: candidato.id, editalId: edital.id },
  });

  const inscricao = await prisma.inscricao.create({
    data: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: linha.id,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      status: StatusInscricao.HOMOLOGADA_FINAL,
      avaliacaoEtapa1: {
        create: {
          editalId: edital.id,
          status: StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA,
          nota: 8,
          espelhoCorrecao: "Parecer consolidado da banca.",
          resultadoPreliminarEm: new Date(),
        },
      },
    },
  });

  for (const janela of input.janelas) {
    await prisma.cronogramaEdital.create({
      data: {
        editalId: edital.id,
        tipo: janela.tipo,
        titulo: `Janela ${janela.tipo}`,
        inicioEm: janela.inicioEm,
        fimEm: janela.fimEm,
      },
    });
  }

  return {
    admin,
    candidato,
    edital,
    inscricao,
    token: createToken(candidato.id, candidato.email),
  };
}

async function cleanup(input: { editalId: string; usuarioIds: string[] }) {
  await prisma.edital.deleteMany({ where: { id: input.editalId } });
  await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: input.usuarioIds } } });
  await prisma.usuario.deleteMany({ where: { id: { in: input.usuarioIds } } });
}

function janelaAberta(tipo: TipoCronogramaEdital): Janela {
  const now = Date.now();
  return {
    tipo,
    inicioEm: new Date(now - 5 * 60_000),
    fimEm: new Date(now + 5 * 60_000),
  };
}

test("solicita espelho na janela propria da etapa 1", async () => {
  const suffix = `espelho-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const scenario = await createEspelhoScenario({
    suffix,
    janelas: [janelaAberta(TipoCronogramaEdital.ESPELHO_ETAPA_1)],
  });

  try {
    const response = await request(app)
      .post(`/v1/inscricoes/${scenario.inscricao.id}/etapa-1/espelho/solicitar`)
      .set("Authorization", `Bearer ${scenario.token}`);

    assert.equal(response.status, 200);
    assert.ok(response.body.espelhoSolicitadoEm);
  } finally {
    await cleanup({ editalId: scenario.edital.id, usuarioIds: [scenario.admin.id, scenario.candidato.id] });
  }
});

test("usa a janela de recurso como fallback quando nao existe fase de espelho", async () => {
  const suffix = `espelho-fallback-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const scenario = await createEspelhoScenario({
    suffix,
    janelas: [janelaAberta(TipoCronogramaEdital.RECURSO_ETAPA_1)],
  });

  try {
    const response = await request(app)
      .post(`/v1/inscricoes/${scenario.inscricao.id}/etapa-1/espelho/solicitar`)
      .set("Authorization", `Bearer ${scenario.token}`);

    assert.equal(response.status, 200);
    assert.ok(response.body.espelhoSolicitadoEm);
  } finally {
    await cleanup({ editalId: scenario.edital.id, usuarioIds: [scenario.admin.id, scenario.candidato.id] });
  }
});

test("recusa solicitacao quando nem espelho nem recurso estao abertos", async () => {
  const suffix = `espelho-bloqueado-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const scenario = await createEspelhoScenario({ suffix, janelas: [] });

  try {
    const response = await request(app)
      .post(`/v1/inscricoes/${scenario.inscricao.id}/etapa-1/espelho/solicitar`)
      .set("Authorization", `Bearer ${scenario.token}`);

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "JANELA_RECURSO_ETAPA_1_FECHADA");
  } finally {
    await cleanup({ editalId: scenario.edital.id, usuarioIds: [scenario.admin.id, scenario.candidato.id] });
  }
});
