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

function parseBinaryResponse(response: any, callback: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
  response.on("error", (error: Error) => callback(error));
}

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
        tipo: "HETEROIDENTIFICACAO",
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
        tipo: "HETEROIDENTIFICACAO",
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
    assert.equal(previewResponse.body.itens[0].candidato.email, undefined);

    const finalResponse = await request(app)
      .put(`/v1/admin/inscricoes/${context.inscricaoId}/politicas-afirmativas/resultado-final`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: "HETEROIDENTIFICACAO",
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
    assert.equal(createPublicacaoResponse.body.preview.itens[0].candidato.email, undefined);

    const pdfResponse = await request(app)
      .get(`/v1/publicacoes/${createPublicacaoResponse.body.publicacao.id}/arquivo.pdf`)
      .buffer(true)
      .parse(parseBinaryResponse);

    assert.equal(pdfResponse.status, 200);
    assert.equal(pdfResponse.headers["content-type"], "application/pdf");
    assert.equal(pdfResponse.body.subarray(0, 4).toString(), "%PDF");
    assert.equal(pdfResponse.body.toString("latin1").includes(candidato.email), false);

    const dashboardResponse = await request(app)
      .get("/v1/candidato/area")
      .set("Authorization", `Bearer ${candidatoToken}`);

    assert.equal(dashboardResponse.status, 200);
    assert.equal(dashboardResponse.body.items[0].inscricao.politicasAfirmativas.itens[0].resultadoFinal, ResultadoPoliticasAfirmativas.CONFIRMADO);
    const destaque = dashboardResponse.body.items[0].publicacoesDestaque.find((item: { tipo: string }) => item.tipo === TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_FINAL);
    assert.ok(destaque);
    assert.equal("dadosConsolidados" in destaque, false);
    assert.equal("criadoPor" in destaque, false);
    assert.equal("criadoPorId" in destaque, false);
  } finally {
    await cleanupContext(context);
  }
});

test("inscricao com acoes afirmativas e PCD simultaneos expõe duas etapas e dois recursos distintos", async () => {
  const context = await createContext();

  try {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: context.adminId } });
    const candidato = await prisma.usuario.findUniqueOrThrow({ where: { id: context.candidatoId } });
    const adminToken = createToken(admin.id, admin.email);
    const candidatoToken = createToken(candidato.id, candidato.email);

    await prisma.inscricao.update({
      where: { id: context.inscricaoId },
      data: {
        confirmacaoPcd: StatusConfirmacaoReserva.PENDENTE,
        dadosFormulario: {
          nomeCompleto: candidato.nomeCompleto,
          email: candidato.email,
          concorreAcoesAfirmativas: true,
          pessoaComDeficiencia: true,
        },
      },
    });

    await prisma.documentoInscricao.create({
      data: {
        inscricaoId: context.inscricaoId,
        tipo: "LAUDO_PCD",
        nome: "Laudo PCD",
        urlArquivo: "https://arquivos.teste/laudo-pcd.pdf",
        nomeArquivo: "laudo-pcd.pdf",
      },
    });

    await prisma.etapaPoliticasAfirmativas.create({
      data: {
        inscricaoId: context.inscricaoId,
        tipo: TipoEtapaPoliticasAfirmativas.PCD,
      },
    });

    await prisma.cronogramaEdital.create({
      data: {
        editalId: context.editalId,
        tipo: "RECURSO_HETEROIDENTIFICACAO",
        titulo: "Janela recursal politicas",
        inicioEm: new Date(Date.now() - 60_000),
        fimEm: new Date(Date.now() + 60_000),
      },
    });

    const listResponse = await request(app)
      .get(`/v1/admin/editais/${context.editalId}/politicas-afirmativas`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.total, 2);

    const detailResponse = await request(app)
      .get(`/v1/admin/inscricoes/${context.inscricaoId}/politicas-afirmativas`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.body.inscricao.reservasConcorrencia.acoesAfirmativas, true);
    assert.equal(detailResponse.body.inscricao.reservasConcorrencia.pcd, true);
    assert.equal(detailResponse.body.etapas.length, 2);

    const pcdPreliminar = await request(app)
      .put(`/v1/admin/inscricoes/${context.inscricaoId}/politicas-afirmativas/resultado-preliminar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: "PCD",
        resultado: "CONFIRMADO",
        parecer: "PCD preliminar confirmado.",
      });

    assert.equal(pcdPreliminar.status, 200);
    assert.equal(pcdPreliminar.body.tipo, "PCD");

    const heteroPreliminar = await request(app)
      .put(`/v1/admin/inscricoes/${context.inscricaoId}/politicas-afirmativas/resultado-preliminar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: "HETEROIDENTIFICACAO",
        resultado: "NAO_CONFIRMADO",
        parecer: "Heteroidentificacao preliminar registrada.",
      });

    assert.equal(heteroPreliminar.status, 200);
    assert.equal(heteroPreliminar.body.tipo, "HETEROIDENTIFICACAO");

    const recursoPcd = await request(app)
      .post("/v1/candidato/recursos")
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        editalId: context.editalId,
        fase: "POLITICAS_AFIRMATIVAS",
        tipoPoliticasAfirmativasReferencia: "PCD",
        fundamentacao: "Recurso especifico para a etapa PCD.",
      });

    assert.equal(recursoPcd.status, 201);
    assert.equal(recursoPcd.body.tipoPoliticasAfirmativasReferencia, "PCD");

    const recursoHetero = await request(app)
      .post("/v1/candidato/recursos")
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        editalId: context.editalId,
        fase: "POLITICAS_AFIRMATIVAS",
        tipoPoliticasAfirmativasReferencia: "HETEROIDENTIFICACAO",
        fundamentacao: "Recurso especifico para heteroidentificacao.",
      });

    assert.equal(recursoHetero.status, 201);
    assert.equal(recursoHetero.body.tipoPoliticasAfirmativasReferencia, "HETEROIDENTIFICACAO");

    const recursoPcdDuplicado = await request(app)
      .post("/v1/candidato/recursos")
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        editalId: context.editalId,
        fase: "POLITICAS_AFIRMATIVAS",
        tipoPoliticasAfirmativasReferencia: "PCD",
        fundamentacao: "Tentativa duplicada do mesmo subtipo.",
      });

    assert.equal(recursoPcdDuplicado.status, 409);
  } finally {
    await cleanupContext(context);
  }
});
