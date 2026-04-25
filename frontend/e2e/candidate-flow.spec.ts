import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { participateInEdital, registerCandidateApi, waitForAuthenticatedSession } from "./helpers/system";

const backendBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";
const tokenStorageKey = "selecao-posgrad-token";

const documentoTiposObrigatorios = [
  "ANEXO_IV",
  "ANEXO_V",
  "DOCUMENTO_IDENTIFICACAO",
  "DIPLOMA",
  "HISTORICO",
  "CURRICULO",
  "COMPROVANTE_PAGAMENTO",
] as const;

function isoDateWithOffset(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function createPdfBuffer(text: string) {
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 12 Tf 20 100 Td (${text}) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000122 00000 n \n0000000248 00000 n \n0000000356 00000 n \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n426\n%%EOF`, "utf-8");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function createCandidateFlowEdital(request: APIRequestContext) {
  const adminToken = await loginAsAdmin(request);
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  const editalResponse = await request.post(`${backendBaseUrl}/v1/admin/editais`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      numero: `094/${suffix}`,
      titulo: `Fluxo real candidato ${suffix}`,
      descricao: "Edital tecnico para validar o fluxo E2E real do candidato pela UI.",
      ano: 2026,
      semestre: 1,
      cursoNivel: "MESTRADO",
      status: "RASCUNHO",
    },
  });

  expect(editalResponse.ok()).toBeTruthy();
  const edital = await editalResponse.json();

  const temaResponse = await request.post(`${backendBaseUrl}/v1/admin/editais/${edital.id}/temas-redacao`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      titulo: "Controle e automacao aplicada a sistemas energeticos",
      descricao: "Tema tecnico padrao do fluxo E2E do candidato.",
      ordem: 0,
      ativo: true,
    },
  });

  expect(temaResponse.ok()).toBeTruthy();

  const linhaResponse = await request.post(`${backendBaseUrl}/v1/admin/editais/${edital.id}/linhas`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      nome: `Linha fluxo ${suffix}`,
      descricao: "Linha de pesquisa usada no E2E real do candidato.",
      vagasAmplaConcorrencia: 2,
      vagasAcoesAfirmativas: 1,
      vagasPcd: 0,
    },
  });

  expect(linhaResponse.ok()).toBeTruthy();

  for (const cronograma of [
    { tipo: "PEDIDO_ISENCAO", titulo: "Solicitacao de isencao E2E" },
    { tipo: "INSCRICAO", titulo: "Inscricao E2E" },
  ]) {
    const cronogramaResponse = await request.post(`${backendBaseUrl}/v1/admin/editais/${edital.id}/cronogramas`, {
      headers: { Authorization: `Bearer ${adminToken}` },
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
    headers: { Authorization: `Bearer ${adminToken}` },
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

async function uploadSingleFile(page: Page, index: number, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.locator('input[type="file"]').nth(index).setInputFiles(file);
}

async function authenticateCandidate(page: Page, token: string) {
  await page.goto("/");
  await page.evaluate(([storageKey, value]) => {
    window.localStorage.setItem(storageKey, value);
  }, [tokenStorageKey, token]);
  await waitForAuthenticatedSession(page);
}

function wizardField(page: Page, label: string) {
  return page.locator(".wiz-field").filter({
    has: page.locator(".wiz-field-label", { hasText: new RegExp(`^${escapeRegex(label)}$`, "i") }),
  }).first();
}

async function fillWizardField(page: Page, label: string, value: string) {
  await wizardField(page, label).locator("input, textarea").first().fill(value);
}

async function selectWizardField(page: Page, label: string, value: string) {
  await wizardField(page, label).locator("select").first().selectOption(value);
}

test("candidato percorre isencao, inscricao e submissao pela UI real", async ({ page, request }) => {
  test.setTimeout(300_000);

  const { editalId } = await createCandidateFlowEdital(request);
  const candidate = await registerCandidateApi(request);
  await participateInEdital(request, editalId, candidate.token);
  await authenticateCandidate(page, candidate.token);

  await page.goto(`/candidato/editais/${editalId}/isencao/nova`);
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}/isencao/nova$`), { timeout: 20_000 });
  await page.getByLabel("Justificativa").fill("Solicito isencao por indisponibilidade financeira devidamente comprovada.");
  await uploadSingleFile(page, 0, {
    name: "comprovante-isencao.pdf",
    mimeType: "application/pdf",
    buffer: createPdfBuffer("Comprovante de isencao"),
  });
  await expect(page.getByRole("button", { name: "Solicitar isencao" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "Solicitar isencao" }).click();
  await expect(page.getByText("Pedido de isencao enviado. Voce sera redirecionado para acompanhar o status.")).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}$`), { timeout: 20_000 });
  await expect(page.getByText("Solicitada").first()).toBeVisible();

  await page.goto(`/candidato/editais/${editalId}/inscricao`);
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}/inscricao$`), { timeout: 20_000 });

  await fillWizardField(page, "Nome Completo", "Candidato UI Fluxo");
  await fillWizardField(page, "CPF", "52998224725");
  await fillWizardField(page, "RG", "1234567");
  await fillWizardField(page, "Data de Expedicao do RG", "01012020");
  await fillWizardField(page, "Data de Nascimento", "01011990");
  await selectWizardField(page, "Genero", "MASCULINO");
  await selectWizardField(page, "Nacionalidade", "Brasileira");

  const naturalidadeField = wizardField(page, "Naturalidade");
  await naturalidadeField.locator("select").nth(0).selectOption("AM");
  const naturalidadeCidade = naturalidadeField.locator("select").nth(1);
  await expect(naturalidadeCidade).toBeEnabled({ timeout: 15_000 });
  await naturalidadeCidade.selectOption({ label: "Manaus" });

  await selectWizardField(page, "Estado Civil", "SOLTEIRO");
  await fillWizardField(page, "Telefone / WhatsApp", "92999999999");
  await fillWizardField(page, "CEP", "69000000");
  await fillWizardField(page, "Logradouro", "Rua Teste, 123");
  await fillWizardField(page, "Bairro", "Centro");

  const enderecoRow = page.locator(".wiz-field-row", { hasText: "Bairro" }).last();
  await enderecoRow.locator("select").nth(1).selectOption("AM");
  const cidadeResidencial = enderecoRow.locator("select").nth(0);
  await expect(cidadeResidencial).toBeEnabled({ timeout: 15_000 });
  await cidadeResidencial.selectOption({ label: "Manaus" });

  await selectWizardField(page, "Tipo Sanguineo", "O+");
  await selectWizardField(page, "Raca/Cor", "NAO_DECLARADA");
  await fillWizardField(page, "Nome do Pai", "Pai Teste");
  await fillWizardField(page, "Nome da Mae", "Mae Teste");
  await selectWizardField(page, "Situacao de Trabalho", "EMPREGADO");
  await selectWizardField(page, "Regime de Trabalho", "INTEGRAL");
  await fillWizardField(page, "Instituicao / Local de Trabalho", "UFAM");
  await fillWizardField(page, "Unidade / Departamento", "PPGEE");
  await fillWizardField(page, "Endereco do Trabalho", "Av. Teste");
  await fillWizardField(page, "CEP do Trabalho", "69080900");
  await fillWizardField(page, "Cidade/Bairro do Trabalho", "Manaus Centro");

  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Proximo: Dados Academicos" }).click();
  await expect(page.getByRole("heading", { name: "Dados Academicos e Linha de Pesquisa" })).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder("Descreva brevemente sua formacao, experiencias e principais publicacoes...").fill("Experiencia em pesquisa, extensao e desenvolvimento de sistemas embarcados.");

  await page.getByRole("button", { name: "Proximo: Redacao" }).click();
  await expect(page.getByRole("heading", { name: "Redacao — Proposta de Pesquisa" })).toBeVisible({ timeout: 20_000 });
  await page.locator("div", { hasText: "Tema da Redacao" }).locator("select").first().selectOption({ label: "Controle e automacao aplicada a sistemas energeticos" });
  await page.locator("textarea").first().fill("A".repeat(600));

  await page.getByRole("button", { name: "Proximo: Documentos" }).click();
  await expect(page.getByRole("heading", { name: "Documentos da Inscricao" })).toBeVisible({ timeout: 20_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar Anexo IV preenchido" }).click();
  await downloadPromise;
  await uploadSingleFile(page, 0, {
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
    await uploadSingleFile(page, 1, {
      name: `${tipo.toLowerCase()}.pdf`,
      mimeType: "application/pdf",
      buffer: createPdfBuffer(`Documento ${tipo}`),
    });
    await expect(page.getByText(`${tipo.toLowerCase()}.pdf`)).toBeVisible({ timeout: 20_000 });
    await expect(addDocumentForm.getByRole("button", { name: "Registrar documento" })).toBeEnabled({ timeout: 20_000 });
    await addDocumentForm.getByRole("button", { name: "Registrar documento" }).click();
    await expect(page.getByText("Documento enviado", { exact: true })).toBeVisible({ timeout: 20_000 });
  }

  await page.getByRole("button", { name: "Proximo: Revisao" }).click();
  await expect(page.getByRole("heading", { name: "Revisao da Inscricao" })).toBeVisible({ timeout: 20_000 });
  for (let index = 0; index < 4; index += 1) {
    await page.locator(".wiz-confirm-row button").nth(index).click();
  }
  await expect(page.getByRole("button", { name: "Enviar inscricao" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "Enviar inscricao" }).click();
  await expect(page.getByText("Inscricao enviada", { exact: true })).toBeVisible({ timeout: 20_000 });
});
