import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  FaseRecurso,
  ModalidadeConcorrencia,
  Role,
  StatusConta,
  StatusEdital,
  StatusIsencao,
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

async function createUser(suffix: string, role: Role) {
  const senhaHash = await bcrypt.hash("Senha123456", 10);

  return prisma.usuario.create({
    data: {
      nomeCompleto: `${role} ${suffix}`,
      email: `${role.toLowerCase()}.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role }] },
    },
  });
}

test("janelas de edital bloqueiam inscricao, isencao e recurso fora do prazo", async () => {
  const suffix = `windows-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const candidato = await createUser(suffix, Role.CANDIDATO);
  const token = createToken(candidato.id, candidato.email);
  const now = new Date();

  const edital = await prisma.edital.create({
    data: {
      numero: `WIN-${suffix}`,
      titulo: `Edital ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.PUBLICADO,
      publicadoEm: now,
      criadoPorId: admin.id,
      cronogramas: {
        create: [TipoCronogramaEdital.INSCRICAO, TipoCronogramaEdital.PEDIDO_ISENCAO, TipoCronogramaEdital.RECURSO_ISENCAO].map((tipo) => ({
          tipo,
          titulo: tipo,
          inicioEm: new Date(now.getTime() - 120_000),
          fimEm: new Date(now.getTime() - 60_000),
        })),
      },
      temasRedacao: {
        create: [{ titulo: "Controle e automacao", descricao: "Tema", ordem: 0, ativo: true }],
      },
    },
    include: { temasRedacao: true },
  });

  const linha = await prisma.linhaPesquisa.create({
    data: { editalId: edital.id, nome: `Linha ${suffix}`, vagasAmplaConcorrencia: 1, vagasAcoesAfirmativas: 0, vagasPcd: 0 },
  });

  const inscricaoFechada = await request(app)
    .put(`/v1/editais/${edital.id}/inscricao/rascunho`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      linhaPesquisaId: linha.id,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      temaRedacaoEditalId: edital.temasRedacao[0].id,
      temaRedacao: edital.temasRedacao[0].titulo,
      redacaoTexto: "A".repeat(600),
      resumoCurriculo: "Resumo curricular.",
    });

  assert.equal(inscricaoFechada.status, 409);
  assert.equal(inscricaoFechada.body.code, "JANELA_INSCRICAO_FECHADA");

  const isencaoFechada = await request(app)
    .post(`/v1/editais/${edital.id}/isencao`)
    .set("Authorization", `Bearer ${token}`)
    .send({ cursoNivel: CursoNivel.MESTRADO, inscritoCadUnico: true });

  assert.equal(isencaoFechada.status, 409);
  assert.equal(isencaoFechada.body.code, "JANELA_ISENCAO_FECHADA");

  const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId: edital.id } });
  await prisma.pedidoIsencao.create({
    data: {
      participacaoEditalId: participacao.id,
      cursoNivel: CursoNivel.MESTRADO,
      inscritoCadUnico: true,
      status: StatusIsencao.INDEFERIDA_PRELIMINAR,
    },
  });

  const recursoFechado = await request(app)
    .post("/v1/candidato/recursos")
    .set("Authorization", `Bearer ${token}`)
    .send({ editalId: edital.id, fase: FaseRecurso.ISENCAO, fundamentacao: "Recurso fora da janela configurada." });

  assert.equal(recursoFechado.status, 409);
  assert.equal(recursoFechado.body.code, "JANELA_RECURSO_FECHADA");
});

test("edital em rascunho nao fica visivel na superficie publica", async () => {
  const suffix = `draft-window-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);

  const edital = await prisma.edital.create({
    data: {
      numero: `DRAFT-${suffix}`,
      titulo: `Edital rascunho ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.RASCUNHO,
      criadoPorId: admin.id,
    },
  });

  const publico = await request(app).get(`/v1/editais/${edital.id}`);

  assert.equal(publico.status, 404);
  assert.equal(publico.body.code, "EDITAL_NAO_ENCONTRADO");
});
