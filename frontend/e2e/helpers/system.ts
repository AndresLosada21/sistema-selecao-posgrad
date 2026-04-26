import { expect, type APIRequestContext, type Page } from "@playwright/test";

import { buildUniqueCandidate } from "./candidate";

const backendBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const tokenStorageKey = "selecao-posgrad-token";

export const documentoTiposObrigatorios = [
  "ANEXO_IV",
  "ANEXO_V",
  "DOCUMENTO_IDENTIFICACAO",
  "DIPLOMA",
  "HISTORICO",
  "CURRICULO",
  "COMPROVANTE_PAGAMENTO",
] as const;

export function isoDateWithOffset(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function createPdfBuffer(text: string) {
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 12 Tf 20 100 Td (${text}) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000122 00000 n \n0000000248 00000 n \n0000000356 00000 n \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n426\n%%EOF`, "utf-8");
}

export function createPngBuffer() {
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0fcAAAAASUVORK5CYII=", "base64");
}

async function postJson(request: APIRequestContext, path: string, data: unknown, token?: string) {
  return request.post(`${backendBaseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    data,
  });
}

async function putJson(request: APIRequestContext, path: string, data: unknown, token: string) {
  return request.put(`${backendBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

async function uploadPdfApi(request: APIRequestContext, token: string, name: string, text: string) {
  const response = await request.post(`${backendBaseUrl}/v1/uploads`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: {
        name,
        mimeType: "application/pdf",
        buffer: createPdfBuffer(text),
      },
    },
  });

  expect(response.ok()).toBeTruthy();
  return await response.json() as { urlArquivo: string; nomeArquivo: string; mimeType: string; tamanhoBytes: number };
}

function expandCronogramaWindows(windows: Array<{ tipo: string; titulo: string; descricao?: string }>) {
  const existingTipos = new Set(windows.map((window) => window.tipo));
  const expanded = [...windows];

  const dependencies: Array<{ tipo: string; dependsOn: string; titulo: string }> = [
    { tipo: "RECURSO_HOMOLOGACAO", dependsOn: "HOMOLOGACAO_PRELIMINAR", titulo: "Homologacao preliminar" },
    { tipo: "RECURSO_ETAPA_1", dependsOn: "ETAPA_1", titulo: "Etapa 1" },
    { tipo: "RECURSO_ETAPA_2", dependsOn: "ETAPA_2", titulo: "Etapa 2" },
    { tipo: "RECURSO_CLASSIFICACAO", dependsOn: "CLASSIFICACAO_PRELIMINAR", titulo: "Classificacao preliminar" },
  ];

  for (const dependency of dependencies) {
    if (existingTipos.has(dependency.tipo) && !existingTipos.has(dependency.dependsOn)) {
      expanded.push({ tipo: dependency.dependsOn, titulo: dependency.titulo });
      existingTipos.add(dependency.dependsOn);
    }
  }

  return expanded;
}

export async function loginAsAdmin(request: APIRequestContext) {
  const response = await postJson(request, "/v1/auth/login", {
    email: "admin@ppgee.ufam.edu.br",
    senha: "Admin1234",
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.token as string;
}

export async function loginAsAdminViaUi(page: Page, request: APIRequestContext) {
  const token = await loginAsAdmin(request);
  await page.goto("/");
  await page.evaluate(([storageKey, value]) => {
    window.localStorage.setItem(storageKey, value);
  }, [tokenStorageKey, token]);
  await waitForAuthenticatedSession(page);
  await expect.poll(async () => {
    await page.goto("/admin");
    return page.url();
  }, { timeout: 20_000 }).toMatch(/\/admin(\/|$)/);
}

export async function waitForAuthenticatedSession(page: Page) {
  await expect.poll(async () => {
    return page.evaluate((storageKey) => window.localStorage.getItem(storageKey), tokenStorageKey);
  }, { timeout: 20_000 }).not.toBeNull();
}

export async function createOperationalEdital(request: APIRequestContext, options?: {
  suffix?: string;
  cursoNivel?: "MESTRADO" | "DOUTORADO";
  windows?: Array<{ tipo: string; titulo: string; descricao?: string }>;
}) {
  const adminToken = await loginAsAdmin(request);
  const suffix = options?.suffix ?? `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const cursoNivel = options?.cursoNivel ?? "MESTRADO";

  const editalResponse = await postJson(request, "/v1/admin/editais", {
    numero: `UI-${suffix}`,
    titulo: `Edital UI ${suffix}`,
      descricao: "Edital tecnico para fluxos E2E reais.",
      ano: 2026,
      semestre: 1,
      cursoNivel,
      status: "RASCUNHO",
    }, adminToken);

  expect(editalResponse.ok()).toBeTruthy();
  const edital = await editalResponse.json();

  const temaResponse = await postJson(request, `/v1/admin/editais/${edital.id}/temas-redacao`, {
    titulo: "Controle e automacao aplicada a sistemas energeticos",
    descricao: "Tema tecnico padrao para fluxos E2E.",
    ordem: 0,
    ativo: true,
  }, adminToken);
  expect(temaResponse.ok()).toBeTruthy();

  const linhaResponse = await postJson(request, `/v1/admin/editais/${edital.id}/linhas`, {
    nome: `Linha UI ${suffix}`,
    descricao: "Linha de pesquisa tecnica para E2E.",
    vagasAmplaConcorrencia: 2,
    vagasAcoesAfirmativas: 1,
    vagasPcd: 0,
  }, adminToken);
  expect(linhaResponse.ok()).toBeTruthy();
  const linha = await linhaResponse.json();

  for (const cronograma of expandCronogramaWindows(options?.windows ?? [])) {
    const isBaseForResource = ["HOMOLOGACAO_PRELIMINAR", "ETAPA_1", "ETAPA_2", "CLASSIFICACAO_PRELIMINAR"].includes(cronograma.tipo);
    const cronogramaResponse = await postJson(request, `/v1/admin/editais/${edital.id}/cronogramas`, {
      ...cronograma,
      descricao: cronograma.descricao ?? `Janela tecnica para ${cronograma.titulo}`,
      inicioEm: isoDateWithOffset(isBaseForResource ? -4 : -1),
      fimEm: isoDateWithOffset(isBaseForResource ? -3 : 1),
    }, adminToken);
    expect(cronogramaResponse.ok()).toBeTruthy();
  }

  const publishResponse = await putJson(request, `/v1/admin/editais/${edital.id}`, {
    numero: edital.numero,
    titulo: edital.titulo,
    descricao: edital.descricao,
    ano: edital.ano,
    semestre: edital.semestre,
    cursoNivel,
    status: "PUBLICADO",
    publicadoEm: new Date().toISOString(),
  }, adminToken);

  expect(publishResponse.ok()).toBeTruthy();

  return {
    adminToken,
    editalId: edital.id as string,
    linhaId: linha.id as string,
    cursoNivel,
    suffix,
  };
}

export async function registerCandidateApi(request: APIRequestContext) {
  const candidate = buildUniqueCandidate();
  const response = await postJson(request, "/v1/auth/register", candidate);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return {
    ...candidate,
    token: body.token as string,
    userId: body.user.id as string,
  };
}

export async function participateInEdital(request: APIRequestContext, editalId: string, token: string) {
  const response = await postJson(request, `/v1/editais/${editalId}/participar`, undefined, token);
  expect(response.ok()).toBeTruthy();
}

export async function createIsencaoApi(request: APIRequestContext, input: { editalId: string; cursoNivel: "MESTRADO" | "DOUTORADO"; token: string }) {
  const upload = await uploadPdfApi(request, input.token, "isencao.pdf", "Comprovante de isencao");
  const response = await postJson(request, `/v1/editais/${input.editalId}/isencao`, {
    cursoNivel: input.cursoNivel,
    inscritoCadUnico: false,
    justificativa: "Solicito isencao por indisponibilidade financeira devidamente comprovada.",
    comprovanteUrl: upload.urlArquivo,
    comprovanteNomeArquivo: upload.nomeArquivo,
  }, input.token);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.id as string;
}

export async function createSubmittedInscricaoApi(request: APIRequestContext, input: {
  editalId: string;
  linhaId: string;
  token: string;
  candidateEmail: string;
  candidateCpf: string;
}) {
  const draftResponse = await putJson(request, `/v1/editais/${input.editalId}/inscricao/rascunho`, {
    linhaPesquisaId: input.linhaId,
    modalidadeConcorrencia: "AMPLA_CONCORRENCIA",
    temaRedacao: "Controle e automacao aplicada a sistemas energeticos",
    resumoCurriculo: "Experiencia em pesquisa e desenvolvimento na area.",
    redacaoTexto: "A".repeat(600),
    fichaInscricao: {
      nomeCompleto: "Candidato API Fluxo",
      rg: "1234567",
      rgDataExpedicao: "2020-01-01",
      cpf: input.candidateCpf,
      nacionalidade: "Brasileira",
      naturalidade: "Manaus",
      email: input.candidateEmail,
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
  }, input.token);

  expect(draftResponse.ok()).toBeTruthy();
  const draft = await draftResponse.json();
  const inscricaoId = draft.id as string;

  for (const tipo of documentoTiposObrigatorios) {
    const upload = await uploadPdfApi(request, input.token, `${tipo.toLowerCase()}.pdf`, `Documento ${tipo}`);
    const documentoResponse = await postJson(request, `/v1/inscricoes/${inscricaoId}/documentos`, {
      tipo,
      nome: `Documento ${tipo}`,
      urlArquivo: upload.urlArquivo,
      nomeArquivo: upload.nomeArquivo,
      mimeType: upload.mimeType,
      tamanhoBytes: upload.tamanhoBytes,
    }, input.token);
    expect(documentoResponse.ok()).toBeTruthy();
  }

  const submitResponse = await postJson(request, `/v1/inscricoes/${inscricaoId}/submeter`, undefined, input.token);
  expect(submitResponse.ok()).toBeTruthy();

  return inscricaoId;
}

export async function setupCandidateSubmissionFixture(request: APIRequestContext, windows: Array<{ tipo: string; titulo: string; descricao?: string }>, options?: { withIsencao?: boolean }) {
  const edital = await createOperationalEdital(request, { windows });
  const candidate = await registerCandidateApi(request);
  await participateInEdital(request, edital.editalId, candidate.token);

  let pedidoIsencaoId: string | null = null;
  if (options?.withIsencao) {
    pedidoIsencaoId = await createIsencaoApi(request, {
      editalId: edital.editalId,
      cursoNivel: edital.cursoNivel,
      token: candidate.token,
    });
  }

  const inscricaoId = await createSubmittedInscricaoApi(request, {
    editalId: edital.editalId,
    linhaId: edital.linhaId,
    token: candidate.token,
    candidateEmail: candidate.email,
    candidateCpf: candidate.cpf,
  });

  return {
    ...edital,
    ...candidate,
    pedidoIsencaoId,
    inscricaoId,
  };
}

export async function homologarPreliminarApi(request: APIRequestContext, adminToken: string, inscricaoId: string, parecer = "Documentacao preliminar analisada com sucesso.") {
  const response = await putJson(request, `/v1/admin/inscricoes/${inscricaoId}/homologacao/preliminar`, {
    homologada: true,
    parecer,
    motivos: [],
  }, adminToken);
  expect(response.ok()).toBeTruthy();
}

export async function homologarFinalApi(request: APIRequestContext, adminToken: string, inscricaoId: string, parecer = "Documentacao final homologada para seguir no processo.") {
  const response = await putJson(request, `/v1/admin/inscricoes/${inscricaoId}/homologacao/final`, {
    homologada: true,
    parecer,
    motivos: [],
  }, adminToken);
  expect(response.ok()).toBeTruthy();
}

export async function registrarEtapa1Api(request: APIRequestContext, adminToken: string, inscricaoId: string, input?: { publicacao?: "PRELIMINAR" | "FINAL"; liberarEspelho?: boolean }) {
  const response = await request.put(`${backendBaseUrl}/v1/admin/etapa-1/inscricoes/${inscricaoId}/resultado`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      tema: "Controle e automacao aplicada a sistemas energeticos",
      rubrica: {
        adequacaoDominioTema: 8,
        estrutura: 8,
        organizacaoCoerencia: 8,
        objetividadeSintese: 8,
        grafiaGramatica: 8,
        observacoes: {
          geral: "Texto avaliado na etapa 1.",
        },
      },
      usoIaComprovado: false,
      espelhoCorrecao: "Espelho estruturado da etapa 1.",
      liberarEspelho: input?.liberarEspelho ?? false,
      publicacao: input?.publicacao ?? "PRELIMINAR",
    },
  });
  expect(response.ok()).toBeTruthy();
}

export async function liberarEspelhoEtapa1Api(request: APIRequestContext, adminToken: string, inscricaoId: string) {
  const response = await postJson(request, `/v1/admin/inscricoes/${inscricaoId}/etapa-1/espelho/liberar`, undefined, adminToken);
  expect(response.ok()).toBeTruthy();
}

export async function registrarEtapa2Api(request: APIRequestContext, adminToken: string, inscricaoId: string, input?: { liberarEspelho?: boolean }) {
  const response = await request.put(`${backendBaseUrl}/v1/admin/etapa-2/inscricoes/${inscricaoId}/resultado`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      pontuacaoItens: { producao: 10, orientacao: 5 },
      pontuacaoBruta: 15,
      maiorPontuacaoBruta: 20,
      glosas: [{ item: "orientacao", descricao: "Glosa tecnica de exemplo.", pontosGlosados: 1 }],
      espelhoCorrecao: "Espelho estruturado da etapa 2.",
      liberarEspelho: input?.liberarEspelho ?? false,
      publicacao: "PRELIMINAR",
    },
  });
  expect(response.ok()).toBeTruthy();
}

export async function liberarEspelhoEtapa2Api(request: APIRequestContext, adminToken: string, inscricaoId: string) {
  const response = await postJson(request, `/v1/admin/inscricoes/${inscricaoId}/etapa-2/espelho/liberar`, undefined, adminToken);
  expect(response.ok()).toBeTruthy();
}
