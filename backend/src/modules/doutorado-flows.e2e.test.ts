import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  ModalidadeConcorrencia,
  Role,
  StatusConta,
  StatusEdital,
  TipoCronogramaEdital,
  TipoDocumentoInscricao,
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

async function createAdmin(suffix: string) {
  const senhaHash = await bcrypt.hash("Senha123456", 10);

  return prisma.usuario.create({
    data: {
      nomeCompleto: `Admin ${suffix}`,
      email: `admin.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
      perfis: { create: [{ role: Role.ADMIN }] },
    },
  });
}

function createToken(userId: string, email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { subject: userId, expiresIn: "7d" });
}

const fichaBase = {
  rg: "1234567",
  rgDataExpedicao: "2020-01-01",
  nacionalidade: "Brasileira",
  naturalidade: "Manaus",
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
  empregadoSituacao: "NAO_EMPREGADO",
};

async function uploadPrivatePdf(token: string, filename: string) {
  const response = await request(app)
    .post("/v1/uploads")
    .set("Authorization", `Bearer ${token}`)
    .attach("file", Buffer.from("%PDF-1.4 teste"), { filename, contentType: "application/pdf" });

  assert.equal(response.status, 201);
  return response.body as { urlArquivo: string; nomeArquivo: string; mimeType: string };
}

async function addDocumento(token: string, inscricaoId: string, tipo: TipoDocumentoInscricao) {
  const uploaded = await uploadPrivatePdf(token, `${tipo.toLowerCase()}.pdf`);

  return request(app)
    .post(`/v1/inscricoes/${inscricaoId}/documentos`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      tipo,
      nome: `Documento ${tipo}`,
      urlArquivo: uploaded.urlArquivo,
      nomeArquivo: uploaded.nomeArquivo,
      mimeType: uploaded.mimeType,
    });
}

test("doutorado exige pre-projeto e grupo de pesquisa e nao permite cancelar submissao", async () => {
  const suffix = `doutorado-flow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);

  let editalId = "";
  let candidateId = "";

  try {
    const candidateRegister = await request(app)
      .post("/v1/auth/register")
      .send({
        nomeCompleto: `Candidato ${suffix}`,
        email: `candidato.${suffix}@teste.local`,
        senha: "Senha123456",
        telefone: "92999999999",
        cpf: `${Date.now()}`.slice(-11),
      });

    assert.equal(candidateRegister.status, 201);
    candidateId = candidateRegister.body.user.id;
    const token = candidateRegister.body.token as string;

    const now = new Date();
    const edital = await prisma.edital.create({
      data: {
        numero: `DOUT-${suffix}`,
        titulo: `Edital doutorado ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.DOUTORADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: now,
        criadoPorId: admin.id,
        cronogramas: {
          create: [
            {
              tipo: TipoCronogramaEdital.INSCRICAO,
              titulo: "Inscricao",
              inicioEm: new Date(now.getTime() - 60_000),
              fimEm: new Date(now.getTime() + 60_000),
            },
          ],
        },
      },
    });
    editalId = edital.id;

    const perfil = await request(app)
      .post(`/v1/admin/editais/${editalId}/perfil-processo/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-073-2026-doutorado" });
    assert.equal(perfil.status, 200);
    assert.equal(perfil.body.modalidadeEtapa1, "PRE_PROJETO");
    assert.equal(perfil.body.avaliadoresEtapa1, 2);

    const configuracaoComGrupo = await request(app)
      .put(`/v1/admin/editais/${editalId}/configuracao-processo`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        modalidadeEtapa1: "PRE_PROJETO",
        pesoEtapa1: 2,
        pesoEtapa2: 1,
        notaMinimaEtapa1: 7,
        desempate: "ETAPA1_IDADE",
        avaliadoresEtapa1: 2,
        exigeDiplomaGraduacao: false,
        exigeHistoricoGraduacao: false,
        exigeGrupoPesquisa: true,
        permiteCancelarSubmissao: false,
      });
    assert.equal(configuracaoComGrupo.status, 200);

    const grupo = await request(app)
      .post(`/v1/admin/editais/${editalId}/grupos-pesquisa`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ nome: "Grupo de Automacao", descricao: "Grupo de pesquisa do doutorado." });
    assert.equal(grupo.status, 201);

    const linha = await prisma.linhaPesquisa.create({
      data: {
        editalId,
        nome: `Linha ${suffix}`,
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 0,
        vagasPcd: 0,
      },
    });

    const draftSemGrupo = await request(app)
      .put(`/v1/editais/${editalId}/inscricao/rascunho`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        linhaPesquisaId: linha.id,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        resumoCurriculo: "Pesquisa em controle e automacao de sistemas.",
        fichaInscricao: {
          ...fichaBase,
          nomeCompleto: `Candidato ${suffix}`,
          email: `candidato.${suffix}@teste.local`,
          cpf: candidateRegister.body.user.cpf,
        },
      });

    assert.equal(draftSemGrupo.status, 200);
    assert.equal(draftSemGrupo.body.grupoPesquisaId, null);

    const submitSemGrupo = await request(app)
      .post(`/v1/inscricoes/${draftSemGrupo.body.id}/submeter`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(submitSemGrupo.status, 409);
    assert.equal(submitSemGrupo.body.code, "INSCRICAO_INCOMPLETA");
    assert.equal(submitSemGrupo.body.details.includes("grupo de pesquisa"), true);

    const draftComGrupo = await request(app)
      .put(`/v1/editais/${editalId}/inscricao/rascunho`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        linhaPesquisaId: linha.id,
        grupoPesquisaId: grupo.body.id,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      });

    assert.equal(draftComGrupo.status, 200);
    assert.equal(draftComGrupo.body.grupoPesquisaId, grupo.body.id);

    const submitSemPreProjeto = await request(app)
      .post(`/v1/inscricoes/${draftComGrupo.body.id}/submeter`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(submitSemPreProjeto.status, 409);
    assert.equal(submitSemPreProjeto.body.code, "INSCRICAO_INCOMPLETA");
    assert.equal(
      submitSemPreProjeto.body.details.some((item: string) => item.includes("Pre-projeto")),
      true,
    );

    for (const tipo of [
      TipoDocumentoInscricao.ANEXO_IV,
      TipoDocumentoInscricao.ANEXO_V,
      TipoDocumentoInscricao.CURRICULO,
      TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO,
      TipoDocumentoInscricao.PRE_PROJETO,
      TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO,
    ]) {
      const documento = await addDocumento(token, draftComGrupo.body.id, tipo);
      assert.equal(documento.status, 201);
    }

    const submit = await request(app)
      .post(`/v1/inscricoes/${draftComGrupo.body.id}/submeter`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(submit.status, 200);
    assert.equal(submit.body.status, "SUBMETIDA");
    assert.equal(
      submit.body.submissaoSnapshot.inscricao.grupoPesquisaNome,
      "Grupo de Automacao",
    );
    assert.equal(submit.body.submissaoSnapshot.inscricao.modalidadeEtapa1, "PRE_PROJETO");

    const cancelar = await request(app)
      .post(`/v1/inscricoes/${draftComGrupo.body.id}/cancelar-submissao`)
      .set("Authorization", `Bearer ${token}`);

    assert.equal(cancelar.status, 409);
    assert.equal(cancelar.body.code, "CANCELAMENTO_SUBMISSAO_NAO_PERMITIDO");
  } finally {
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidateId].filter(Boolean) } } });
  }
});

test("banca do doutorado consolida pela media e bloqueia avaliacao duplicada", async () => {
  const suffix = `banca-doutorado-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);

  const avaliador1 = await prisma.usuario.create({
    data: {
      nomeCompleto: `Avaliador 1 ${suffix}`,
      email: `av1.${suffix}@teste.local`,
      senhaHash: await bcrypt.hash("Senha123456", 10),
      statusConta: StatusConta.ATIVA,
    },
  });
  const avaliador2 = await prisma.usuario.create({
    data: {
      nomeCompleto: `Avaliador 2 ${suffix}`,
      email: `av2.${suffix}@teste.local`,
      senhaHash: await bcrypt.hash("Senha123456", 10),
      statusConta: StatusConta.ATIVA,
    },
  });

  let editalId = "";

  try {
    const edital = await prisma.edital.create({
      data: {
        numero: `BANCA-${suffix}`,
        titulo: `Edital banca ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.DOUTORADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: new Date(),
        criadoPorId: admin.id,
      },
    });
    editalId = edital.id;

    const perfil = await request(app)
      .post(`/v1/admin/editais/${editalId}/perfil-processo/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-073-2026-doutorado" });
    assert.equal(perfil.status, 200);

    const candidato = await prisma.usuario.create({
      data: {
        nomeCompleto: `Candidato ${suffix}`,
        email: `cand.${suffix}@teste.local`,
        senhaHash: await bcrypt.hash("Senha123456", 10),
        statusConta: StatusConta.ATIVA,
        participacoes: { create: { editalId } },
      },
      include: { participacoes: true },
    });

    const inscricao = await prisma.inscricao.create({
      data: {
        participacaoEditalId: candidato.participacoes[0].id,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        status: "HOMOLOGADA_FINAL",
      },
    });

    const notasOito = [
      { chave: "clareza", nota: 1.6 },
      { chave: "objetividade", nota: 1.6 },
      { chave: "coerencia", nota: 1.6 },
      { chave: "relevancia", nota: 2.4 },
      { chave: "referencias", nota: 0.8 },
    ];
    const notasNove = [
      { chave: "clareza", nota: 1.8 },
      { chave: "objetividade", nota: 1.8 },
      { chave: "coerencia", nota: 1.8 },
      { chave: "relevancia", nota: 2.7 },
      { chave: "referencias", nota: 0.9 },
    ];

    const primeiro = await request(app)
      .put(`/v1/admin/etapa-1/inscricoes/${inscricao.id}/resultado`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        criterios: notasOito,
        avaliadorUsuarioId: avaliador1.id,
        usoIaComprovado: false,
        espelhoCorrecao: "Parecer do primeiro avaliador.",
        liberarEspelho: false,
        publicacao: "PRELIMINAR",
      });

    assert.equal(primeiro.status, 200);
    assert.equal(primeiro.body.bancaPendente, true);
    assert.equal(primeiro.body.avaliadoresRegistrados, 1);
    assert.equal(primeiro.body.avaliadoresNecessarios, 2);

    const consolidadaAindaAusente = await prisma.avaliacaoEtapa1.findUnique({ where: { inscricaoId: inscricao.id } });
    assert.equal(consolidadaAindaAusente, null);

    const segundo = await request(app)
      .put(`/v1/admin/etapa-1/inscricoes/${inscricao.id}/resultado`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        criterios: notasNove,
        avaliadorUsuarioId: avaliador2.id,
        usoIaComprovado: false,
        espelhoCorrecao: "Parecer do segundo avaliador.",
        liberarEspelho: false,
        publicacao: "PRELIMINAR",
      });

    assert.equal(segundo.status, 200);
    assert.equal(segundo.body.bancaPendente, false);
    assert.equal(Number(segundo.body.avaliacao.nota), 8.5);

    const duplicado = await request(app)
      .put(`/v1/admin/etapa-1/inscricoes/${inscricao.id}/resultado`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        criterios: notasNove,
        avaliadorUsuarioId: avaliador1.id,
        usoIaComprovado: false,
        espelhoCorrecao: "Tentativa de reavaliar.",
        liberarEspelho: false,
        publicacao: "PRELIMINAR",
      });

    assert.equal(duplicado.status, 409);
    assert.equal(duplicado.body.code, "AVALIADOR_JA_AVALIOU");

    const espelho = await request(app)
      .get(`/v1/admin/inscricoes/${inscricao.id}/etapa-1/espelho`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(espelho.status, 200);
    assert.equal(espelho.body.avaliadores.length, 2);
    assert.equal(espelho.body.notaConsolidada, 8.5);
    assert.equal(espelho.body.modalidadeEtapa1, "PRE_PROJETO");
  } finally {
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuario.deleteMany({
      where: { id: { in: [admin.id, avaliador1.id, avaliador2.id] } },
    });
  }
});