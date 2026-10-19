import { expect, test, type APIRequestContext } from "@playwright/test";

import {
  createPdfBuffer,
  fillCandidatePersonalStep,
  saveDraftAndGoToAcademicStep,
  uploadSingleFile,
  wizardField,
} from "./helpers/candidate-form";
import { loginCandidateViaUi, participateInEdital, registerCandidateApi } from "./helpers/system";

const backendBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

const documentoTiposObrigatorios = [
  "ANEXO_IV",
  "DOCUMENTO_IDENTIFICACAO",
  "DIPLOMA",
  "HISTORICO",
  "CURRICULO",
  "COMPROVANTE_PAGAMENTO",
] as const;

function isoDateWithOffset(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function loginAsAdmin(request: APIRequestContext) {
  const response = await request.post(`${backendBaseUrl}/v1/auth/login`, {
    data: {
      email: "admin@ppgee.ufam.edu.br",
      senha: "Admin1234",
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return body.token as string;
}

async function csrfHeader(request: APIRequestContext): Promise<Record<string, string>> {
  const state = await request.storageState();
  const csrfCookie = state.cookies.find((cookie) => cookie.name === "XSRF-TOKEN");
  return csrfCookie ? { "X-CSRF-Token": csrfCookie.value } : {};
}

async function createCandidateFlowEdital(request: APIRequestContext) {
  const adminToken = await loginAsAdmin(request);
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const editalResponse = await request.post(`${backendBaseUrl}/v1/admin/editais`, {
    headers: { Authorization: `Bearer ${adminToken}`, ...(await csrfHeader(request)) },
    data: {
      numero: `094/${suffix}`,
      titulo: `Fluxo real candidato ${suffix}`,
      descricao: "Edital tecnico para validar o fluxo E2E real do candidato pela UI.",
      ano: 2026,
      semestre: 1,
      cursoNivel: "MESTRADO",
      status: "RASCUNHO",
      temaPacoteInicialSlug: "ppgee-v1",
    },
  });

  expect(editalResponse.ok()).toBeTruthy();
  const edital = await editalResponse.json();

  const linhaResponse = await request.post(`${backendBaseUrl}/v1/admin/editais/${edital.id}/linhas`, {
    headers: { Authorization: `Bearer ${adminToken}`, ...(await csrfHeader(request)) },
    data: {
      nome: `Linha fluxo ${suffix}`,
      descricao: "Linha de pesquisa usada no E2E real do candidato.",
      vagasAmplaConcorrencia: 2,
      vagasAcoesAfirmativas: 1,
      vagasPcd: 0,
    },
  });

  expect(linhaResponse.ok()).toBeTruthy();

  const criteriosResponse = await request.post(`${backendBaseUrl}/v1/admin/editais/${edital.id}/criterios-titulacao/pacote`, {
    headers: { Authorization: `Bearer ${adminToken}`, ...(await csrfHeader(request)) },
    data: { slug: "ppgee-092-2025-anexo-ii", modo: "MERGE" },
  });

  expect(criteriosResponse.ok()).toBeTruthy();

  const perfilResponse = await request.post(`${backendBaseUrl}/v1/admin/editais/${edital.id}/perfil-processo/pacote`, {
    headers: { Authorization: `Bearer ${adminToken}`, ...(await csrfHeader(request)) },
    data: { slug: "ppgee-092-2025-mestrado" },
  });

  expect(perfilResponse.ok()).toBeTruthy();

  for (const cronograma of [
    { tipo: "PEDIDO_ISENCAO", titulo: "Solicitacao de isencao E2E" },
    { tipo: "INSCRICAO", titulo: "Inscricao E2E" },
  ]) {
    const cronogramaResponse = await request.post(`${backendBaseUrl}/v1/admin/editais/${edital.id}/cronogramas`, {
      headers: { Authorization: `Bearer ${adminToken}`, ...(await csrfHeader(request)) },
      data: {
        ...cronograma,
        descricao: `Janela real para ${cronograma.titulo}`,
        inicioEm: isoDateWithOffset(-1),
        fimEm: isoDateWithOffset(1),
      },
    });

    expect(cronogramaResponse.ok()).toBeTruthy();
  }

  const publishResponse = await request.put(`${backendBaseUrl}/v1/admin/editais/${edital.id}`, {
    headers: { Authorization: `Bearer ${adminToken}`, ...(await csrfHeader(request)) },
    data: {
      numero: edital.numero,
      titulo: edital.titulo,
      descricao: edital.descricao,
      ano: edital.ano,
      semestre: edital.semestre,
      cursoNivel: "MESTRADO",
      status: "PUBLICADO",
      publicadoEm: new Date().toISOString(),
    },
  });

  expect(publishResponse.ok()).toBeTruthy();

  return { editalId: edital.id };
}

test("candidato percorre isencao, inscricao e submissao pela UI real", async ({ page, request }) => {
  test.setTimeout(300_000);

  const { editalId } = await createCandidateFlowEdital(request);
  const candidate = await registerCandidateApi(request);
  await participateInEdital(request, editalId, candidate.token);
  await loginCandidateViaUi(page, candidate.email, candidate.senha);

  await page.goto(`/candidato/editais/${editalId}/isencao/nova`);
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}/isencao/nova$`), { timeout: 20_000 });
  await page.getByLabel("Justificativa").fill("Solicito isencao por indisponibilidade financeira devidamente comprovada.");
  await uploadSingleFile(page, 0, {
    name: "comprovante-isencao.pdf",
    mimeType: "application/pdf",
    buffer: createPdfBuffer("Comprovante de isencao"),
  });
  await expect(page.getByRole("button", { name: "Solicitar isenção" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "Solicitar isenção" }).click();
  await expect(page.getByText("Pedido de isenção enviado. Você será redirecionado para acompanhar o status.")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}$`), { timeout: 20_000 });
  await expect(page.getByText("Solicitada").first()).toBeVisible();

  await page.goto(`/candidato/editais/${editalId}/inscricao`);
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}/inscricao$`), { timeout: 20_000 });

  await fillCandidatePersonalStep(page);
  await saveDraftAndGoToAcademicStep(page);
  await page.getByPlaceholder("Descreva brevemente sua formação, experiências e principais publicações...").fill("Experiência em pesquisa, extensão e desenvolvimento de sistemas embarcados.");

  await page.getByRole("button", { name: "Próximo: Redação" }).click();
  await expect(page.getByRole("heading", { name: "Redação — Proposta de Pesquisa" })).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder("Buscar por controle, energia, blockchain, visão...").fill("controle");
  const temaSelect = page.locator("div", { hasText: "Tema da Redação" }).locator("select").first();
  const temaOptionValue = await temaSelect.locator("option").evaluateAll((options) => {
    const matchingOption = options.find((option, index) => index > 0 && option.getAttribute("value"));
    return matchingOption?.getAttribute("value") ?? null;
  });
  if (!temaOptionValue) {
    throw new Error("Nenhum tema ativo foi encontrado no select de redacao.");
  }
  await temaSelect.selectOption(temaOptionValue);
  await page.locator("textarea").first().fill("A".repeat(600));

  await page.getByRole("button", { name: "Próximo: Documentos" }).click();
  await expect(page.getByRole("heading", { name: "Documentos da Inscrição" })).toBeVisible({ timeout: 20_000 });

  await Promise.all([
    page.waitForEvent("download", { timeout: 20_000 }),
    page.getByRole("button", { name: "Baixar Anexo IV preenchido" }).click(),
  ]);
  await page.locator(".file-field", { hasText: "Enviar Anexo IV assinado (PDF)" }).locator('input[type="file"]').setInputFiles({
    name: "anexo-iv-assinado.pdf",
    mimeType: "application/pdf",
    buffer: createPdfBuffer("Anexo IV assinado"),
  });
  await expect(page.getByText("Anexo IV assinado reenviado", { exact: true })).toBeVisible({ timeout: 20_000 });

  for (const tipo of documentoTiposObrigatorios) {
    if (tipo === "ANEXO_IV") {
      continue;
    }
    const addDocumentForm = page.locator("form", { hasText: "Registrar documento" });
    await addDocumentForm.locator("select").first().selectOption(tipo);
    await addDocumentForm.locator("input").first().fill(`Documento ${tipo}`);
    await addDocumentForm.locator('.file-field input[type="file"]').setInputFiles({
      name: `${tipo.toLowerCase()}.pdf`,
      mimeType: "application/pdf",
      buffer: createPdfBuffer(`Documento ${tipo}`),
    });
    await expect(page.getByText(`${tipo.toLowerCase()}.pdf`)).toBeVisible({ timeout: 20_000 });
    await expect(addDocumentForm.getByRole("button", { name: "Registrar documento" })).toBeEnabled({ timeout: 20_000 });
    await addDocumentForm.getByRole("button", { name: "Registrar documento" }).click();
    await expect(page.getByText("Documento enviado", { exact: true })).toBeVisible({ timeout: 20_000 });
  }

  await page.getByRole("button", { name: "Próximo: Títulos" }).click();
  await expect(page.getByRole("heading", { name: "Títulos / Anexo II" })).toBeVisible({ timeout: 20_000 });
  await wizardField(page, "Descrição dos Títulos").locator("textarea").fill("Projeto de pesquisa aprovado institucionalmente e concluído durante a graduação.");
  await page.locator(".file-field", { hasText: "Comprovante do título (PDF)" }).locator('input[type="file"]').setInputFiles({
    name: "titulo-projeto-pesquisa.pdf",
    mimeType: "application/pdf",
    buffer: createPdfBuffer("Titulo de projeto de pesquisa"),
  });
  await expect(page.getByRole("button", { name: "Registrar título" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "Registrar título" }).click();
  await expect(page.getByText("Título registrado", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Próximo: Revisão" }).click();
  await expect(page.getByRole("heading", { name: "Revisão da Inscrição" })).toBeVisible({ timeout: 20_000 });
  for (let index = 0; index < 4; index += 1) {
    await page.locator(".wiz-confirm-row button").nth(index).click();
  }
  await expect(page.getByRole("button", { name: "Enviar inscrição" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "Enviar inscrição" }).click();
  await expect(page.getByText("Inscrição enviada", { exact: true })).toBeVisible({ timeout: 20_000 });
});
