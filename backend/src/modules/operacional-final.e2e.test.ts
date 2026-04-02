import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  FaseRecurso,
  ModalidadeConcorrencia,
  ResultadoPoliticasAfirmativas,
  Role,
  StatusAvaliacaoEtapa,
  StatusClassificacaoFinal,
  StatusConfirmacaoReserva,
  StatusConta,
  StatusEdital,
  StatusInscricao,
  StatusOperacaoPoliticasAfirmativas,
  TipoCronogramaEdital,
  TipoEtapaPoliticasAfirmativas,
  TipoPublicacaoOficial,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PDFDocument } from "pdf-lib";
import request from "supertest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-real-environments";

const { prisma } = await import("../lib/prisma.js");
const { app } = await import("../app.js");

function createToken(userId: string, email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { subject: userId, expiresIn: "7d" });
}

function parseBinaryResponse(response: any, callback: (error: Error | null, body?: Buffer) => void) {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on("end", () => callback(null, Buffer.concat(chunks)));
  response.on("error", (error: Error) => callback(error));
}

async function createUsers(suffix: string) {
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

  return { admin, candidato };
}

async function cleanupUsers(ids: string[]) {
  await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: { in: ids } } });
}

test("publica homologacao final oficialmente e gera PDF", async () => {
  const suffix = `e2e-homologacao-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const { admin, candidato } = await createUsers(suffix);

  let editalId = "";
  let linhaId = "";
  let participacaoId = "";
  let inscricaoId = "";

  try {
    const adminToken = createToken(admin.id, admin.email);

    const edital = await prisma.edital.create({
      data: {
        numero: `HOM-${suffix}`,
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
      data: { editalId, nome: `Linha ${suffix}`, vagasAmplaConcorrencia: 1, vagasAcoesAfirmativas: 0, vagasPcd: 0 },
    });
    linhaId = linha.id;

    const participacao = await prisma.participacaoEdital.create({
      data: { usuarioId: candidato.id, editalId },
    });
    participacaoId = participacao.id;

    const inscricao = await prisma.inscricao.create({
      data: {
        participacaoEditalId: participacaoId,
        linhaPesquisaId: linhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        status: StatusInscricao.SUBMETIDA,
        submetidaEm: new Date(),
        versaoSubmissao: 1,
        submissaoSnapshot: { teste: true },
        dadosFormulario: { nomeCompleto: candidato.nomeCompleto, email: candidato.email },
      },
    });
    inscricaoId = inscricao.id;

    const preliminar = await request(app)
      .put(`/v1/admin/inscricoes/${inscricaoId}/homologacao/preliminar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ homologada: true, parecer: "Homologacao preliminar deferida.", motivos: [] });
    assert.equal(preliminar.status, 200);

    const final = await request(app)
      .put(`/v1/admin/inscricoes/${inscricaoId}/homologacao/final`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ homologada: true, parecer: "Homologacao final deferida.", motivos: [] });
    assert.equal(final.status, 200);

    const publicacao = await request(app)
      .post(`/v1/admin/editais/${editalId}/publicacoes/homologacao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fase: "FINAL", descricao: "Publicacao final da homologacao." });
    assert.equal(publicacao.status, 201);
    assert.equal(publicacao.body.publicacao.tipo, TipoPublicacaoOficial.HOMOLOGACAO_FINAL);

    const pdfResponse = await request(app)
      .get(`/v1/publicacoes/${publicacao.body.publicacao.id}/arquivo.pdf`)
      .buffer(true)
      .parse(parseBinaryResponse);

    assert.equal(pdfResponse.status, 200);
    assert.equal(pdfResponse.body.subarray(0, 4).toString(), "%PDF");
  } finally {
    if (editalId) await prisma.publicacaoOficial.deleteMany({ where: { editalId } });
    if (inscricaoId) await prisma.homologacaoInscricao.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.inscricao.deleteMany({ where: { id: inscricaoId } });
    if (participacaoId) await prisma.participacaoEdital.deleteMany({ where: { id: participacaoId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await cleanupUsers([admin.id, candidato.id]);
  }
});

test("recurso com impacto em politicas afirmativas reprocessa classificacao e republica snapshots derivados", async () => {
  const suffix = `e2e-recurso-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const { admin, candidato } = await createUsers(suffix);

  let editalId = "";
  let linhaId = "";
  let participacaoId = "";
  let inscricaoId = "";
  let recursoId = "";

  try {
    const adminToken = createToken(admin.id, admin.email);
    const candidatoToken = createToken(candidato.id, candidato.email);

    const now = new Date();
    const before = new Date(now.getTime() - 60_000);
    const after = new Date(now.getTime() + 60_000);

    const edital = await prisma.edital.create({
      data: {
        numero: `REC-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: now,
        criadoPorId: admin.id,
        cronogramas: {
          create: [
            {
              tipo: TipoCronogramaEdital.RECURSO_HETEROIDENTIFICACAO,
              titulo: "Recurso politicas afirmativas",
              inicioEm: before,
              fimEm: after,
            },
          ],
        },
      },
    });
    editalId = edital.id;

    const linha = await prisma.linhaPesquisa.create({
      data: { editalId, nome: `Linha ${suffix}`, vagasAmplaConcorrencia: 0, vagasAcoesAfirmativas: 1, vagasPcd: 0 },
    });
    linhaId = linha.id;

    const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId } });
    participacaoId = participacao.id;

    const inscricao = await prisma.inscricao.create({
      data: {
        participacaoEditalId: participacaoId,
        linhaPesquisaId: linhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
        confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva.PENDENTE,
        confirmacaoPcd: StatusConfirmacaoReserva.NAO_SE_APLICA,
        status: StatusInscricao.CLASSIFICACAO_PRELIMINAR,
        submetidaEm: now,
        dadosFormulario: { nomeCompleto: candidato.nomeCompleto, email: candidato.email, concorreAcoesAfirmativas: true },
        avaliacaoEtapa1: {
          create: { nota: 8.5, status: StatusAvaliacaoEtapa.FINAL_PUBLICADA },
        },
        avaliacaoEtapa2: {
          create: { pontuacaoBruta: 10, notaNormalizada: 9, status: StatusAvaliacaoEtapa.FINAL_PUBLICADA },
        },
        etapaPoliticasAfirmativas: {
          create: {
            tipo: TipoEtapaPoliticasAfirmativas.HETEROIDENTIFICACAO,
            statusOperacao: StatusOperacaoPoliticasAfirmativas.RESULTADO_PRELIMINAR_REGISTRADO,
            resultadoPreliminar: ResultadoPoliticasAfirmativas.NAO_CONFIRMADO,
            parecerPreliminar: "Preliminar nao confirmado.",
            resultadoPreliminarEm: now,
            resultadoFinal: ResultadoPoliticasAfirmativas.NAO_CONFIRMADO,
            parecerFinal: "Final nao confirmado.",
            resultadoFinalEm: now,
          },
        },
      },
    });
    inscricaoId = inscricao.id;

    await prisma.classificacaoFinal.create({
      data: {
        participacaoEditalId: participacaoId,
        linhaPesquisaId: linhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.ACOES_AFIRMATIVAS,
        notaEtapa1: 8.5,
        notaEtapa2: 9,
        notaFinal: 8.83,
        posicaoGeral: 1,
        posicaoLinha: 1,
        status: StatusClassificacaoFinal.LISTA_DE_ESPERA,
        publicadoFinalEm: now,
      },
    });

    const politicasPublicacao = await request(app)
      .post(`/v1/admin/editais/${editalId}/publicacoes/politicas-afirmativas`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fase: "FINAL", descricao: "Publicacao inicial politicas." });
    assert.equal(politicasPublicacao.status, 201);

    const classificacaoPublicacao = await request(app)
      .post(`/v1/admin/editais/${editalId}/publicacoes/classificacao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ fase: "FINAL", descricao: "Publicacao inicial classificacao." });
    assert.equal(classificacaoPublicacao.status, 201);

    const recurso = await request(app)
      .post("/v1/candidato/recursos")
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        editalId,
        fase: FaseRecurso.POLITICAS_AFIRMATIVAS,
        fundamentacao: "Recurso administrativo para revisar o resultado preliminar das politicas afirmativas.",
      });
    assert.equal(recurso.status, 201);
    recursoId = recurso.body.id;

    const decisao = await request(app)
      .put(`/v1/admin/recursos/${recursoId}/decisao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        deferido: true,
        decisao: "Recurso deferido apos revisao do retorno da comissao.",
        impactoResultado: true,
        novoResultadoFinalPoliticasAfirmativas: ResultadoPoliticasAfirmativas.CONFIRMADO,
        novoParecerFinalPoliticasAfirmativas: "Resultado final ajustado para confirmado.",
      });
    assert.equal(decisao.status, 200);

    const etapa = await prisma.etapaPoliticasAfirmativas.findUniqueOrThrow({ where: { inscricaoId } });
    assert.equal(etapa.resultadoFinal, ResultadoPoliticasAfirmativas.CONFIRMADO);

    const classificacao = await prisma.classificacaoFinal.findUniqueOrThrow({ where: { participacaoEditalId: participacaoId } });
    assert.equal(classificacao.status, StatusClassificacaoFinal.APROVADO);

    const politicasPublicacoes = await prisma.publicacaoOficial.findMany({ where: { editalId, tipo: TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_FINAL } });
    const classificacaoPublicacoes = await prisma.publicacaoOficial.findMany({ where: { editalId, tipo: TipoPublicacaoOficial.CLASSIFICACAO_FINAL } });
    assert.equal(politicasPublicacoes.length, 2);
    assert.equal(classificacaoPublicacoes.length, 2);
  } finally {
    if (participacaoId) await prisma.recurso.deleteMany({ where: { participacaoEditalId: participacaoId } });
    if (editalId) await prisma.publicacaoOficial.deleteMany({ where: { editalId } });
    if (participacaoId) await prisma.classificacaoFinal.deleteMany({ where: { participacaoEditalId: participacaoId } });
    if (inscricaoId) await prisma.etapaPoliticasAfirmativas.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.avaliacaoEtapa1.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.avaliacaoEtapa2.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.inscricao.deleteMany({ where: { id: inscricaoId } });
    if (participacaoId) await prisma.participacaoEdital.deleteMany({ where: { id: participacaoId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await cleanupUsers([admin.id, candidato.id]);
  }
});

test("downloads do anexo iv formulario e flattened funcionam e o flattened nao retém campos", async () => {
  const suffix = `e2e-anexoiv-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const { admin, candidato } = await createUsers(suffix);

  let editalId = "";
  let linhaId = "";
  let participacaoId = "";
  let inscricaoId = "";

  try {
    const adminToken = createToken(admin.id, admin.email);
    const candidatoToken = createToken(candidato.id, candidato.email);

    const edital = await prisma.edital.create({
      data: {
        numero: `ANX-${suffix}`,
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
      data: { editalId, nome: `Linha ${suffix}`, vagasAmplaConcorrencia: 1, vagasAcoesAfirmativas: 0, vagasPcd: 0 },
    });
    linhaId = linha.id;

    const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId } });
    participacaoId = participacao.id;

    const inscricao = await prisma.inscricao.create({
      data: {
        participacaoEditalId: participacaoId,
        linhaPesquisaId: linhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        status: StatusInscricao.SUBMETIDA,
        submetidaEm: new Date(),
        dadosFormulario: {
          nomeCompleto: candidato.nomeCompleto,
          nacionalidade: "Brasileira",
          naturalidade: "Manaus",
          email: candidato.email,
          telefoneWhatsapp: "92999999999",
          dataNascimento: "1990-01-01",
          estadoCivil: "Solteiro",
          genero: "MASCULINO",
          tipoSanguineo: "O",
          fatorRh: "+",
          racaCor: "NAO_DECLARADA",
          pessoaComDeficiencia: false,
          concorreAcoesAfirmativas: false,
          vaiSolicitarBolsa: false,
          nomePai: "Pai Teste",
          nomeMae: "Mae Teste",
          enderecoResidencial: "Rua Teste, 123",
          cepResidencial: "69000000",
          bairroResidencial: "Centro",
          ufResidencial: "AM",
          cidadeResidencial: "Manaus",
          empregadoSituacao: "EMPREGADO",
          regimeTrabalho: "INTEGRAL",
          instituicaoTrabalho: "UFAM",
          unidadeDepartamentoTrabalho: "PPGEE",
          enderecoTrabalho: "Av Teste",
          cepTrabalho: "69080900",
          cidadeBairroTrabalho: "Manaus Centro",
        },
      },
    });
    inscricaoId = inscricao.id;

    const formResponse = await request(app)
      .get(`/v1/admin/inscricoes/${inscricaoId}/anexo-iv`)
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    assert.equal(formResponse.status, 200);
    const formPdf = await PDFDocument.load(formResponse.body);
    assert.ok(formPdf.getForm().getFields().length > 0);

    const flattenResponse = await request(app)
      .get(`/v1/admin/inscricoes/${inscricaoId}/anexo-iv/flatten`)
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    assert.equal(flattenResponse.status, 200);
    const flattenedPdf = await PDFDocument.load(flattenResponse.body);
    assert.equal(flattenedPdf.getForm().getFields().length, 0);

    const candidateResponse = await request(app)
      .get(`/v1/inscricoes/${inscricaoId}/anexo-iv`)
      .set("Authorization", `Bearer ${candidatoToken}`)
      .buffer(true)
      .parse(parseBinaryResponse);
    assert.equal(candidateResponse.status, 200);
    const candidatePdf = await PDFDocument.load(candidateResponse.body);
    assert.equal(candidatePdf.getForm().getFields().length, 0);
  } finally {
    if (inscricaoId) await prisma.inscricao.deleteMany({ where: { id: inscricaoId } });
    if (participacaoId) await prisma.participacaoEdital.deleteMany({ where: { id: participacaoId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await cleanupUsers([admin.id, candidato.id]);
  }
});
