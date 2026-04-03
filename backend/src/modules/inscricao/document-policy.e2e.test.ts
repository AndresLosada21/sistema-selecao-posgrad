import assert from "node:assert/strict";
import test from "node:test";

import { CursoNivel, ModalidadeConcorrencia, Role, StatusConta, StatusEdital, StatusInscricao } from "@prisma/client";
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

    assert.equal(httpDocumento.status, 409);

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

    const documentoValido = await request(app)
      .post(`/v1/inscricoes/${inscricaoId}/documentos`)
      .set("Authorization", `Bearer ${candidatoToken}`)
      .send({
        tipo: "ANEXO_IV",
        nome: "Anexo IV",
        urlArquivo: "https://arquivos.teste/anexo-iv.pdf",
        nomeArquivo: "anexo-iv.pdf",
        mimeType: "application/pdf",
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

    assert.equal(pacoteInvalido.status, 409);

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
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: { in: [admin.id, candidato.id] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidato.id] } } });
  }
});
