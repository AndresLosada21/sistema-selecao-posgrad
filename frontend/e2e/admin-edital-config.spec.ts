import { expect, test } from "@playwright/test";

import { createOperationalEdital, loginAsAdminViaUi } from "./helpers/system";

test("admin alterna a reserva unificada de acoes afirmativas e PCD e persiste a escolha", async ({ page, request }) => {
  test.setTimeout(240_000);

  const fixture = await createOperationalEdital(request, {
    cursoNivel: "DOUTORADO",
    windows: [{ tipo: "INSCRICAO", titulo: "Inscricao aberta" }],
  });

  await loginAsAdminViaUi(page, request);
  await page.goto(`/admin/editais/${fixture.editalId}`);

  const checkbox = page.getByLabel("Unificar ações afirmativas e PCD na mesma reserva");
  await expect(checkbox).toBeVisible({ timeout: 20_000 });
  await expect(checkbox).toBeChecked();

  await checkbox.uncheck();
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Configuração do processo salva.")).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByLabel("Unificar ações afirmativas e PCD na mesma reserva")).not.toBeChecked({ timeout: 20_000 });

  await page.getByLabel("Unificar ações afirmativas e PCD na mesma reserva").check();
  await page.getByRole("button", { name: "Salvar configuração" }).click();
  await expect(page.getByText("Configuração do processo salva.")).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByLabel("Unificar ações afirmativas e PCD na mesma reserva")).toBeChecked({ timeout: 20_000 });
});
