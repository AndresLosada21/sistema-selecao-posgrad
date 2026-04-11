import assert from "node:assert/strict";
import test from "node:test";

import { CursoNivel, ModalidadeConcorrencia, Role, StatusConta, StatusEdital, StatusInscricao, TipoCronogramaEdital } from "@prisma/client";
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

async function uploadPrivatePdf(token: string, filename: string) {
  const response = await request(app)
    .post("/v1/uploads")
    .set("Authorization", `Bearer ${token}`)
    .attach("file", Buffer.from("%PDF-1.4 teste"), { filename, contentType: "application/pdf" });

  assert.equal(response.status, 201);
  return response.body as { urlArquivo: string; nomeArquivo: string; mimeType: string };
}

test("politica de PDF exige https, extensao .pdf e mimeType coerente", async () => {
  const suffix = `doc-policy-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const candidato = await createUser(suffix, Role.CANDIDATO);

  let editalId = "";
  let linhaId = "";
  let participacaoId = "";
  let inscricaoId = "";

  try {
    const adminToken = createToken(admin.id, admin.email);
    const candidatoToken = createToken(candidato.id, candidato.email);

    const edital = await prisma.edital.create({
      data: {
        numero: `DOC-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: new Date(),
        criadoPorId: admin.id,
        cronogramas: {
          create: [{
            tipo: TipoCronogramaEdital.INSCRICAO,
            titulo: `Inscricao ${suffix}`,
            inicioEm: new Date(Date.now() - 60_000),
            fimEm: new Date(Date.now() + 60_000),
          }],
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
        status: StatusInscricao.RASCUNHO,
        dadosFormulario: { nomeCompleto: candidato.nomeCompleto, email: candidato.email },
      },
    });
    inscricaoId = inscricao.id;

    const httpDocumento = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/documentos`)
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        tipo: "ANEXO_IV",
        nome: "Anexo IV",
        urlArquivo: "http://arquivos.teste/anexo-iv.pdf",
        nomeArquivo: "anexo-iv.pdf",
        mimeType: "application/pdf",
      });

    assert.equal(httpDocumento.status, 400);

    const mimeInvalidoDocumento = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/documentos`)
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        tipo: "ANEXO_IV",
        nome: "Anexo IV",
        urlArquivo: "https://arquivos.teste/anexo-iv.pdf",
        nomeArquivo: "anexo-iv.pdf",
        mimeType: "text/plain",
      });

    assert.equal(mimeInvalidoDocumento.status, 409);

    const documentoUpload = await uploadPrivatePdf(candidatoToken, "anexo-iv.pdf");

    const documentoValido = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/documentos`)
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        tipo: "ANEXO_IV",
        nome: "Anexo IV",
        urlArquivo: documentoUpload.urlArquivo,
        nomeArquivo: documentoUpload.nomeArquivo,
        mimeType: documentoUpload.mimeType,
      });

    assert.equal(documentoValido.status, 201);

    await prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        status: StatusInscricao.SUBMETIDA,
        submetidaEm: new Date(),
        versaoSubmissao: 1,
      },
    });

    const pacoteInvalido = await request(app)
      .post(`/v1/admin/inscricoes/${inscricaoId}/pacote-documental`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        urlArquivo: "https://arquivos.teste/pacote-documental.txt",
        nomeArquivo: "pacote-documental.pdf",
        mimeType: "application/pdf",
      });

    assert.equal(pacoteInvalido.status, 400);

    const pacoteValido = await request(app)
      .post(`/v1/admin/inscricoes/${inscricaoId}/pacote-documental`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        urlArquivo: "https://arquivos.teste/pacote-documental.pdf",
        nomeArquivo: "pacote-documental.pdf",
        mimeType: "application/pdf",
      });

    assert.equal(pacoteValido.status, 201);
  } finally {
    if (inscricaoId) await prisma.documentoInscricao.deleteMany({ where: { inscricaoId } });
    if (inscricaoId) await prisma.inscricao.deleteMany({ where: { id: inscricaoId } });
    if (participacaoId) await prisma.participacaoEdital.deleteMany({ where: { id: participacaoId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
     if (editalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId } });
     if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [admin.id, candidato.id] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidato.id] } } });
  }
});

test("nao permite vincular upload privado de outro usuario em inscricao ou isencao", async () => {
  const suffix = `upload-ownership-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createUser(suffix, Role.ADMIN);
  const owner = await createUser(`${suffix}-owner`, Role.CANDIDATO);
  const stranger = await createUser(`${suffix}-stranger`, Role.CANDIDATO);

  let editalId = "";
  let ownerParticipacaoId = "";
  let strangerParticipacaoId = "";
  let ownerInscricaoId = "";
  let ownerLinhaId = "";

  try {
    const ownerToken = createToken(owner.id, owner.email);
    const strangerToken = createToken(stranger.id, stranger.email);

    const edital = await prisma.edital.create({
      data: {
        numero: `OWN-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: new Date(),
        criadoPorId: admin.id,
        cronogramas: {
          create: [
            {
              tipo: TipoCronogramaEdital.INSCRICAO,
              titulo: `Inscricao ${suffix}`,
              inicioEm: new Date(Date.now() - 60_000),
              fimEm: new Date(Date.now() + 60_000),
            },
            {
              tipo: TipoCronogramaEdital.PEDIDO_ISENCAO,
              titulo: `Isencao ${suffix}`,
              inicioEm: new Date(Date.now() - 60_000),
              fimEm: new Date(Date.now() + 60_000),
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
    ownerLinhaId = linha.id;

    const ownerParticipacao = await prisma.participacaoEdital.create({ data: { usuarioId: owner.id, editalId } });
    ownerParticipacaoId = ownerParticipacao.id;
    const strangerParticipacao = await prisma.participacaoEdital.create({ data: { usuarioId: stranger.id, editalId } });
    strangerParticipacaoId = strangerParticipacao.id;

    const ownerInscricao = await prisma.inscricao.create({
      data: {
        participacaoEditalId: ownerParticipacaoId,
        linhaPesquisaId: ownerLinhaId,
        modalidadeConcorrencia: ModalidadeConcorrencia.AMPLA_CONCORRENCIA,
        status: StatusInscricao.RASCUNHO,
      },
    });
    ownerInscricaoId = ownerInscricao.id;

    const documentoEstrangeiro = await request(app)
      .post(`/v1/inscricoes/${ownerInscricaoId}/documentos`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        tipo: "ANEXO_IV",
        nome: "Anexo IV",
        urlArquivo: `/v1/uploads/private/${stranger.id}/arquivo-de-terceiro.pdf`,
        nomeArquivo: "arquivo-de-terceiro.pdf",
        mimeType: "application/pdf",
      });

    assert.equal(documentoEstrangeiro.status, 409);
    assert.equal(documentoEstrangeiro.body.code, "UPLOAD_SEM_PERMISSAO");

    const documentoForjadoMesmoOwner = await request(app)
      .post(`/v1/inscricoes/${ownerInscricaoId}/documentos`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        tipo: "ANEXO_IV",
        nome: "Anexo IV inexistente",
        urlArquivo: `/v1/uploads/private/${owner.id}/arquivo-inexistente.pdf`,
        nomeArquivo: "arquivo-inexistente.pdf",
        mimeType: "application/pdf",
      });

    assert.equal(documentoForjadoMesmoOwner.status, 409);
    assert.equal(documentoForjadoMesmoOwner.body.code, "UPLOAD_NAO_ENCONTRADO");

    const isencaoEstrangeira = await request(app)
      .post(`/v1/editais/${editalId}/isencao`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        cursoNivel: "MESTRADO",
        inscritoCadUnico: false,
        justificativa: "Teste de ownership de upload privado.",
        comprovanteUrl: `/v1/uploads/private/${stranger.id}/comprovante-de-terceiro.pdf`,
        comprovanteNomeArquivo: "comprovante-de-terceiro.pdf",
      });

    assert.equal(isencaoEstrangeira.status, 409);
    assert.equal(isencaoEstrangeira.body.code, "UPLOAD_SEM_PERMISSAO");

    const isencaoForjadaMesmoOwner = await request(app)
      .post(`/v1/editais/${editalId}/isencao`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        cursoNivel: "MESTRADO",
        inscritoCadUnico: false,
        justificativa: "Teste de upload privado inexistente do proprio usuario.",
        comprovanteUrl: `/v1/uploads/private/${owner.id}/comprovante-inexistente.pdf`,
        comprovanteNomeArquivo: "comprovante-inexistente.pdf",
      });

    assert.equal(isencaoForjadaMesmoOwner.status, 409);
    assert.equal(isencaoForjadaMesmoOwner.body.code, "UPLOAD_NAO_ENCONTRADO");
  } finally {
    if (ownerInscricaoId) await prisma.documentoInscricao.deleteMany({ where: { inscricaoId: ownerInscricaoId } });
    if (ownerInscricaoId) await prisma.inscricao.deleteMany({ where: { id: ownerInscricaoId } });
    if (ownerParticipacaoId) await prisma.pedidoIsencao.deleteMany({ where: { participacaoEditalId: ownerParticipacaoId } });
    if (ownerParticipacaoId || strangerParticipacaoId) {
      await prisma.participacaoEdital.deleteMany({ where: { id: { in: [ownerParticipacaoId, strangerParticipacaoId].filter(Boolean) } } });
    }
    if (ownerLinhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: ownerLinhaId } });
    if (editalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [admin.id, owner.id, stranger.id] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, owner.id, stranger.id] } } });
  }
});
