import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  FaseRecurso,
  ModalidadeConcorrencia,
  Role,
  StatusConta,
  StatusEdital,
  TipoDocumentoInscricao,
  TipoCronogramaEdital,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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

test("admin percorre contratos HTTP de homologacao, recurso, etapas e classificacao", async () => {
  const suffix = `admin-flow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const candidato = await createUser(suffix, Role.CANDIDATO);

  let editalId = "";
  let linhaId = "";
  let participacaoId = "";
  let inscricaoId = "";
  let recursoId = "";

  try {
    const adminToken = createToken(admin.id, admin.email);
    const candidatoToken = createToken(candidato.id, candidato.email);
    const now = new Date();

    const edital = await prisma.edital.create({
      data: {
        numero: `ADM-${suffix}`,
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
              tipo: TipoCronogramaEdital.RECURSO_HOMOLOGACAO,
              titulo: "Recurso de homologacao",
              inicioEm: new Date(now.getTime() - 60_000),
              fimEm: new Date(now.getTime() + 60_000),
            },
          ],
        },
      },
    });
    editalId = edital.id;

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

    const participacao = await prisma.participacaoEdital.create({
      data: { usuarioId: candidato.id, editalId },
    });
    participacaoId = participacao.id;

    const inscricao = await prisma.inscricao.create({
      data: {
        participacaoEditalId: participacaoId,
        linhaPesquisaId: linhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        status: "SUBMETIDA",
        submetidaEm: now,
        versaoSubmissao: 1,
        dadosFormulario: { nomeCompleto: candidato.nomeCompleto, email: candidato.email },
        redacaoTexto: "A".repeat(600),
      },
    });
    inscricaoId = inscricao.id;

    await prisma.documentoInscricao.create({
      data: {
        inscricaoId,
        tipo: TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO,
        nome: "Comprovante de pagamento",
        nomeArquivo: `comprovante-${suffix}.pdf`,
        urlArquivo: `private://uploads/${candidato.id}/comprovante-${suffix}.pdf`,
        obrigatorio: true,
      },
    });

    const fundamentos = await request(app)
      .get("/v1/admin/homologacao/fundamentos")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(fundamentos.status, 200);
    assert.equal(fundamentos.body.total > 0, true);

    const listHomologacao = await request(app)
      .get(`/v1/admin/inscricoes?editalId=${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(listHomologacao.status, 200);
    assert.equal(listHomologacao.body.total, 1);

    const pagamentoConfirmado = await request(app)
      .put(`/v1/admin/inscricoes/${inscricaoId}/pagamento`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ statusPagamento: "PAGO" });
    assert.equal(pagamentoConfirmado.status, 200);
    assert.equal(pagamentoConfirmado.body.statusPagamento, "PAGO");

    const homologacaoPreliminar = await request(app)
      .put(`/v1/admin/inscricoes/${inscricaoId}/homologacao/preliminar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ homologada: true, parecer: "Homologacao preliminar deferida.", motivos: [] });
    assert.equal(homologacaoPreliminar.status, 200);

    const revisaoHomologacaoPreliminar = await request(app)
      .put(`/v1/admin/inscricoes/${inscricaoId}/homologacao/preliminar`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        homologada: false,
        parecer: "Homologacao preliminar revisada para indeferimento.",
        motivos: [
          {
            codigo: "FORMULARIO_NAO_DIGITAL",
            itemEdital: "3.5.12",
            titulo: "Formulario fora do padrao digital",
            descricao: "Formulario obrigatorio nao foi preenchido digitalmente.",
            sanavel: true,
          },
        ],
      });
    assert.equal(revisaoHomologacaoPreliminar.status, 409);
    assert.equal(revisaoHomologacaoPreliminar.body.code, "HOMOLOGACAO_PRELIMINAR_BLOQUEADA");

    const recurso = await request(app)
      .post("/v1/candidato/recursos")
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        editalId,
        fase: FaseRecurso.HOMOLOGACAO,
        fundamentacao: "Recurso administrativo sobre a homologacao preliminar.",
      });
    assert.equal(recurso.status, 201);
    recursoId = recurso.body.id;

    const recursosAdmin = await request(app)
      .get(`/v1/admin/recursos?editalId=${editalId}&fase=HOMOLOGACAO`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(recursosAdmin.status, 200);
    assert.equal(recursosAdmin.body.total, 1);

    const decisaoRecurso = await request(app)
      .put(`/v1/admin/recursos/${recursoId}/decisao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        deferido: false,
        decisao: "Recurso indeferido pela banca.",
        impactoResultado: false,
      });
    assert.equal(decisaoRecurso.status, 200);

    await prisma.cronogramaEdital.updateMany({
      where: {
        editalId,
        tipo: "RECURSO_HOMOLOGACAO",
      },
      data: {
        inicioEm: new Date(Date.now() - 120_000),
        fimEm: new Date(Date.now() - 60_000),
      },
    });

    const homologacaoFinal = await request(app)
      .put(`/v1/admin/inscricoes/${inscricaoId}/homologacao/final`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ homologada: true, parecer: "Homologacao final deferida.", motivos: [] });
    assert.equal(homologacaoFinal.status, 200);

    const etapa1List = await request(app)
      .get(`/v1/admin/etapa-1/inscricoes?editalId=${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(etapa1List.status, 200);
    assert.equal(etapa1List.body.total, 1);

    const etapa1Preliminar = await request(app)
      .put(`/v1/admin/etapa-1/inscricoes/${inscricaoId}/resultado`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tema: "Tema da etapa 1",
        rubrica: {
          adequacaoDominioTema: 8,
          estrutura: 8,
          organizacaoCoerencia: 8,
          objetividadeSintese: 8,
          grafiaGramatica: 8,
        },
        usoIaComprovado: false,
        espelhoCorrecao: "Espelho preliminar da etapa 1.",
        liberarEspelho: false,
        publicacao: "PRELIMINAR",
      });
    assert.equal(etapa1Preliminar.status, 200);

    const etapa1Final = await request(app)
      .put(`/v1/admin/etapa-1/inscricoes/${inscricaoId}/resultado`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tema: "Tema da etapa 1",
        rubrica: {
          adequacaoDominioTema: 8,
          estrutura: 8,
          organizacaoCoerencia: 8,
          objetividadeSintese: 8,
          grafiaGramatica: 8,
        },
        usoIaComprovado: false,
        espelhoCorrecao: "Espelho final da etapa 1.",
        liberarEspelho: true,
        publicacao: "FINAL",
      });
    assert.equal(etapa1Final.status, 200);

    const etapa2List = await request(app)
      .get(`/v1/admin/etapa-2/inscricoes?editalId=${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(etapa2List.status, 200);
    assert.equal(etapa2List.body.total, 1);

    const etapa2Preliminar = await request(app)
      .put(`/v1/admin/etapa-2/inscricoes/${inscricaoId}/resultado`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        pontuacaoItens: { titulo: 10 },
        pontuacaoBruta: 10,
        maiorPontuacaoBruta: 10,
        glosas: [],
        espelhoCorrecao: "Espelho preliminar da etapa 2.",
        liberarEspelho: false,
        publicacao: "PRELIMINAR",
      });
    assert.equal(etapa2Preliminar.status, 200);

    await prisma.cronogramaEdital.updateMany({
      where: {
        editalId,
        tipo: "RECURSO_ETAPA_2",
      },
      data: {
        inicioEm: new Date(Date.now() - 120_000),
        fimEm: new Date(Date.now() - 60_000),
      },
    });

    const etapa2Final = await request(app)
      .put(`/v1/admin/etapa-2/inscricoes/${inscricaoId}/resultado`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        pontuacaoItens: { titulo: 10 },
        pontuacaoBruta: 10,
        maiorPontuacaoBruta: 10,
        glosas: [],
        espelhoCorrecao: "Espelho final da etapa 2.",
        liberarEspelho: true,
        publicacao: "FINAL",
      });
    assert.equal(etapa2Final.status, 200);

    const classificacaoRecalculo = await request(app)
      .post(`/v1/admin/editais/${editalId}/classificacao/recalcular`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ publicacao: "FINAL" });
    assert.equal(classificacaoRecalculo.status, 200);
    assert.equal(classificacaoRecalculo.body.total, 1);

    const classificacaoList = await request(app)
      .get(`/v1/admin/editais/${editalId}/classificacao`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(classificacaoList.status, 200);
    assert.equal(classificacaoList.body.total, 1);
  } finally {
    if (participacaoId) await prisma.recurso.deleteMany({ where: { participacaoEditalId: participacaoId } });
    if (participacaoId) await prisma.classificacaoFinal.deleteMany({ where: { participacaoEditalId: participacaoId } });
    if (inscricaoId) await prisma.homologacaoInscricao.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.avaliacaoEtapa1.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.avaliacaoEtapa2.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.inscricao.deleteMany({ where: { id: inscricaoId } });
    if (participacaoId) await prisma.participacaoEdital.deleteMany({ where: { id: participacaoId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [admin.id, candidato.id] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidato.id] } } });
  }
});
