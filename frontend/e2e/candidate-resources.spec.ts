import { expect, test } from "@playwright/test";

import {
  createPdfBuffer,
  homologarPreliminarApi,
  loginAsAdmin,
  setupCandidateSubmissionFixture,
  waitForAuthenticatedSession,
} from "./helpers/system";

test("candidato registra recurso real pela UI apos resultado preliminar", async ({ page, request }) => {
  test.setTimeout(180_000);

  const fixture = await setupCandidateSubmissionFixture(request, [
    { tipo: "INSCRICAO", titulo: "Inscricao aberta" },
    { tipo: "RECURSO_HOMOLOGACAO", titulo: "Recurso de homologacao" },
  ]);

  const adminToken = await loginAsAdmin(request);
  await homologarPreliminarApi(request, adminToken, fixture.inscricaoId, "Resultado preliminar de homologacao publicado.");

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(fixture.email);
  await page.getByLabel("Senha").fill(fixture.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await waitForAuthenticatedSession(page);

  await expect.poll(async () => {
    await page.goto("/candidato");
    return page.url();
  }, { timeout: 20_000 }).toMatch(/\/candidato(\/|$)/);

  await page.goto(`/candidato/recursos?editalId=${fixture.editalId}&fase=HOMOLOGACAO`);
  await expect(page.getByRole("heading", { name: "Novo recurso" })).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Fundamentacao").fill("Apresento recurso administrativo contra o resultado preliminar da homologacao.");
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "anexo-recurso.pdf",
    mimeType: "application/pdf",
    buffer: createPdfBuffer("Anexo de recurso"),
  });
  await expect(page.getByText("anexo-recurso.pdf")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Enviar recurso" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "Enviar recurso" }).click();

  await expect(page.getByText("Recurso — Homologacao")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Apresento recurso administrativo contra o resultado preliminar da homologacao.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Baixar anexo enviado" })).toBeVisible();
});
