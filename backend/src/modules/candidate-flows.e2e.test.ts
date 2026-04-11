import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  ModalidadeConcorrencia,
  Role,
  StatusConta,
  StatusEdital,
  StatusInscricao,
  TipoCronogramaEdital,
  TipoDocumentoInscricao,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
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

async function createEditalWithWindows(input: {
  suffix: string;
  adminId: string;
  inscricaoAberta: boolean;
  isencaoAberta: boolean;
}) {
  const now = new Date();
  const before = new Date(now.getTime() - 60_000);
  const after = new Date(now.getTime() + 60_000);
  const longBefore = new Date(now.getTime() - 120_000);
  const longAfter = new Date(now.getTime() - 60_000);

  return prisma.edital.create({
    data: {
      numero: `ED-${input.suffix}`,
      titulo: `Edital ${input.suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.PUBLICADO,
      publicadoEm: now,
      criadoPorId: input.adminId,
      cronogramas: {
        create: [
          {
            tipo: TipoCronogramaEdital.INSCRICAO,
            titulo: "Inscricao",
            inicioEm: input.inscricaoAberta ? before : longBefore,
            fimEm: input.inscricaoAberta ? after : longAfter,
          },
          {
            tipo: TipoCronogramaEdital.PEDIDO_ISENCAO,
            titulo: "Isencao",
            inicioEm: input.isencaoAberta ? before : longBefore,
            fimEm: input.isencaoAberta ? after : longAfter,
          },
        ],
      },
      temasRedacao: {
        create: [
          {
            titulo: "Controle e automacao aplicada a sistemas energeticos",
            descricao: "Tema tecnico padrao do fluxo E2E.",
            ordem: 0,
            ativo: true,
          },
        ],
      },
    },
    include: {
      temasRedacao: true,
    },
  });
}

async function uploadPrivatePdf(token: string, filename: string) {
  const response = await request(app)
    .post("/v1/uploads")
    .set("Authorization", `Bearer ${token}`)
    .attach("file", Buffer.from("%PDF-1.4 teste"), { filename, contentType: "application/pdf" });

  assert.equal(response.status, 201);
  return response.body as { urlArquivo: string; nomeArquivo: string; mimeType: string };
}

async function registerCandidate(input: { suffix: string; cpf: string }) {
  return request(app)
    .post("/v1/auth/register")
    .send({
      nomeCompleto: `Candidato ${input.suffix}`,
      email: `candidato.${input.suffix}@teste.local`,
      senha: "Senha123456",
      telefone: "92999999999",
      cpf: input.cpf,
    });
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

test("candidato percorre conta, isencao, inscricao, submissao e cancelamento dentro da janela", async () => {
  const suffix = `candidate-flow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);

  let editalId = "";
  let linhaId = "";
  let candidateId = "";

  try {
    const candidateRegister = await registerCandidate({ suffix, cpf: `${Date.now()}`.slice(-11) });
    assert.equal(candidateRegister.status, 201);
    candidateId = candidateRegister.body.user.id;
    const token = candidateRegister.body.token as string;

    const edital = await createEditalWithWindows({ suffix, adminId: admin.id, inscricaoAberta: true, isencaoAberta: true });
    editalId = edital.id;
    const temaId = edital.temasRedacao[0]?.id;
    assert.ok(temaId);

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

    const participacoesVazias = await request(app)
      .get("/v1/candidato/participacoes")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(participacoesVazias.status, 200);
    assert.equal(participacoesVazias.body.total, 0);

    const comprovanteIsencao = await uploadPrivatePdf(token, "isencao.pdf");

    const isencaoResponse = await request(app)
      .post(`/v1/editais/${editalId}/isencao`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        cursoNivel: "MESTRADO",
        inscritoCadUnico: false,
        justificativa: "Solicito isencao por impossibilidade financeira.",
        comprovanteUrl: comprovanteIsencao.urlArquivo,
        comprovanteNomeArquivo: comprovanteIsencao.nomeArquivo,
      });

    assert.equal(isencaoResponse.status, 201);

    const comprovanteDuplicado = await uploadPrivatePdf(token, "isencao-duplicada.pdf");

    const duplicateIsencaoResponse = await request(app)
      .post(`/v1/editais/${editalId}/isencao`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        cursoNivel: "MESTRADO",
        inscritoCadUnico: false,
        justificativa: "Nova tentativa de pedido de isencao no mesmo edital.",
        comprovanteUrl: comprovanteDuplicado.urlArquivo,
        comprovanteNomeArquivo: comprovanteDuplicado.nomeArquivo,
      });

    assert.equal(duplicateIsencaoResponse.status, 409);
    assert.equal(duplicateIsencaoResponse.body.code, "PEDIDO_ISENCAO_JA_EXISTENTE");

    const isencoesList = await request(app)
      .get("/v1/candidato/isencoes")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(isencoesList.status, 200);
    assert.equal(isencoesList.body.total, 1);

    const draftResponse = await request(app)
      .put(`/v1/editais/${editalId}/inscricao/rascunho`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        linhaPesquisaId: linhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        temaRedacaoEditalId: temaId,
        temaRedacao: "Controle e automacao aplicada a sistemas energeticos",
        resumoCurriculo: "Experiencia em pesquisa e desenvolvimento na area.",
        redacaoTexto: "A".repeat(600),
        fichaInscricao: {
          nomeCompleto: `Candidato ${suffix}`,
          rg: "1234567",
          rgDataExpedicao: "2020-01-01",
          cpf: candidateRegister.body.user.cpf,
          nacionalidade: "Brasileira",
          naturalidade: "Manaus",
          email: `candidato.${suffix}@teste.local`,
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
      });

    assert.equal(draftResponse.status, 200);
    const inscricaoId = draftResponse.body.id as string;

    for (const tipo of [
      TipoDocumentoInscricao.ANEXO_IV,
      TipoDocumentoInscricao.ANEXO_V,
      TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO,
      TipoDocumentoInscricao.DIPLOMA,
      TipoDocumentoInscricao.HISTORICO,
      TipoDocumentoInscricao.CURRICULO,
      TipoDocumentoInscricao.COMPROVANTE_PAGAMENTO,
    ]) {
      const documentoResponse = await addDocumento(token, inscricaoId, tipo);
      assert.equal(documentoResponse.status, 201);
    }

    const submitResponse = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/submeter`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(submitResponse.status, 200);
    assert.equal(submitResponse.body.status, StatusInscricao.SUBMETIDA);

    const candidatePacoteResponse = await request(app)
      .get(`/v1/inscricoes/${inscricaoId}/pacote-documental`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(candidatePacoteResponse.status, 200);
    assert.equal(candidatePacoteResponse.body.pacoteDocumental.versaoSubmissao, 1);
    assert.match(candidatePacoteResponse.body.pacoteDocumental.nomeArquivo, new RegExp(`^inscricao-${inscricaoId}-v1\\.pdf$`));
    assert.match(candidatePacoteResponse.body.pacoteDocumental.urlArquivo, new RegExp(`^/v1/uploads/private/${candidateId}/`));

    const pacotePdfDownload = await request(app)
      .get(candidatePacoteResponse.body.pacoteDocumental.urlArquivo)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(pacotePdfDownload.status, 200);
    const pacotePdf = await PDFDocument.load(pacotePdfDownload.body);
    assert.ok(pacotePdf.getPageCount() > 1);

    const inscricoesList = await request(app)
      .get("/v1/candidato/inscricoes")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(inscricoesList.status, 200);
    assert.equal(inscricoesList.body.total, 1);
    assert.equal(inscricoesList.body.items[0].id, inscricaoId);

    const cancelResponse = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/cancelar-submissao`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(cancelResponse.status, 200);
    assert.equal(cancelResponse.body.status, StatusInscricao.RASCUNHO);

    const participacoes = await request(app)
      .get("/v1/candidato/participacoes")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(participacoes.status, 200);
    assert.equal(participacoes.body.total, 1);
    assert.equal(participacoes.body.items[0].edital.id, editalId);
  } finally {
    if (candidateId) {
      const participacoes = await prisma.participacaoEdital.findMany({ where: { usuarioId: candidateId }, select: { id: true } });
      const participacaoIds = participacoes.map((participacao) => participacao.id);
      await prisma.pedidoIsencao.deleteMany({ where: { participacaoEditalId: { in: participacaoIds } } });
      await prisma.documentoInscricao.deleteMany({ where: { inscricao: { participacaoEditalId: { in: participacaoIds } } } });
      await prisma.inscricao.deleteMany({ where: { participacaoEditalId: { in: participacaoIds } } });
      await prisma.participacaoEdital.deleteMany({ where: { id: { in: participacaoIds } } });
    }
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [admin.id, candidateId].filter(Boolean) as string[] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidateId].filter(Boolean) as string[] } } });
  }
});

test("fluxos do candidato rejeitam duplicidade, janela fechada e submissao incompleta", async () => {
  const suffix = `candidate-negative-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);

  let closedEditalId = "";
  let openEditalId = "";
  let closedLinhaId = "";
  let openLinhaId = "";
  let candidateId = "";

  try {
    const firstRegister = await registerCandidate({ suffix, cpf: `${Date.now()}`.slice(-11) });
    assert.equal(firstRegister.status, 201);
    candidateId = firstRegister.body.user.id;
    const token = firstRegister.body.token as string;

    const duplicateEmail = await request(app)
      .post("/v1/auth/register")
      .send({
        nomeCompleto: "Outro Candidato",
        email: `candidato.${suffix}@teste.local`,
        senha: "Senha123456",
        telefone: "92999999999",
        cpf: `${Date.now() + 1}`.toString().slice(-11),
    });
    assert.equal(duplicateEmail.status, 409);
    assert.equal(duplicateEmail.body.code, "EMAIL_ALREADY_IN_USE");

    const duplicateCpf = await request(app)
      .post("/v1/auth/register")
      .send({
        nomeCompleto: "Outro Candidato",
        email: `outro.${suffix}@teste.local`,
        senha: "Senha123456",
        telefone: "92999999999",
        cpf: firstRegister.body.user.cpf,
    });
    assert.equal(duplicateCpf.status, 409);
    assert.equal(duplicateCpf.body.code, "CPF_ALREADY_IN_USE");

    const invalidLogin = await request(app)
      .post("/v1/auth/login")
      .send({ email: `candidato.${suffix}@teste.local`, senha: "SenhaErrada123" });
    assert.equal(invalidLogin.status, 401);
    assert.equal(invalidLogin.body.code, "INVALID_CREDENTIALS");

    const invalidRegisterBody = await request(app)
      .post("/v1/auth/register")
      .send({ nomeCompleto: "x" });
    assert.equal(invalidRegisterBody.status, 400);
    assert.equal(invalidRegisterBody.body.code, "VALIDATION_ERROR");

    const closedEdital = await createEditalWithWindows({ suffix: `closed-${suffix}`, adminId: admin.id, inscricaoAberta: false, isencaoAberta: false });
    closedEditalId = closedEdital.id;

    const closedLinha = await prisma.linhaPesquisa.create({
      data: {
        editalId: closedEditalId,
        nome: `Linha fechada ${suffix}`,
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 0,
        vagasPcd: 0,
      },
    });
    closedLinhaId = closedLinha.id;

    const comprovanteForaJanela = await uploadPrivatePdf(token, "isencao-fechada.pdf");

    const closedIsencao = await request(app)
      .post(`/v1/editais/${closedEditalId}/isencao`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        cursoNivel: "MESTRADO",
        inscritoCadUnico: false,
        justificativa: "Teste fora da janela.",
        comprovanteUrl: comprovanteForaJanela.urlArquivo,
        comprovanteNomeArquivo: comprovanteForaJanela.nomeArquivo,
      });
    assert.equal(closedIsencao.status, 409);
    assert.equal(closedIsencao.body.code, "JANELA_ISENCAO_FECHADA");

    const closedDraft = await request(app)
      .put(`/v1/editais/${closedEditalId}/inscricao/rascunho`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        linhaPesquisaId: closedLinhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      });
    assert.equal(closedDraft.status, 409);
    assert.equal(closedDraft.body.code, "JANELA_INSCRICAO_FECHADA");
    assert.equal(closedDraft.body.message, "JANELA_INSCRICAO_FECHADA");

    const openEdital = await createEditalWithWindows({ suffix: `open-${suffix}`, adminId: admin.id, inscricaoAberta: true, isencaoAberta: false });
    openEditalId = openEdital.id;
    const openTemaId = openEdital.temasRedacao[0]?.id;
    assert.ok(openTemaId);

    const openLinha = await prisma.linhaPesquisa.create({
      data: {
        editalId: openEditalId,
        nome: `Linha ${suffix}`,
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 0,
        vagasPcd: 0,
      },
    });
    openLinhaId = openLinha.id;

    const incompleteDraft = await request(app)
      .put(`/v1/editais/${openEditalId}/inscricao/rascunho`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        linhaPesquisaId: openLinhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        temaRedacaoEditalId: openTemaId,
      });
    assert.equal(incompleteDraft.status, 200);

    const inscricaoId = incompleteDraft.body.id as string;

    const incompleteSubmit = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/submeter`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(incompleteSubmit.status, 409);
    assert.equal(incompleteSubmit.body.code, "INSCRICAO_INCOMPLETA");
    assert.equal(typeof incompleteSubmit.body.message, "string");
    assert.equal(Array.isArray(incompleteSubmit.body.checklist), true);

    await prisma.cronogramaEdital.updateMany({
      where: { editalId: openEditalId, tipo: TipoCronogramaEdital.INSCRICAO },
      data: {
        inicioEm: new Date(Date.now() - 120_000),
        fimEm: new Date(Date.now() - 60_000),
      },
    });

    const documentoForaJanela = await uploadPrivatePdf(token, "anexo-iv-fora-da-janela.pdf");

    const documentoOutsideWindow = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/documentos`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        tipo: "ANEXO_IV",
        nome: "Anexo IV fora da janela",
        urlArquivo: documentoForaJanela.urlArquivo,
        nomeArquivo: documentoForaJanela.nomeArquivo,
        mimeType: "application/pdf",
      });
    assert.equal(documentoOutsideWindow.status, 409);
    assert.equal(documentoOutsideWindow.body.code, "JANELA_INSCRICAO_FECHADA");

    await prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        status: StatusInscricao.SUBMETIDA,
        submetidaEm: new Date(),
        versaoSubmissao: 1,
      },
    });

    const cancelOutsideWindow = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/cancelar-submissao`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(cancelOutsideWindow.status, 409);
    assert.equal(cancelOutsideWindow.body.code, "JANELA_INSCRICAO_FECHADA");
    assert.equal(typeof cancelOutsideWindow.body.message, "string");
  } finally {
    if (candidateId) {
      const participacoes = await prisma.participacaoEdital.findMany({ where: { usuarioId: candidateId }, select: { id: true } });
      const participacaoIds = participacoes.map((participacao) => participacao.id);
      await prisma.pedidoIsencao.deleteMany({ where: { participacaoEditalId: { in: participacaoIds } } });
      await prisma.documentoInscricao.deleteMany({ where: { inscricao: { participacaoEditalId: { in: participacaoIds } } } });
      await prisma.inscricao.deleteMany({ where: { participacaoEditalId: { in: participacaoIds } } });
      await prisma.participacaoEdital.deleteMany({ where: { id: { in: participacaoIds } } });
    }
    if (closedLinhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: closedLinhaId } });
    if (openLinhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: openLinhaId } });
    if (closedEditalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId: closedEditalId } });
    if (openEditalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId: openEditalId } });
    if (closedEditalId) await prisma.edital.deleteMany({ where: { id: closedEditalId } });
    if (openEditalId) await prisma.edital.deleteMany({ where: { id: openEditalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [admin.id, candidateId].filter(Boolean) as string[] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidateId].filter(Boolean) as string[] } } });
  }
});
