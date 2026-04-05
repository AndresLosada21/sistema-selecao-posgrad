import { expect, test } from "@playwright/test";
import { buildUniqueCandidate } from "./helpers/candidate";

test("cadastro e login do candidato funcionam pela UI", async ({ page }) => {
  const candidate = buildUniqueCandidate();

  await page.goto("/criar-conta");
  await page.getByLabel("Nome completo").fill(candidate.nomeCompleto);
  await page.getByLabel("E-mail").fill(candidate.email);
  await page.getByLabel("Senha").fill(candidate.senha);
  await page.getByLabel("Telefone").fill(candidate.telefone);
  await page.getByLabel("CPF").fill(candidate.cpf);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByRole("link", { name: "Area do candidato" })).toBeVisible({ timeout: 20_000 });
  await page.goto("/candidato");
  await expect(page.getByText("Area do candidato")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(candidate.email);
  await page.getByLabel("Senha").fill(candidate.senha);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByRole("link", { name: "Area do candidato" })).toBeVisible({ timeout: 20_000 });
  await page.goto("/candidato");
  await expect(page.getByText("Area do candidato")).toBeVisible();
});

test("candidato autenticado consegue aderir a um edital pela UI publica", async ({ page }) => {
  const candidate = buildUniqueCandidate();

  await page.goto("/criar-conta");
  await page.getByLabel("Nome completo").fill(candidate.nomeCompleto);
  await page.getByLabel("E-mail").fill(candidate.email);
  await page.getByLabel("Senha").fill(candidate.senha);
  await page.getByLabel("Telefone").fill(candidate.telefone);
  await page.getByLabel("CPF").fill(candidate.cpf);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByRole("link", { name: "Area do candidato" })).toBeVisible({ timeout: 20_000 });

  await page.goto("/editais");
  await page.getByRole("button", { name: "Entrar neste edital" }).first().click();

  await expect(page).toHaveURL(/\/candidato\/editais\//, { timeout: 20_000 });
  await expect(page.getByText("Acompanhamento consolidado do edital", { exact: true })).toBeVisible();
});
