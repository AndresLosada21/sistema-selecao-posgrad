import { expect, test } from "@playwright/test";
import { buildUniqueCandidate } from "./helpers/candidate";
import { waitForAuthenticatedSession } from "./helpers/system";

test("cadastro e login do candidato funcionam pela UI", async ({ page }) => {
  const candidate = buildUniqueCandidate();

  await page.goto("/criar-conta");
  await page.getByLabel("Nome completo").fill(candidate.nomeCompleto);
  await page.getByLabel("E-mail").fill(candidate.email);
  await page.getByLabel("Senha").fill(candidate.senha);
  await page.getByLabel("Telefone").fill(candidate.telefone);
  await page.getByLabel("CPF").fill(candidate.cpf);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await waitForAuthenticatedSession(page);

  await expect.poll(async () => {
    await page.goto("/candidato");
    return page.url();
  }, { timeout: 20_000 }).toMatch(/\/candidato(\/|$)/);
  await page.goto("/candidato");
  await expect(page.getByText("Nenhuma participacao encontrada")).toBeVisible();
  await page.getByTitle("Encerrar sessao").click();

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(candidate.email);
  await page.getByLabel("Senha").fill(candidate.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await waitForAuthenticatedSession(page);

  await expect.poll(async () => {
    await page.goto("/candidato");
    return page.url();
  }, { timeout: 20_000 }).toMatch(/\/candidato(\/|$)/);
  await page.goto("/candidato");
  await expect(page.getByText("Nenhuma participacao encontrada")).toBeVisible();
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
  await waitForAuthenticatedSession(page);

  await expect.poll(async () => {
    await page.goto("/candidato");
    return page.url();
  }, { timeout: 20_000 }).toMatch(/\/candidato(\/|$)/);

  await page.goto("/editais");
  await page.getByRole("button", { name: "Entrar neste edital" }).first().click();

  await expect(page).toHaveURL(/\/candidato\/editais\//, { timeout: 20_000 });
  await expect(page.getByText("Acompanhamento consolidado do edital", { exact: true })).toBeVisible();
});
