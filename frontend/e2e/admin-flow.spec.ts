import { expect, test } from "@playwright/test";

import { loginAsAdminViaUi, setupCandidateSubmissionFixture } from "./helpers/system";

test("admin percorre isencao, homologacao e etapa 1 pela UI real", async ({ page, request }) => {
  test.setTimeout(240_000);

  const fixture = await setupCandidateSubmissionFixture(
    request,
    [
      { tipo: "PEDIDO_ISENCAO", titulo: "Isencao aberta" },
      { tipo: "INSCRICAO", titulo: "Inscricao aberta" },
    ],
    { withIsencao: true },
  );

  await loginAsAdminViaUi(page, request);

  await page.goto(`/admin/isencao/${fixture.pedidoIsencaoId}`);
  await page.getByLabel("Parecer preliminar").fill("Pedido preliminarmente deferido na análise administrativa.");
  await page.getByRole("button", { name: "Registrar decisão", exact: true }).click();
  await expect(page.getByText("Decisão preliminar registrada.")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Parecer final").fill("Pedido deferido em resultado final administrativo.");
  await page.getByRole("button", { name: "Registrar decisão final" }).click();
  await expect(page.getByText("Decisão final registrada.")).toBeVisible({ timeout: 20_000 });

  await page.goto(`/admin/homologacao/${fixture.inscricaoId}`);
  const homologacaoPreliminarCard = page.locator(".admin-form-card").filter({ hasText: "Resultado preliminar da homologação" });
  const homologacaoFinalCard = page.locator(".admin-form-card").filter({ hasText: "Resultado final da homologação" });
  await expect(homologacaoPreliminarCard).toBeVisible({ timeout: 20_000 });
  await homologacaoPreliminarCard.locator("select").first().selectOption("HOMOLOGADA");
  await page.getByLabel("Parecer preliminar").fill("Documentação preliminar homologada pela operação.");
  await homologacaoPreliminarCard.getByRole("button", { name: "Registrar homologação" }).click();
  await expect(page.getByText("Resultado preliminar salvo.")).toBeVisible({ timeout: 20_000 });
  await homologacaoFinalCard.locator("select").first().selectOption("HOMOLOGADA");
  await page.getByLabel("Parecer final").fill("Documentação final homologada para seguir na etapa 1.");
  await homologacaoFinalCard.getByRole("button", { name: "Registrar homologação final" }).click();
  await expect(page.getByText("Resultado final salvo.")).toBeVisible({ timeout: 20_000 });

  await page.goto(`/admin/etapa-1/${fixture.inscricaoId}`);
  for (const criterio of ["Adequação e domínio do tema", "Estrutura", "Organização textual e coerência", "Objetividade e capacidade de síntese", "Grafia, acentuação e gramática"]) {
    await page.locator(".admin-eval-field", { hasText: criterio }).locator('input[type="number"]').fill("8");
  }
  await page.getByLabel("Espelho de correção").fill("Espelho administrativo da etapa 1 via UI.");
  await page.getByRole("button", { name: "Salvar avaliacao" }).click();
  await expect(page.getByText("Resultado da etapa 1 salvo.")).toBeVisible({ timeout: 20_000 });
});
