import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  FaseRecurso,
  ModalidadeConcorrencia,
  Role,
  StatusAvaliacaoEtapa,
  StatusConta,
  StatusEdital,
  StatusInscricao,
  StatusRecurso,
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

type Context = {
  adminId: string;
  avaliadorId: string;
  candidatoAId: string;
  candidatoBId: string;
  editalId: string;
  linhaId: string;
  participacaoAId: string;
  participacaoBId: string;
  inscricaoBId: string;
  recursoBId: string;
};

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

async function createContext(): Promise<Context> {
  const suffix = `authz-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const admin = await createUser(suffix, Role.ADMIN);
  const avaliador = await createUser(suffix, Role.AVALIADOR);
  const candidatoA = await createUser(`a-${suffix}`, Role.CANDIDATO);
  const candidatoB = await createUser(`b-${suffix}`, Role.CANDIDATO);

  const edital = await prisma.edital.create({
    data: {
      numero: `AUTHZ-${suffix}`,
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

  const participacaoA = await prisma.participacaoEdital.create({ data: { usuarioId: candidatoA.id, editalId: edital.id } });
  const participacaoB = await prisma.participacaoEdital.create({ data: { usuarioId: candidatoB.id, editalId: edital.id } });

  const inscricaoB = await prisma.inscricao.create({
    data: {
      participacaoEditalId: participacaoB.id,
      linhaPesquisaId: linha.id,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      status: StatusInscricao.CLASSIFICACAO_PRELIMINAR,
      submetidaEm: new Date(),
      versaoSubmissao: 1,
      dadosFormulario: {
        nomeCompleto: candidatoB.nomeCompleto,
        email: candidatoB.email,
        nacionalidade: "Brasileira",
      },
      documentos: {
        create: [
          {
            tipo: "ANEXO_IV",
            nome: "Anexo IV",
            urlArquivo: "https://arquivos.teste/anexo-iv.pdf",
            nomeArquivo: "anexo-iv.pdf",
          },
        ],
      },
      avaliacaoEtapa1: {
        create: {
          tema: "Tema teste",
          textoSubmetido: "Texto submetido",
          nota: 8.5,
          espelhoCorrecao: "Espelho etapa 1",
          rubricaDetalhada: { criterio: "ok" },
          espelhoLiberadoEm: new Date(),
          espelhoSolicitadoEm: new Date(),
          status: StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA,
        },
      },
      avaliacaoEtapa2: {
        create: {
          pontuacaoItens: { titulo: 10 },
          pontuacaoBruta: 10,
          notaNormalizada: 10,
          memoriaCalculo: { maiorPontuacaoBruta: 10 },
          glosas: [],
          espelhoCorrecao: "Espelho etapa 2",
          espelhoLiberadoEm: new Date(),
          espelhoSolicitadoEm: new Date(),
          status: StatusAvaliacaoEtapa.PRELIMINAR_PUBLICADA,
        },
      },
      pacoteDocumentalUrl: "https://arquivos.teste/pacote-documental.pdf",
      pacoteDocumentalNomeArquivo: "pacote-documental.pdf",
      pacoteDocumentalMimeType: "application/pdf",
      pacoteDocumentalSnapshot: {
        candidato: { nomeCompleto: candidatoB.nomeCompleto },
      },
      pacoteDocumentalVersaoSubmissao: 1,
      pacoteDocumentalGeradoEm: new Date(),
      pacoteDocumentalGeradoPorId: admin.id,
    },
  });

  const recursoB = await prisma.recurso.create({
    data: {
      participacaoEditalId: participacaoB.id,
      criadoPorId: candidatoB.id,
      fase: FaseRecurso.ETAPA_1,
      fundamentacao: "Recurso do candidato B",
      status: StatusRecurso.ABERTO,
    },
  });

  return {
    adminId: admin.id,
    avaliadorId: avaliador.id,
    candidatoAId: candidatoA.id,
    candidatoBId: candidatoB.id,
    editalId: edital.id,
    linhaId: linha.id,
    participacaoAId: participacaoA.id,
    participacaoBId: participacaoB.id,
    inscricaoBId: inscricaoB.id,
    recursoBId: recursoB.id,
  };
}

async function cleanupContext(context: Context) {
  await prisma.recurso.deleteMany({ where: { id: context.recursoBId } });
  await prisma.avaliacaoEtapa1.deleteMany({ where: { inscricaoId: context.inscricaoBId } });
  await prisma.avaliacaoEtapa2.deleteMany({ where: { inscricaoId: context.inscricaoBId } });
  await prisma.documentoInscricao.deleteMany({ where: { inscricaoId: context.inscricaoBId } });
  await prisma.inscricao.deleteMany({ where: { id: context.inscricaoBId } });
  await prisma.participacaoEdital.deleteMany({ where: { id: { in: [context.participacaoAId, context.participacaoBId] } } });
  await prisma.linhaPesquisa.deleteMany({ where: { id: context.linhaId } });
  await prisma.edital.deleteMany({ where: { id: context.editalId } });
  await prisma.usuarioPerfil.deleteMany({
    where: {
      usuarioId: { in: [context.adminId, context.avaliadorId, context.candidatoAId, context.candidatoBId] },
    },
  });
  await prisma.usuario.deleteMany({
    where: {
      id: { in: [context.adminId, context.avaliadorId, context.candidatoAId, context.candidatoBId] },
    },
  });
}

test("candidate nao acessa recursos de ownership alheio e admin routes retornam permissao consistente", async () => {
  const context = await createContext();

  try {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { id: context.adminId } });
    const avaliador = await prisma.usuario.findUniqueOrThrow({ where: { id: context.avaliadorId } });
    const candidatoA = await prisma.usuario.findUniqueOrThrow({ where: { id: context.candidatoAId } });
    const candidatoB = await prisma.usuario.findUniqueOrThrow({ where: { id: context.candidatoBId } });

    const adminToken = createToken(admin.id, admin.email);
    const avaliadorToken = createToken(avaliador.id, avaliador.email);
    const candidatoAToken = createToken(candidatoA.id, candidatoA.email);
    const candidatoBToken = createToken(candidatoB.id, candidatoB.email);

    const candidateAnexoForbidden = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/anexo-iv`)
      .set("Authorization", `Bearer ${candidatoAToken}`);

    assert.equal(candidateAnexoForbidden.status, 404);
    assert.equal(candidateAnexoForbidden.body.code, "INSCRICAO_NAO_ENCONTRADA");
    assert.equal(typeof candidateAnexoForbidden.body.message, "string");

    const candidatePacoteForbidden = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/pacote-documental`)
      .set("Authorization", `Bearer ${candidatoAToken}`);

    assert.equal(candidatePacoteForbidden.status, 404);
    assert.equal(candidatePacoteForbidden.body.code, "INSCRICAO_NAO_ENCONTRADA");
    assert.equal(typeof candidatePacoteForbidden.body.message, "string");

    const etapa1EspelhoForbidden = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/etapa-1/espelho`)
      .set("Authorization", `Bearer ${candidatoAToken}`);

    assert.equal(etapa1EspelhoForbidden.status, 404);
    assert.equal(etapa1EspelhoForbidden.body.code, "INSCRICAO_NAO_ENCONTRADA");
    assert.equal(typeof etapa1EspelhoForbidden.body.message, "string");

    const etapa2EspelhoForbidden = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/etapa-2/espelho`)
      .set("Authorization", `Bearer ${candidatoAToken}`);

    assert.equal(etapa2EspelhoForbidden.status, 404);
    assert.equal(etapa2EspelhoForbidden.body.code, "INSCRICAO_NAO_ENCONTRADA");
    assert.equal(typeof etapa2EspelhoForbidden.body.message, "string");

    const ownAnexo = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/anexo-iv`)
      .set("Authorization", `Bearer ${candidatoBToken}`);

    assert.equal(ownAnexo.status, 200);

    const ownPacote = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/pacote-documental`)
      .set("Authorization", `Bearer ${candidatoBToken}`);

    assert.equal(ownPacote.status, 200);

    const ownEtapa1Espelho = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/etapa-1/espelho`)
      .set("Authorization", `Bearer ${candidatoBToken}`);

    assert.equal(ownEtapa1Espelho.status, 200);

    const ownEtapa2Espelho = await request(app)
      .get(`/v1/inscricoes/${context.inscricaoBId}/etapa-2/espelho`)
      .set("Authorization", `Bearer ${candidatoBToken}`);

    assert.equal(ownEtapa2Espelho.status, 200);

    const recursosA = await request(app)
      .get("/v1/candidato/recursos")
      .set("Authorization", `Bearer ${candidatoAToken}`);

    assert.equal(recursosA.status, 200);
    assert.equal(recursosA.body.total, 0);

    const recursosB = await request(app)
      .get("/v1/candidato/recursos")
      .set("Authorization", `Bearer ${candidatoBToken}`);

    assert.equal(recursosB.status, 200);
    assert.equal(recursosB.body.total, 1);
    assert.equal(recursosB.body.items[0].id, context.recursoBId);

    const candidateAdminForbidden = await request(app)
      .get("/v1/admin/homologacao/fundamentos")
      .set("Authorization", `Bearer ${candidatoAToken}`);

    assert.equal(candidateAdminForbidden.status, 403);
    assert.equal(candidateAdminForbidden.body.code, "FORBIDDEN");
    assert.equal(candidateAdminForbidden.body.message, "Perfil sem permissao para esta operacao.");

    const avaliadorAdminForbidden = await request(app)
      .get("/v1/admin/homologacao/fundamentos")
      .set("Authorization", `Bearer ${avaliadorToken}`);

    assert.equal(avaliadorAdminForbidden.status, 403);
    assert.equal(avaliadorAdminForbidden.body.code, "FORBIDDEN");
    assert.equal(avaliadorAdminForbidden.body.message, "Perfil sem permissao para esta operacao.");

    const avaliadorAllowed = await request(app)
      .get("/v1/admin/etapa-1/inscricoes")
      .set("Authorization", `Bearer ${avaliadorToken}`);

    assert.equal(avaliadorAllowed.status, 200);

    const adminAllowed = await request(app)
      .get("/v1/admin/homologacao/fundamentos")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(adminAllowed.status, 200);
  } finally {
    await cleanupContext(context);
  }
});
