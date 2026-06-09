import { expect, test } from "@playwright/test";
import { buildUniqueCandidate } from "./helpers/candidate";
import { loginAsAdminViaUi, signOutViaPublicHeader, waitForAuthenticatedSession } from "./helpers/system";

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
  await expect(page.getByText("Você ainda não entrou em nenhum edital")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver editais" })).toBeVisible();
  await signOutViaPublicHeader(page);

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
  await expect(page.getByText("Você ainda não entrou em nenhum edital")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver editais" })).toBeVisible();
});

test("sessao autenticada e restaurada na area publica apos reload sem cookie CSRF legivel", async ({ page }) => {
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
  await expect(page.getByLabel("Navegacao principal").getByRole("link", { name: "Area do candidato" })).toBeVisible();

  await page.evaluate(() => {
    document.cookie = "XSRF-TOKEN=; Max-Age=0; path=/";
  });
  await page.reload();

  await expect(page.getByLabel("Navegacao principal").getByRole("link", { name: "Area do candidato" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Navegacao principal").getByRole("link", { name: "Entrar" })).toHaveCount(0);
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
  await expect(page.getByText(/Veja o que já foi concluído e o que ainda pode ser feito neste edital/)).toBeVisible();
});

test("conta administrativa autenticada tambem consegue aderir a um edital pela UI publica", async ({ page, request }) => {
  await loginAsAdminViaUi(page, request);

  await page.goto("/editais");
  const entrarButton = page.getByRole("button", { name: "Entrar neste edital" }).first();
  await expect(entrarButton).toBeVisible();
  await expect(page.getByText("Entre neste edital para ver os próximos passos disponíveis.").first()).toBeVisible();
  await entrarButton.click();

  await expect(page).toHaveURL(/\/candidato\/editais\//, { timeout: 20_000 });
});
