import assert from "node:assert/strict";
import test from "node:test";

import { CursoNivel, Role, StatusConta, StatusEdital, TipoCronogramaEdital } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-real-environments";

const { prisma } = await import("../../lib/prisma.js");
const { app } = await import("../../app.js");
const { getCriterioTitulacaoPacoteBySlug } = await import("./criterios-titulacao-padroes.js");
const { getTemaRedacaoPacoteBySlug } = await import("./temas-redacao-padroes.js");

function createToken(userId: string, email: string) {
  return jwt.sign({ email }, process.env.JWT_SECRET!, { subject: userId, expiresIn: "7d" });
}

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

async function createCandidate(suffix: string) {
  const senhaHash = await bcrypt.hash("Senha123456", 10);

  return prisma.usuario.create({
    data: {
      nomeCompleto: `Candidato ${suffix}`,
      email: `candidato.${suffix}@teste.local`,
      senhaHash,
      statusConta: StatusConta.ATIVA,
    },
  });
}

test("lista publica de editais respeita total paginado e bloqueia rascunhos", async () => {
  const suffix = `edital-list-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);
  const now = new Date();

  const createdEditais: string[] = [];

  try {
    const draft = await prisma.edital.create({
      data: {
        numero: `RAS-${suffix}`,
        titulo: `Edital rascunho ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
        criadoPorId: admin.id,
      },
    });
    createdEditais.push(draft.id);

    const publicado = await prisma.edital.create({
      data: {
        numero: `PUB-${suffix}`,
        titulo: `Edital publicado ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
        publicadoEm: now,
        criadoPorId: admin.id,
      },
    });
    createdEditais.push(publicado.id);

    const emAndamento = await prisma.edital.create({
      data: {
        numero: `AND-${suffix}`,
        titulo: `Edital em andamento ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.EM_ANDAMENTO,
        publicadoEm: now,
        criadoPorId: admin.id,
      },
    });
    createdEditais.push(emAndamento.id);

    const publicList = await request(app).get(`/v1/editais?status=PUBLICADO,EM_ANDAMENTO&q=${suffix}&page=1&pageSize=1`);
    assert.equal(publicList.status, 200);
    assert.equal(publicList.body.total, 2);
    assert.equal(publicList.body.page, 1);
    assert.equal(publicList.body.pageSize, 1);
    assert.equal(publicList.body.items.length, 1);
    assert.equal(publicList.body.items[0].status === StatusEdital.PUBLICADO || publicList.body.items[0].status === StatusEdital.EM_ANDAMENTO, true);

    const draftFilter = await request(app).get(`/v1/editais?status=RASCUNHO&q=${suffix}&page=1&pageSize=10`);
    assert.equal(draftFilter.status, 403);
    assert.equal(draftFilter.body.code, "FORBIDDEN");

    const adminDraftList = await request(app)
      .get(`/v1/admin/editais?status=RASCUNHO&q=${suffix}&page=1&pageSize=10`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(adminDraftList.status, 200);
    assert.equal(adminDraftList.body.total, 1);
    assert.equal(adminDraftList.body.items.length, 1);
    assert.equal(adminDraftList.body.items[0].id, draft.id);
    assert.equal(adminDraftList.body.items[0].status, StatusEdital.RASCUNHO);
  } finally {
    if (createdEditais.length) {
      await prisma.edital.deleteMany({ where: { id: { in: createdEditais } } });
    }

    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});

test("backend bloqueia publicacao de edital sem estrutura minima e cronograma duplicado por tipo", async () => {
  const suffix = `edital-guard-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);

  let editalId = "";
  let linhaId = "";
  try {
    const created = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `RASC-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
      });

    assert.equal(created.status, 201);
    editalId = created.body.id;

    const publishWithoutStructure = await request(app)
      .put(`/v1/admin/editais/${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `RASC-${suffix}`,
        titulo: `Edital ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
      });

    assert.equal(publishWithoutStructure.status, 409);

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

    const cronograma1 = await request(app)
      .post(`/v1/admin/editais/${editalId}/cronogramas`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: TipoCronogramaEdital.INSCRICAO,
        titulo: "Inscricao",
        inicioEm: new Date(Date.now() + 60_000).toISOString(),
        fimEm: new Date(Date.now() + 120_000).toISOString(),
      });
    assert.equal(cronograma1.status, 201);

    const cronogramaDuplicado = await request(app)
      .post(`/v1/admin/editais/${editalId}/cronogramas`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: TipoCronogramaEdital.INSCRICAO,
        titulo: "Inscricao duplicada",
        inicioEm: new Date(Date.now() + 180_000).toISOString(),
        fimEm: new Date(Date.now() + 240_000).toISOString(),
      });
    assert.equal(cronogramaDuplicado.status, 409);
  } finally {
    if (editalId) await prisma.cronogramaEdital.deleteMany({ where: { editalId } });
    if (linhaId) await prisma.linhaPesquisa.deleteMany({ where: { id: linhaId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});

test("admin recebe codigo e mensagem especificos ao editar cronograma de edital operacionalizado", async () => {
  const suffix = `edital-cronograma-guard-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const candidato = await createCandidate(suffix);
  const adminToken = createToken(admin.id, admin.email);

  const edital = await prisma.edital.create({
    data: {
      numero: `OPER-${suffix}`,
      titulo: `Edital operacionalizado ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.DOUTORADO,
      status: StatusEdital.EM_ANDAMENTO,
      publicadoEm: new Date(),
      criadoPorId: admin.id,
    },
  });

  const cronograma = await prisma.cronogramaEdital.create({
    data: {
      editalId: edital.id,
      tipo: TipoCronogramaEdital.INSCRICAO,
      titulo: "Inscricao online doutorado",
      inicioEm: new Date("2026-04-16T23:13:00.000Z"),
      fimEm: new Date("2026-04-29T23:13:00.000Z"),
    },
  });

  const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId: edital.id } });

  try {
    const response = await request(app)
      .put(`/v1/admin/editais/${edital.id}/cronogramas/${cronograma.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: TipoCronogramaEdital.INSCRICAO,
        titulo: "Inscricao online doutorado",
        inicioEm: new Date("2026-04-16T23:13:00.000Z").toISOString(),
        fimEm: new Date("2026-04-29T23:13:00.000Z").toISOString(),
      });

    assert.equal(response.status, 409);
    assert.equal(response.body.code, "EDITAL_ESTRUTURA_BLOQUEADA");
    assert.equal(response.body.message, "Nao e permitido alterar estrutura de linhas, cronogramas, temas ou criterios em edital ja operacionalizado. Use retificacao/publicacao apropriada.");
  } finally {
    await prisma.participacaoEdital.deleteMany({ where: { id: participacao.id } });
    await prisma.cronogramaEdital.deleteMany({ where: { id: cronograma.id } });
    await prisma.edital.deleteMany({ where: { id: edital.id } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidato.id] } } });
  }
});

test("admin lista e aplica pacote padrao de temas de redacao com merge e replace", async () => {
  const suffix = `edital-pacote-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);
  const pacote = getTemaRedacaoPacoteBySlug("ppgee-v1");

  assert.ok(pacote);

  let editalId = "";
  let temaExtraId = "";

  try {
    const created = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `PAC-${suffix}`,
        titulo: `Edital pacote ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
      });

    assert.equal(created.status, 201);
    editalId = created.body.id;

    const pacotesResponse = await request(app)
      .get("/v1/admin/temas-redacao/pacotes")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(pacotesResponse.status, 200);
    assert.equal(pacotesResponse.body.total >= 1, true);
    assert.equal(pacotesResponse.body.items.some((item: { slug: string; totalTemas: number }) => item.slug === "ppgee-v1" && item.totalTemas === pacote!.temas.length), true);

    const firstApply = await request(app)
      .post(`/v1/admin/editais/${editalId}/temas-redacao/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-v1", modo: "MERGE" });

    assert.equal(firstApply.status, 200);
    assert.equal(firstApply.body.criados.length, pacote.temas.length);
    assert.equal(firstApply.body.reativados.length, 0);
    assert.equal(firstApply.body.totalAtivosDepois, pacote.temas.length);

    const temasAtivosAposPrimeiraAplicacao = await prisma.temaRedacaoEdital.count({ where: { editalId, ativo: true } });
    assert.equal(temasAtivosAposPrimeiraAplicacao, pacote.temas.length);

    const primeiroTema = await prisma.temaRedacaoEdital.findFirstOrThrow({ where: { editalId }, orderBy: { ordem: "asc" } });
    const segundoTema = await prisma.temaRedacaoEdital.findFirstOrThrow({ where: { editalId, id: { not: primeiroTema.id } }, orderBy: { ordem: "asc" } });
    await prisma.temaRedacaoEdital.update({ where: { id: primeiroTema.id }, data: { ativo: false } });
    await prisma.temaRedacaoEdital.update({ where: { id: segundoTema.id }, data: { descricao: "Descricao stale", ordem: 999 } });

    const temaExtra = await prisma.temaRedacaoEdital.create({
      data: {
        editalId,
        titulo: `Tema extra ${suffix}`,
        descricao: "Tema fora do pacote padrao.",
        ordem: 999,
        ativo: true,
      },
    });
    temaExtraId = temaExtra.id;

    const replaceApply = await request(app)
      .post(`/v1/admin/editais/${editalId}/temas-redacao/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-v1", modo: "REPLACE_INACTIVE" });

    assert.equal(replaceApply.status, 200);
    assert.equal(replaceApply.body.reativados.includes(primeiroTema.titulo), true);
    assert.equal(replaceApply.body.atualizados.includes(segundoTema.titulo), true);
    assert.equal(replaceApply.body.inativados.includes(temaExtra.titulo), true);
    assert.equal(replaceApply.body.totalAtivosDepois, pacote.temas.length);

    const temaExtraAtualizado = await prisma.temaRedacaoEdital.findUniqueOrThrow({ where: { id: temaExtraId } });
    const segundoTemaAtualizado = await prisma.temaRedacaoEdital.findUniqueOrThrow({ where: { id: segundoTema.id } });
    assert.equal(temaExtraAtualizado.ativo, false);
    assert.notEqual(segundoTemaAtualizado.ordem, 999);
  } finally {
    if (editalId) await prisma.temaRedacaoEdital.deleteMany({ where: { editalId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});

test("admin lista e aplica criterios reais do Anexo II por edital", async () => {
  const suffix = `edital-criterios-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);
  const pacote = getCriterioTitulacaoPacoteBySlug("ppgee-092-2025-anexo-ii");

  assert.ok(pacote);

  let editalId = "";

  try {
    const created = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `TIT-${suffix}`,
        titulo: `Edital criterios ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
      });

    assert.equal(created.status, 201);
    editalId = created.body.id;

    const pacotesResponse = await request(app)
      .get("/v1/admin/criterios-titulacao/pacotes")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(pacotesResponse.status, 200);
    assert.equal(pacotesResponse.body.items.some((item: { slug: string; totalCriterios: number }) => item.slug === "ppgee-092-2025-anexo-ii" && item.totalCriterios === pacote.criterios.length), true);

    const firstApply = await request(app)
      .post(`/v1/admin/editais/${editalId}/criterios-titulacao/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-092-2025-anexo-ii", modo: "MERGE" });

    assert.equal(firstApply.status, 200);
    assert.equal(firstApply.body.criados.length, pacote.criterios.length);
    assert.equal(firstApply.body.totalAtivosDepois, pacote.criterios.length);

    const criteriosResponse = await request(app)
      .get(`/v1/admin/editais/${editalId}/criterios-titulacao`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(criteriosResponse.status, 200);
    assert.equal(criteriosResponse.body.total, pacote.criterios.length);

    const criterios = criteriosResponse.body.items as Array<{
      id: string;
      chaveInterna: string;
      numeroNormativo: string;
      fator: number | null;
      teto: number | null;
      regraEspecial: string | null;
    }>;
    const criterio16 = criterios.find((criterio) => criterio.numeroNormativo === "16");
    const criterio17 = criterios.find((criterio) => criterio.numeroNormativo === "17");
    assert.equal(criterio16?.chaveInterna, "empresa_junior");
    assert.equal(criterio17?.chaveInterna, "pet");

    const criterioJcr = criterios.find((criterio) => criterio.chaveInterna === "artigo_periodico_jcr");
    assert.ok(criterioJcr);
    assert.equal(criterioJcr.fator, null);
    assert.equal(criterioJcr.regraEspecial, "PONTUACAO_JCR");

    const criterioExtensao = criterios.find((criterio) => criterio.chaveInterna === "projeto_extensao_graduacao");
    assert.ok(criterioExtensao);
    assert.equal(criterioExtensao.fator, 0.2);
    assert.equal(criterioExtensao.teto, 1);

    const primeiroCriterio = await prisma.criterioTitulacaoEdital.findFirstOrThrow({ where: { editalId }, orderBy: { ordem: "asc" } });
    const segundoCriterio = await prisma.criterioTitulacaoEdital.findFirstOrThrow({ where: { editalId, id: { not: primeiroCriterio.id } }, orderBy: { ordem: "asc" } });
    await prisma.criterioTitulacaoEdital.update({ where: { id: primeiroCriterio.id }, data: { ativo: false } });
    await prisma.criterioTitulacaoEdital.update({ where: { id: segundoCriterio.id }, data: { descricao: "Descricao stale", ordem: 999 } });
    const extra = await prisma.criterioTitulacaoEdital.create({
      data: {
        editalId,
        chaveInterna: `extra_${suffix}`,
        numeroNormativo: "99",
        descricao: "Criterio extra fora do pacote.",
        fator: 0.1,
        unidade: "item",
        ordem: 999,
      },
    });

    const replaceApply = await request(app)
      .post(`/v1/admin/editais/${editalId}/criterios-titulacao/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-092-2025-anexo-ii", modo: "REPLACE_INACTIVE" });

    assert.equal(replaceApply.status, 200);
    assert.equal(replaceApply.body.reativados.includes(primeiroCriterio.chaveInterna), true);
    assert.equal(replaceApply.body.atualizados.includes(segundoCriterio.chaveInterna), true);
    assert.equal(replaceApply.body.inativados.includes(extra.chaveInterna), true);
    assert.equal(replaceApply.body.totalAtivosDepois, pacote.criterios.length);
  } finally {
    if (editalId) await prisma.criterioTitulacaoEdital.deleteMany({ where: { editalId } });
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});

test("backend bloqueia mutacao estrutural de temas e criterios em edital operacionalizado", async () => {
  const suffix = `edital-tema-guard-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const candidato = await createCandidate(suffix);
  const adminToken = createToken(admin.id, admin.email);

  const edital = await prisma.edital.create({
    data: {
      numero: `TOP-${suffix}`,
      titulo: `Edital temas operacionalizado ${suffix}`,
      ano: 2026,
      semestre: 1,
      cursoNivel: CursoNivel.MESTRADO,
      status: StatusEdital.EM_ANDAMENTO,
      publicadoEm: new Date(),
      criadoPorId: admin.id,
    },
  });

  const participacao = await prisma.participacaoEdital.create({ data: { usuarioId: candidato.id, editalId: edital.id } });

  try {
    const createTema = await request(app)
      .post(`/v1/admin/editais/${edital.id}/temas-redacao`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ titulo: "Tema bloqueado operacionalmente", descricao: "Descricao suficiente para validar o tema.", ordem: 0, ativo: true });

    assert.equal(createTema.status, 409);
    assert.equal(createTema.body.code, "EDITAL_ESTRUTURA_BLOQUEADA");

    const applyPacote = await request(app)
      .post(`/v1/admin/editais/${edital.id}/temas-redacao/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-v1", modo: "MERGE" });

    assert.equal(applyPacote.status, 409);
    assert.equal(applyPacote.body.code, "EDITAL_ESTRUTURA_BLOQUEADA");

    const applyCriterios = await request(app)
      .post(`/v1/admin/editais/${edital.id}/criterios-titulacao/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-092-2025-anexo-ii", modo: "MERGE" });

    assert.equal(applyCriterios.status, 409);
    assert.equal(applyCriterios.body.code, "EDITAL_ESTRUTURA_BLOQUEADA");
  } finally {
    await prisma.participacaoEdital.deleteMany({ where: { id: participacao.id } });
    await prisma.temaRedacaoEdital.deleteMany({ where: { editalId: edital.id } });
    await prisma.edital.deleteMany({ where: { id: edital.id } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, candidato.id] } } });
  }
});

test("criacao de edital com pacote inicial e temas extras e transacional", async () => {
  const suffix = `edital-create-pacote-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);
  const pacote = getTemaRedacaoPacoteBySlug("ppgee-v1");

  assert.ok(pacote);

  try {
    const created = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `CRT-${suffix}`,
        titulo: `Edital com pacote ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
        temaPacoteInicialSlug: "ppgee-v1",
        temasRedacaoIniciais: [
          {
            titulo: `Tema extra ${suffix}`,
            descricao: "Tema complementar do edital.",
            ordem: 1000,
            ativo: true,
          },
        ],
      });

    assert.equal(created.status, 201);

    const temasCount = await prisma.temaRedacaoEdital.count({ where: { editalId: created.body.id } });
    assert.equal(temasCount, pacote!.temas.length + 1);

    const duplicado = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `CRT-DUP-${suffix}`,
        titulo: `Edital com pacote duplicado ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
        temaPacoteInicialSlug: "ppgee-v1",
        temasRedacaoIniciais: [
          {
            titulo: pacote!.temas[0].titulo,
            descricao: "Duplicado do pacote.",
            ordem: 1001,
            ativo: true,
          },
        ],
      });

    assert.equal(duplicado.status, 409);

    const editalDuplicadoPersistido = await prisma.edital.findFirst({ where: { numero: `CRT-DUP-${suffix}` } });
    assert.equal(editalDuplicadoPersistido, null);

    await prisma.temaRedacaoEdital.deleteMany({ where: { editalId: created.body.id } });
    await prisma.edital.deleteMany({ where: { id: created.body.id } });
  } finally {
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});

test("backend exige configuracao de processo completa antes de publicar edital", async () => {
  const suffix = `edital-config-guard-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);

  let editalId = "";

  try {
    const created = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `CFG-${suffix}`,
        titulo: `Edital configuracao ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.RASCUNHO,
      });

    assert.equal(created.status, 201);
    editalId = created.body.id;

    const detailBeforeConfig = await request(app)
      .get(`/v1/admin/editais/${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(detailBeforeConfig.status, 200);
    assert.equal(detailBeforeConfig.body.configuracaoProcesso.configurada, false);
    assert.equal(detailBeforeConfig.body.configuracaoProcesso.modalidadeEtapa1, "REDACAO");
    assert.equal(detailBeforeConfig.body.configuracaoProcesso.pesoEtapa2, 2);
    assert.equal(detailBeforeConfig.body.criteriosEtapa1.length, 0);

    await prisma.linhaPesquisa.create({
      data: {
        editalId,
        nome: `Linha ${suffix}`,
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 0,
        vagasPcd: 0,
      },
    });

    const cronograma = await request(app)
      .post(`/v1/admin/editais/${editalId}/cronogramas`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        tipo: TipoCronogramaEdital.INSCRICAO,
        titulo: "Inscricao",
        inicioEm: new Date(Date.now() + 60_000).toISOString(),
        fimEm: new Date(Date.now() + 120_000).toISOString(),
      });
    assert.equal(cronograma.status, 201);

    const publishWithoutConfig = await request(app)
      .put(`/v1/admin/editais/${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `CFG-${suffix}`,
        titulo: `Edital configuracao ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
      });

    assert.equal(publishWithoutConfig.status, 409);
    assert.equal(publishWithoutConfig.body.code, "EDITAL_SEM_CONFIGURACAO_PROCESSO");

    const applyPerfil = await request(app)
      .post(`/v1/admin/editais/${editalId}/perfil-processo/pacote`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ slug: "ppgee-092-2025-mestrado" });

    assert.equal(applyPerfil.status, 200);
    assert.equal(applyPerfil.body.modalidadeEtapa1, "REDACAO");
    assert.equal(applyPerfil.body.criterios.length, 5);

    const publishWithConfig = await request(app)
      .put(`/v1/admin/editais/${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `CFG-${suffix}`,
        titulo: `Edital configuracao ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.MESTRADO,
        status: StatusEdital.PUBLICADO,
      });

    assert.equal(publishWithConfig.status, 200);
    assert.equal(publishWithConfig.body.status, StatusEdital.PUBLICADO);
  } finally {
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});
test("bloqueia cronograma de espelho iniciando antes do fim da etapa 1", async () => {
  const suffix = `edital-espelho-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const admin = await createAdmin(suffix);
  const adminToken = createToken(admin.id, admin.email);

  let editalId = "";

  try {
    const created = await request(app)
      .post("/v1/admin/editais")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `ESP-${suffix}`,
        titulo: `Edital espelho ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.DOUTORADO,
        status: StatusEdital.RASCUNHO,
      });

    assert.equal(created.status, 201);
    editalId = created.body.id;

    await prisma.linhaPesquisa.create({
      data: {
        editalId,
        nome: `Linha ${suffix}`,
        vagasAmplaConcorrencia: 1,
        vagasAcoesAfirmativas: 0,
        vagasPcd: 0,
      },
    });

    const cronogramas = [
      { tipo: TipoCronogramaEdital.INSCRICAO, inicioEm: "2027-01-10T08:00:00.000Z", fimEm: "2027-01-10T09:00:00.000Z" },
      { tipo: TipoCronogramaEdital.ETAPA_1, inicioEm: "2027-01-10T10:00:00.000Z", fimEm: "2027-01-10T11:00:00.000Z" },
      { tipo: TipoCronogramaEdital.ESPELHO_ETAPA_1, inicioEm: "2027-01-10T10:30:00.000Z", fimEm: "2027-01-10T12:00:00.000Z" },
    ];

    for (const cronograma of cronogramas) {
      const response = await request(app)
        .post(`/v1/admin/editais/${editalId}/cronogramas`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ...cronograma, titulo: `Fase ${cronograma.tipo}` });

      assert.equal(response.status, 201);
    }

    const publish = await request(app)
      .put(`/v1/admin/editais/${editalId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        numero: `ESP-${suffix}`,
        titulo: `Edital espelho ${suffix}`,
        ano: 2026,
        semestre: 1,
        cursoNivel: CursoNivel.DOUTORADO,
        status: StatusEdital.PUBLICADO,
      });

    assert.equal(publish.status, 409);
    assert.equal(publish.body.code, "EDITAL_CRONOGRAMA_SEQUENCIA_INVALIDA");
  } finally {
    if (editalId) await prisma.edital.deleteMany({ where: { id: editalId } });
    await prisma.usuarioPerfil.deleteMany({ where: { usuarioId: admin.id } });
    await prisma.usuario.deleteMany({ where: { id: admin.id } });
  }
});