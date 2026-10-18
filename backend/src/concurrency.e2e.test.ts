import assert from "node:assert/strict";
import test from "node:test";

import {
  CursoNivel,
  FaseRecurso,
  ModalidadeConcorrencia,
  Role,
  StatusConta,
  StatusEdital,
  StatusInscricao,
  StatusIsencao,
  StatusRecurso,
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

const { prisma } = await import("./lib/prisma.js");
const { app } = await import("./app.js");

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

function fichaInscricao(suffix: string, email: string) {
  return {
    nomeCompleto: `Candidato ${suffix}`,
    rg: "1234567",
    rgDataExpedicao: "2020-01-01",
    cpf: `${Date.now()}`.slice(-11).padStart(11, "0"),
    nacionalidade: "Brasileira",
    naturalidade: "Manaus",
    email,
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
  };
}

async function createEditalFixture(suffix: string, adminId: string, recursoEtapa1Aberto = false) {
  const now = new Date();
  const edital = await prisma.edital.create({
    data: {
      numero: `CON-${suffix}`,
      titulo: `Edital ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.PUBLICADO,
      publicadoEm: now,
      criadoPorId: adminId,
      cronogramas: {
        create: [
          TipoCronogramaEdital.INSCRICAO,
          TipoCronogramaEdital.RECURSO_ISENCAO,
          ...(recursoEtapa1Aberto ? [TipoCronogramaEdital.RECURSO_ETAPA_1] : []),
        ].map((tipo) => ({
          tipo,
          titulo: tipo,
          inicioEm: new Date(now.getTime() - 60_000),
          fimEm: new Date(now.getTime() + 60_000),
        })),
      },
      temasRedacao: { create: [{ titulo: "Controle e automacao", descricao: "Tema", ordem: 0, ativo: true }] },
    },
    include: { temasRedacao: true },
  });

  const linha = await prisma.linhaPesquisa.create({
    data: { editalId: edital.id, nome: `Linha ${suffix}`, vagasAmplaConcorrencia: 1, vagasAcoesAfirmativas: 0, vagasPcd: 0 },
  });

  return { edital, linha };
}

async function createRascunhoCompleto(suffix: string, usuarioId: string, email: string, editalId: string, linhaId: string, temaId: string, temaTitulo: string) {
  const participacao = await prisma.participacaoEdital.create({ data: { usuarioId, editalId } });
  await prisma.pedidoIsencao.create({
    data: { participacaoEditalId: participacao.id, cursoNivel: CursoNivel.MESTRADO, inscritoCadUnico: true, status: StatusIsencao.DEFERIDA_FINAL },
  });
  const inscricao = await prisma.inscricao.create({
    data: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: linhaId,
      temaRedacaoEditalId: temaId,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      status: StatusInscricao.RASCUNHO,
      temaRedacao: temaTitulo,
      redacaoTexto: "A".repeat(600),
      resumoCurriculo: "Resumo curricular.",
      dadosFormulario: fichaInscricao(suffix, email),
    },
  });

  await prisma.documentoInscricao.createMany({
    data: [
      TipoDocumentoInscricao.ANEXO_IV,
      TipoDocumentoInscricao.ANEXO_V,
      TipoDocumentoInscricao.DOCUMENTO_IDENTIFICACAO,
      TipoDocumentoInscricao.DIPLOMA,
      TipoDocumentoInscricao.HISTORICO,
      TipoDocumentoInscricao.CURRICULO,
    ].map((tipo) => ({
      inscricaoId: inscricao.id,
      tipo,
      nome: `Documento ${tipo}`,
      nomeArquivo: `${tipo.toLowerCase()}.pdf`,
      urlArquivo: `https://arquivos.test/${tipo.toLowerCase()}.pdf`,
      mimeType: "application/pdf",
      tamanhoBytes: 100,
    })),
  });

  return { inscricao, participacao };
}

test("submissao concorrente da mesma inscricao permite apenas uma transicao", async () => {
  const suffix = `submit-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const candidato = await createUser(suffix, Role.CANDIDATO);
  const token = createToken(candidato.id, candidato.email);
  const { edital, linha } = await createEditalFixture(suffix, admin.id);
  const { inscricao } = await createRascunhoCompleto(suffix, candidato.id, candidato.email, edital.id, linha.id, edital.temasRedacao[0].id, edital.temasRedacao[0].titulo);

  const responses = await Promise.all([
    request(app).post(`/v1/inscricoes/${inscricao.id}/submeter`).set("Authorization", `Bearer ${token}`),
    request(app).post(`/v1/inscricoes/${inscricao.id}/submeter`).set("Authorization", `Bearer ${token}`),
  ]);

  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.equal(responses.filter((response) => response.status === 409).length, 1);
});

test("decisao concorrente do mesmo recurso permite apenas uma resposta final", async () => {
  const suffix = `recurso-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const candidato = await createUser(suffix, Role.CANDIDATO);
  const adminToken = createToken(admin.id, admin.email);
  const { edital } = await createEditalFixture(suffix, admin.id);
  const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId: edital.id } });
  await prisma.pedidoIsencao.create({
    data: { participacaoEditalId: participacao.id, cursoNivel: CursoNivel.MESTRADO, inscritoCadUnico: true, status: StatusIsencao.INDEFERIDA_PRELIMINAR },
  });
  const recurso = await prisma.recurso.create({
    data: {
      editalId: edital.id,
      participacaoEditalId: participacao.id,
      criadoPorId: candidato.id,
      fase: FaseRecurso.ISENCAO,
      fundamentacao: "Recurso para decisao concorrente.",
      status: StatusRecurso.ABERTO,
    },
  });

  const responses = await Promise.all([
    request(app).put(`/v1/admin/recursos/${recurso.id}/decisao`).set("Authorization", `Bearer ${adminToken}`).send({ deferido: false, decisao: "Indeferido.", impactoResultado: false }),
    request(app).put(`/v1/admin/recursos/${recurso.id}/decisao`).set("Authorization", `Bearer ${adminToken}`).send({ deferido: false, decisao: "Indeferido.", impactoResultado: false }),
  ]);

  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.equal(responses.filter((response) => response.status === 409).length, 1);
});

test("registro concorrente da etapa 1 preserva um unico resultado preliminar", async () => {
  const suffix = `etapa1-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const candidato = await createUser(suffix, Role.CANDIDATO);
  const adminToken = createToken(admin.id, admin.email);
  const { edital, linha } = await createEditalFixture(suffix, admin.id, true);
  const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId: edital.id } });
  const inscricao = await prisma.inscricao.create({
    data: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: linha.id,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      status: StatusInscricao.HOMOLOGADA_FINAL,
      redacaoTexto: "A".repeat(600),
      temaRedacao: edital.temasRedacao[0].titulo,
      dadosFormulario: fichaInscricao(suffix, candidato.email),
    },
  });
  const payload = {
    criterios: [
      { chave: "adequacaoDominioTema", nota: 8 },
      { chave: "estrutura", nota: 8 },
      { chave: "organizacaoCoerencia", nota: 8 },
      { chave: "objetividadeSintese", nota: 8 },
      { chave: "grafiaGramatica", nota: 8 },
    ],
    usoIaComprovado: false,
    espelhoCorrecao: "Espelho preliminar concorrente.",
    liberarEspelho: false,
    publicacao: "PRELIMINAR",
  };

  const responses = await Promise.all([
    request(app).put(`/v1/admin/etapa-1/inscricoes/${inscricao.id}/resultado`).set("Authorization", `Bearer ${adminToken}`).send(payload),
    request(app).put(`/v1/admin/etapa-1/inscricoes/${inscricao.id}/resultado`).set("Authorization", `Bearer ${adminToken}`).send(payload),
  ]);

  assert.equal(responses.filter((response) => response.status === 200).length, 1);
  assert.equal(responses.filter((response) => response.status === 409).length, 1);

  const totalAvaliacoes = await prisma.avaliacaoEtapa1.count({ where: { inscricaoId: inscricao.id } });
  assert.equal(totalAvaliacoes, 1);
});
