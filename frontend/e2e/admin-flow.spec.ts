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
  await page.getByLabel("Parecer preliminar").fill("Pedido preliminarmente deferido na analise administrativa.");
  await page.getByRole("button", { name: "Registrar decisao", exact: true }).click();
  await expect(page.getByText("Decisao preliminar registrada.")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Parecer final").fill("Pedido deferido em resultado final administrativo.");
  await page.getByRole("button", { name: "Registrar decisao final" }).click();
  await expect(page.getByText("Decisao final registrada.")).toBeVisible({ timeout: 20_000 });

  await loginAsAdminViaUi(page, request);
  await page.goto(`/admin/homologacao/${fixture.inscricaoId}`);
  const homologacaoPreliminarCard = page.locator(".admin-form-card").filter({ hasText: "Resultado preliminar da homologacao" });
  const homologacaoFinalCard = page.locator(".admin-form-card").filter({ hasText: "Resultado final da homologacao" });
  await expect(homologacaoPreliminarCard).toBeVisible({ timeout: 20_000 });
  await homologacaoPreliminarCard.locator("select").first().selectOption("HOMOLOGADA");
  await page.getByLabel("Parecer preliminar").fill("Documentacao preliminar homologada pela operacao.");
  await homologacaoPreliminarCard.getByRole("button", { name: "Registrar homologacao" }).click();
  await expect(page.getByText("Resultado preliminar salvo.")).toBeVisible({ timeout: 20_000 });
  await homologacaoFinalCard.locator("select").first().selectOption("HOMOLOGADA");
  await page.getByLabel("Parecer final").fill("Documentacao final homologada para seguir na etapa 1.");
  await homologacaoFinalCard.getByRole("button", { name: "Registrar homologacao" }).click();
  await expect(page.getByText("Resultado final salvo.")).toBeVisible({ timeout: 20_000 });

  await loginAsAdminViaUi(page, request);
  await page.goto(`/admin/etapa-1/${fixture.inscricaoId}`);
  for (const criterio of ["Adequacao e dominio do tema", "Estrutura", "Organizacao textual e coerencia", "Objetividade e capacidade de sintese", "Grafia, acentuacao e gramatica"]) {
    await page.locator(".admin-eval-field", { hasText: criterio }).locator('input[type="number"]').fill("8");
  }
  await page.getByLabel("Espelho de correcao").fill("Espelho administrativo da etapa 1 via UI.");
  await page.getByRole("button", { name: "Salvar avaliacao" }).click();
  await expect(page.getByText("Resultado da etapa 1 salvo.")).toBeVisible({ timeout: 20_000 });
});
