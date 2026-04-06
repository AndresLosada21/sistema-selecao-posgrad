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
  await page.getByRole("button", { name: "Registrar preliminar" }).click();
  await expect(page.getByText("Decisao preliminar registrada.")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Parecer final").fill("Pedido deferido em resultado final administrativo.");
  await page.getByRole("button", { name: "Registrar final" }).click();
  await expect(page.getByText("Decisao final registrada.")).toBeVisible({ timeout: 20_000 });

  await page.goto(`/admin/homologacao/${fixture.inscricaoId}`);
  await page.getByLabel("Parecer preliminar").fill("Documentacao preliminar homologada pela operacao.");
  await page.getByRole("button", { name: "Registrar preliminar" }).click();
  await expect(page.getByText("Homologacao preliminar registrada")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Parecer final").fill("Documentacao final homologada para seguir na etapa 1.");
  await page.getByRole("button", { name: "Registrar final" }).click();
  await expect(page.getByText("Homologacao final registrada")).toBeVisible({ timeout: 20_000 });

  await page.goto(`/admin/etapa-1/${fixture.inscricaoId}`);
  await page.getByRole("textbox", { name: /^Tema$/ }).fill("Controle e automacao aplicada a sistemas energeticos");
  await page.getByRole("spinbutton", { name: /^Adequacao ao tema$/ }).fill("8");
  await page.getByRole("spinbutton", { name: /^Estrutura$/ }).fill("8");
  await page.getByRole("spinbutton", { name: /^Organizacao e coerencia$/ }).fill("8");
  await page.getByRole("spinbutton", { name: /^Objetividade e sintese$/ }).fill("8");
  await page.getByRole("spinbutton", { name: /^Grafia e gramatica$/ }).fill("8");
  await page.getByLabel("Espelho de correcao").fill("Espelho administrativo da etapa 1 via UI.");
  await page.getByRole("button", { name: "Registrar resultado" }).click();
  await expect(page.getByText("Resultado da etapa 1 enviado ao backend e estado recarregado.")).toBeVisible({ timeout: 20_000 });
});
