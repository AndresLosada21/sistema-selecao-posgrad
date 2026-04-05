import { expect, test } from "@playwright/test";

test("preview de token de recuperacao nao aparece em producao", async ({ page }) => {
  await page.goto("/esqueci-senha");
  await page.getByLabel("E-mail").fill("naoexiste@example.com");
  await page.getByRole("button", { name: "Solicitar recuperacao" }).click();

  await expect(page.getByText("Se a conta existir e estiver apta, a recuperacao foi solicitada.")).toBeVisible();
  await expect(page.getByText("Preview de desenvolvimento:")).toHaveCount(0);
});
