import { expect, test } from "@playwright/test";

import { buildUniqueCandidate } from "./helpers/candidate";
import { waitForAuthenticatedSession } from "./helpers/system";

test("selecionar UF em naturalidade habilita a escolha do municipio", async ({ page }) => {
  test.setTimeout(120_000);
  const candidate = buildUniqueCandidate();

  await page.goto("/criar-conta");
  await page.getByLabel("Nome completo").fill(candidate.nomeCompleto);
  await page.getByLabel("E-mail").fill(candidate.email);
  await page.getByLabel("Senha").fill(candidate.senha);
  await page.getByLabel("Telefone").fill(candidate.telefone);
  await page.getByLabel("CPF").fill(candidate.cpf);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await waitForAuthenticatedSession(page);

  await page.goto("/editais");
  await page.getByRole("button", { name: "Entrar neste edital" }).first().click();
  await expect(page).toHaveURL(/\/candidato\/editais\//, { timeout: 20_000 });

  await page.getByRole("link", { name: "Nova inscricao" }).click();
  await expect(page).toHaveURL(/\/candidato\/editais\/.+\/inscricao$/, { timeout: 20_000 });

  await expect(page.getByRole("button", { name: /Salvar Rascunho/i })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Proximo: Dados Academicos/i })).toBeEnabled();

  const nacionalidadeField = page.locator(".wiz-field", { hasText: "Nacionalidade" }).first();
  await nacionalidadeField.locator("select").selectOption("Brasileira");

  const naturalidadeField = page.locator(".wiz-field", { hasText: "Naturalidade" });
  const ufSelect = naturalidadeField.locator("select").nth(0);
  const cidadeSelect = naturalidadeField.locator("select").nth(1);

  await ufSelect.selectOption("RR");

  await expect(cidadeSelect).toBeEnabled({ timeout: 15_000 });
  await expect(cidadeSelect.locator("option")).toContainText(["Boa Vista"], { timeout: 15_000 });

  await cidadeSelect.selectOption({ label: "Boa Vista" });
  await expect(cidadeSelect).toHaveValue("Boa Vista");
});
