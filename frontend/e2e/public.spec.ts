import { expect, test } from "@playwright/test";

test("lista publica de editais carrega", async ({ page }) => {
  await page.goto("/editais");

  await expect(page.getByRole("heading", { name: "Editais" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Consulta publica do processo")).toBeVisible();
});
