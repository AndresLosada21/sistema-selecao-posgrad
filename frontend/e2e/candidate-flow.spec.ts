import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { buildUniqueCandidate } from "./helpers/candidate";

const backendBaseUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:4000";

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

function createPngBuffer() {
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0fcAAAAASUVORK5CYII=", "base64");
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
      status: "PUBLICADO",
      publicadoEm: new Date().toISOString(),
    },
  });

  expect(editalResponse.ok()).toBeTruthy();
  const edital = await editalResponse.json();

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

  return { editalId: edital.id };
}

async function registerAndReachCandidateArea(page: Page) {
  const candidate = buildUniqueCandidate();

  await page.goto("/criar-conta");
  await page.getByLabel("Nome completo").fill(candidate.nomeCompleto);
  await page.getByLabel("E-mail").fill(candidate.email);
  await page.getByLabel("Senha").fill(candidate.senha);
  await page.getByLabel("Telefone").fill(candidate.telefone);
  await page.getByLabel("CPF").fill(candidate.cpf);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByRole("link", { name: "Area do candidato" })).toBeVisible({ timeout: 20_000 });
  return candidate;
}

async function uploadSingleFile(page: Page, index: number, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.locator('input[type="file"]').nth(index).setInputFiles(file);
}

test("candidato percorre isencao, inscricao e submissao pela UI real", async ({ page, request }) => {
  test.setTimeout(180_000);

  const { editalId } = await createCandidateFlowEdital(request);
  await registerAndReachCandidateArea(page);

  await page.goto(`/editais/${editalId}`);
  await page.getByRole("button", { name: "Entrar neste edital" }).click();
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}$`), { timeout: 20_000 });

  await expect(page.getByRole("link", { name: "Registrar pedido de isencao" })).toBeVisible();
  await page.goto(`/candidato/editais/${editalId}/isencao/nova`);
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}/isencao/nova$`), { timeout: 20_000 });
  await page.getByLabel("Justificativa").fill("Solicito isencao por indisponibilidade financeira devidamente comprovada.");
  await uploadSingleFile(page, 0, {
    name: "comprovante-isencao.pdf",
    mimeType: "application/pdf",
    buffer: createPdfBuffer("Comprovante de isencao"),
  });
  await page.getByRole("button", { name: "Registrar pedido de isencao" }).click();
  await expect(page.getByText("Pedido de isencao registrado", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}$`), { timeout: 20_000 });
  await expect(page.getByText(/Isencao: .*SOLICITADA|Isencao: Solicitada/i)).toBeVisible();

  await page.goto(`/candidato/editais/${editalId}/inscricao`);
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${editalId}/inscricao$`), { timeout: 20_000 });

  await page.getByLabel("Tema da redacao").fill("Controle e automacao aplicada a sistemas energeticos");
  await page.getByLabel("Resumo do curriculo").fill("Experiencia em pesquisa, extensao e desenvolvimento de sistemas embarcados.");
  await page.getByRole("textbox", { name: /^Redacao/ }).fill("A".repeat(600));
  await uploadSingleFile(page, 0, {
    name: "assinatura-candidato.png",
    mimeType: "image/png",
    buffer: createPngBuffer(),
  });

  const textFields = new Map<string, string>([
    ["Nome completo", "Candidato UI Fluxo"],
    ["RG", "1234567"],
    ["Data de expedicao do RG", "2020-01-01"],
    ["CPF", "12345678901"],
    ["Nacionalidade", "Brasileira"],
    ["Naturalidade", "Manaus"],
    ["E-mail", `fluxo.${Date.now()}@teste.local`],
    ["Telefone / WhatsApp", "92999999999"],
    ["Data de nascimento", "1990-01-01"],
    ["Estado civil", "Solteiro"],
    ["Tipo sanguineo", "O"],
    ["Fator RH", "+"],
    ["Nome do pai", "Pai Teste"],
    ["Nome da mae", "Mae Teste"],
    ["Endereco residencial", "Rua Teste, 123"],
    ["CEP residencial", "69000000"],
    ["Bairro residencial", "Centro"],
    ["UF residencial", "AM"],
    ["Cidade residencial", "Manaus"],
    ["Instituicao de trabalho", "UFAM"],
    ["Unidade / departamento", "PPGEE"],
    ["Endereco de trabalho", "Av. Teste"],
    ["CEP de trabalho", "69080900"],
    ["Cidade / bairro de trabalho", "Manaus Centro"],
  ]);

  for (const [label, value] of textFields.entries()) {
    await page.getByRole("textbox", { name: new RegExp(`^${escapeRegex(label)}$`) }).fill(value);
  }

  await page.getByLabel("Situacao profissional").selectOption("EMPREGADO");
  await page.getByLabel("Regime de trabalho").selectOption("INTEGRAL");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible({ timeout: 20_000 });

  for (const tipo of documentoTiposObrigatorios) {
    await page.getByLabel("Tipo de documento").selectOption(tipo);
    await page.getByLabel("Nome").last().fill(`Documento ${tipo}`);
    await uploadSingleFile(page, 1, {
      name: `${tipo.toLowerCase()}.pdf`,
      mimeType: "application/pdf",
      buffer: createPdfBuffer(`Documento ${tipo}`),
    });
    await expect(page.getByText("Arquivo enviado", { exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Registrar documento" }).click();
    await expect(page.getByText("Documento sincronizado", { exact: true })).toBeVisible({ timeout: 20_000 });
  }

  await page.getByRole("button", { name: "Submeter inscricao" }).click();
  await expect(page.getByText("Inscricao submetida", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Status atual: SUBMETIDA/)).toBeVisible();
});
