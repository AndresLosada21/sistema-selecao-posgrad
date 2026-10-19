import { expect, test } from "@playwright/test";

import { fillCandidatePersonalStep, saveDraftAndGoToAcademicStep } from "./helpers/candidate-form";
import {
  createGrupoPesquisaApi,
  createOperationalEdital,
  loginCandidateViaUi,
  participateInEdital,
  registerCandidateApi,
} from "./helpers/system";

test("doutorado com grupo opcional mostra o seletor e permite seguir sem escolher", async ({ page, request }) => {
  test.setTimeout(240_000);

  const fixture = await createOperationalEdital(request, {
    cursoNivel: "DOUTORADO",
    windows: [{ tipo: "INSCRICAO", titulo: "Inscricao aberta" }],
  });

  const grupo = await createGrupoPesquisaApi(request, {
    editalId: fixture.editalId,
    adminToken: fixture.adminToken,
    nome: "Grupo Opcional E2E",
  });

  const candidate = await registerCandidateApi(request);
  await participateInEdital(request, fixture.editalId, candidate.token);
  await loginCandidateViaUi(page, candidate.email, candidate.senha);

  await page.goto(`/candidato/editais/${fixture.editalId}/inscricao`);
  await expect(page).toHaveURL(new RegExp(`/candidato/editais/${fixture.editalId}/inscricao$`), { timeout: 20_000 });

  await fillCandidatePersonalStep(page);
  await saveDraftAndGoToAcademicStep(page);

  const grupoField = page.locator(".wiz-field").filter({ hasText: "Grupo de Pesquisa" }).first();
  await expect(grupoField.getByText("Grupo de Pesquisa (opcional)")).toBeVisible({ timeout: 20_000 });
  await expect(grupoField.locator("select")).toContainText(grupo.nome);

  await page.getByPlaceholder("Descreva brevemente sua formação, experiências e principais publicações...").fill(
    "Experiência em pesquisa e desenvolvimento de sistemas de controle.",
  );

  await page.getByRole("button", { name: "Próximo: Redação" }).click();
  await expect(page.getByRole("heading", { name: "Pré-projeto" })).toBeVisible({ timeout: 20_000 });
});
