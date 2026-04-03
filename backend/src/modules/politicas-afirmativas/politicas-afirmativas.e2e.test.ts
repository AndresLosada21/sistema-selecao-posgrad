import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  ModalidadeConcorrencia,
  ResultadoPoliticasAfirmativas,
  Role,
  StatusConfirmacaoReserva,
  StatusConta,
  StatusEdital,
  StatusInscricao,
  TipoEtapaPoliticasAfirmativas,
  TipoPublicacaoOficial,
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
  etapaId: string;
};

function createToken(userId: string, email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, {
    subject: userId,
    expiresIn: "7d",
  });
}

async function createContext(): Promise<E2eContext> {
  const suffix = `e2e-politicas-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const senhaHash = await bcrypt.hash("Senha123456", 10);

  const admin = await prisma.usuario.create({
    data: {
      nomeCompleto: `Admin ${suffix}`,
      email: `admin.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role: Role.ADMIN }] },
    },
  });

  const candidato = await prisma.usuario.create({
    data: {
      nomeCompleto: `Candidato ${suffix}`,
      email: `candidato.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role: Role.CANDIDATO }] },
    },
  });

  const edital = await prisma.edital.create({
    data: {
      numero: `PAF-${suffix}`,
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
      modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
      confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.PENDENTE,
      confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
      status: StatusInscricao.CLASSIFICACAO_PRELIMINAR,
      dadosFormulario: {
        nomeCompleto: candidato.nomeCompleto,
        email: candidato.email,
        concorreAcoesAfirmativas: true,
      },
      submetidaEm: new Date(),
    },
  });

  await prisma.documentoInscricao.createMany({
    data: [
      {
        inscricaoId: inscricao.id,
        tipo: "ANEXO_VIII_AUTODECLARACAO",
        nome: "Autodeclaracao",
        urlArquivo: "https://arquivos.teste/anexo-viii.pdf",
        nomeArquivo: "anexo-viii.pdf",
      },
      {
        inscricaoId: inscricao.id,
        tipo: "COMPROVANTE_ETNICO",
        nome: "Comprovante etnico",
        urlArquivo: "https://arquivos.teste/comprovante-etnico.pdf",
        nomeArquivo: "comprovante-etnico.pdf",
      },
    ],
  });

  const etapa = await prisma.etapaPoliticasAfirmativas.create({
    data: {
      inscricaoId: inscricao.id,
      tipo: TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO,
    },
  });

  return {
    adminId: admin.id,
    candidatoId: candidato.id,
    editalId: edital.id,
    linhaId: linha.id,
    participacaoId: participacao.id,
    inscricaoId: inscricao.id,
    etapaId: etapa.id,
  };
}

async function cleanupContext(context: E2eContext) {
  await prisma.recurso.deleteMany({ where: { participacaoEditalId: context.participacaoId } });
  await prisma.publicacaoOficial.deleteMany({ where: { editalId: context.editalId } });
  await prisma.etapaPoliticasAfirmativas.deleteMany({ where: { id: context.etapaId } });
  await prisma.documentoInscricao.deleteMany({ where: { inscricaoId: context.inscricaoId } });
  await prisma.inscricao.deleteMany({ where: { id: context.inscricaoId } });
  await prisma.participacaoEdital.deleteMany({ where: { id: context.participacaoId } });
  await prisma.linhaPesquisa.deleteMany({ where: { id: context.linhaId } });
  await prisma.edital.deleteMany({ where: { id: context.editalId } });
  await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [context.adminId, context.candidatoId] } } });
  await prisma.usuario.deleteMany({ where: { id: { in: [context.adminId, context.candidatoId] } } });
}

test("admin gerencia etapa de politicas afirmativas e publica resultado final", async () => {
  const context = await createContext();

  try {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: context.adminId } });
    const candidato = await prisma.usuario.findUniqueOrThrow({ where: { id: context.candidatoId } });
    const adminToken = createToken(admin.id, admin.email);
    const candidatoToken = createToken(candidato.id, candidato.email);

    const listResponse = await request(app)
      .get(`/v1/admin/editais/${context.editalId}/politicas-afirmativas`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.total, 1);
    assert.equal(listResponse.body.items[0].tipo, "HETEROIDENTIFICACAO");

    const encaminhamentoResponse = await request(app)
      .put(`/v1/admin/inscricoes/${context.inscricaoId}/politicas-afirmativas/encaminhamento`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        convocadoEm: "2026-02-09T08:00:00.000Z",
        documentosEncaminhadosEm: "2026-02-09T10:00:00.000Z",
        protocoloEncaminhamento: "CGH-2026-123",
        observacaoEncaminhamento: "Documentos enviados a comissao externa.",
      });

    assert.equal(encaminhamentoResponse.status, 200);
    assert.equal(encaminhamentoResponse.body.statusOperacao, "DOCUMENTOS_ENCAMINHADOS");

    const preliminarResponse = await request(app)
      .put(`/v1/admin/inscricoes/${context.inscricaoId}/politicas-afirmativas/resultado-preliminar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        resultado: "CONFIRMADO",
        parecer: "Resultado preliminar recebido da CGH.",
        arquivoRetornoUrl: "https://arquivos.teste/hetero-preliminar.pdf",
      });

    assert.equal(preliminarResponse.status, 200);
    assert.equal(preliminarResponse.body.resultadoPreliminar, "CONFIRMADO");

    const previewResponse = await request(app)
      .get(`/v1/admin/editais/${context.editalId}/publicacoes/politicas-afirmativas/preview?fase=PRELIMINAR`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.body.tipo, TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_PRELIMINAR);
    assert.equal(previewResponse.body.resumo.confirmados, 1);

    const finalResponse = await request(app)
      .put(`/v1/admin/inscricoes/${context.inscricaoId}/politicas-afirmativas/resultado-final`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        resultado: "CONFIRMADO",
        parecer: "Resultado final recebido da CGH.",
        arquivoRetornoUrl: "https://arquivos.teste/hetero-final.pdf",
      });

    assert.equal(finalResponse.status, 200);
    assert.equal(finalResponse.body.resultadoFinal, "CONFIRMADO");

    const createPublicacaoResponse = await request(app)
      .post(`/v1/admin/editais/${context.editalId}/publicacoes/politicas-afirmativas`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fase: "FINAL", descricao: "Publicacao final da etapa no teste E2E." });

    assert.equal(createPublicacaoResponse.status, 201);
    assert.equal(createPublicacaoResponse.body.publicacao.versao, 1);

    const dashboardResponse = await request(app)
      .get("/v1/candidato/area")
      .set("Authorization", `Bearer ${candidatoToken}`);

    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboardResponse.body.items[0].inscricao.politicasAfirmativas.resultadoFinal, ResultadoPoliticasAfirmativas.CONFIRMADO);
    const destaque = dashboardResponse.body.items[0].publicacoesDestaque.find((item: { tipo: string }) => item.tipo === TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_FINAL);
    assert.ok(destaque);
  } finally {
    await cleanupContext(context);
  }
});
