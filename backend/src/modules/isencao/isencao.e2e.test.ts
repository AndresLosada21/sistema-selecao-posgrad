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

test("isencao completa permite recurso e dispensa comprovante de pagamento na submissao", async () => {
  const suffix = `isencao-e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const candidato = await createUser(suffix, Role.CANDIDATO);
  const adminToken = createToken(admin.id, admin.email);
  const candidatoToken = createToken(candidato.id, candidato.email);
  const now = new Date();

  const edital = await prisma.edital.create({
    data: {
      numero: `ISE-${suffix}`,
      titulo: `Edital ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.PUBLICADO,
      publicadoEm: now,
      criadoPorId: admin.id,
      cronogramas: {
        create: [TipoCronogramaEdital.PEDIDO_ISENCAO, TipoCronogramaEdital.RECURSO_ISENCAO, TipoCronogramaEdital.INSCRICAO].map((tipo) => ({
          tipo,
          titulo: tipo,
          inicioEm: new Date(now.getTime() - 60_000),
          fimEm: new Date(now.getTime() + 60_000),
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

  const pedido = await request(app)
    .post(`/v1/editais/${edital.id}/isencao`)
    .set("Authorization", `Bearer ${candidatoToken}`)
    .send({ cursoNivel: CursoNivel.MESTRADO, inscritoCadUnico: true });

  assert.equal(pedido.status, 201);

  const preliminar = await request(app)
    .put(`/v1/admin/isencoes/${pedido.body.id}/preliminar`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ deferida: false, parecer: "Indeferimento preliminar para exercitar recurso." });

  assert.equal(preliminar.status, 200);

  const recurso = await request(app)
    .post("/v1/candidato/recursos")
    .set("Authorization", `Bearer ${candidatoToken}`)
    .send({ editalId: edital.id, fase: FaseRecurso.ISENCAO, fundamentacao: "Recurso contra indeferimento preliminar da isencao." });

  assert.equal(recurso.status, 201);

  const decisao = await request(app)
    .put(`/v1/admin/recursos/${recurso.body.id}/decisao`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      deferido: true,
      decisao: "Recurso deferido com dispensa final da taxa.",
      impactoResultado: true,
      novoStatusIsencao: "DEFERIDA_FINAL",
    });

  assert.equal(decisao.status, 200);

  const participacao = await prisma.participacaoEdital.findUniqueOrThrow({
    where: { usuarioId_editalId: { usuarioId: candidato.id, editalId: edital.id } },
  });

  const inscricao = await prisma.inscricao.create({
    data: {
      participacaoEditalId: participacao.id,
      linhaPesquisaId: linha.id,
      temaRedacaoEditalId: edital.temasRedacao[0].id,
      modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
      status: StatusInscricao.RASCUNHO,
      temaRedacao: edital.temasRedacao[0].titulo,
      redacaoTexto: "A".repeat(600),
      resumoCurriculo: "Resumo curricular para submissao.",
      dadosFormulario: fichaInscricao(suffix, candidato.email),
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

  const submissao = await request(app)
    .post(`/v1/inscricoes/${inscricao.id}/submeter`)
    .set("Authorization", `Bearer ${candidatoToken}`);

  assert.equal(submissao.status, 200);
  assert.equal(submissao.body.statusPagamento, "DISPENSADO");
});
