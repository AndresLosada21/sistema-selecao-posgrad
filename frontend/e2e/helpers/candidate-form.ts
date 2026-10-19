import { expect, type Page } from "@playwright/test";

export function createPdfBuffer(text: string) {
  return Buffer.from(`%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 58>>stream\nBT /F1 12 Tf 20 100 Td (${text}) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000122 00000 n \n0000000248 00000 n \n0000000356 00000 n \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n426\n%%EOF`, "utf-8");
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function uploadSingleFile(page: Page, index: number, file: { name: string; mimeType: string; buffer: Buffer }) {
  await page.locator('input[type="file"]').nth(index).setInputFiles(file);
}

export function wizardField(page: Page, label: string) {
  return page.locator(".wiz-field").filter({
    has: page.locator(".wiz-field-label", { hasText: new RegExp(`^${escapeRegex(label)}$`, "i") }),
  }).first();
}

export async function fillWizardField(page: Page, label: string, value: string) {
  await wizardField(page, label).locator("input, textarea").first().fill(value);
}

export async function selectWizardField(page: Page, label: string, value: string) {
  await wizardField(page, label).locator("select").first().selectOption(value);
}

export async function fillCandidatePersonalStep(page: Page) {
  await fillWizardField(page, "Nome Completo", "Candidato UI Fluxo");
  await fillWizardField(page, "CPF", "52998224725");
  await fillWizardField(page, "RG", "1234567");
  await fillWizardField(page, "Data de Expedição do RG", "01012020");
  await fillWizardField(page, "Data de Nascimento", "01011990");
  await selectWizardField(page, "Gênero", "MASCULINO");
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

  await selectWizardField(page, "Tipo Sanguíneo", "O+");
  await selectWizardField(page, "Raça/Cor", "NAO_DECLARADA");
  await fillWizardField(page, "Nome do Pai", "Pai Teste");
  await fillWizardField(page, "Nome da Mãe", "Mãe Teste");
  await selectWizardField(page, "Situação de Trabalho", "EMPREGADO");
  await selectWizardField(page, "Regime de Trabalho", "INTEGRAL");
  await fillWizardField(page, "Instituição / Local de Trabalho", "UFAM");
  await fillWizardField(page, "Unidade / Departamento", "PPGEE");
  await fillWizardField(page, "Endereço do Trabalho", "Av. Teste");
  await fillWizardField(page, "CEP do Trabalho", "69080900");
  await fillWizardField(page, "Cidade/Bairro do Trabalho", "Manaus Centro");
}

export async function saveDraftAndGoToAcademicStep(page: Page) {
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: "Próximo: Dados Acadêmicos" }).click();
  await expect(page.getByRole("heading", { name: "Dados Acadêmicos e Linha de Pesquisa" })).toBeVisible({ timeout: 20_000 });
}
