import { expect, test } from "@playwright/test";

import {
  homologarFinalApi,
  homologarPreliminarApi,
  liberarEspelhoEtapa1Api,
  liberarEspelhoEtapa2Api,
  loginAsAdmin,
  registrarEtapa1Api,
  registrarEtapa2Api,
  setupCandidateSubmissionFixture,
  waitForAuthenticatedSession,
} from "./helpers/system";

test("candidato solicita e visualiza espelhos reais das etapas 1 e 2 pela UI", async ({ page, request }) => {
  test.setTimeout(240_000);

  const fixture = await setupCandidateSubmissionFixture(request, [{ tipo: "INSCRICAO", titulo: "Inscricao aberta" }]);
  const adminToken = await loginAsAdmin(request);

  await homologarPreliminarApi(request, adminToken, fixture.inscricaoId);
  await homologarFinalApi(request, adminToken, fixture.inscricaoId);
  await registrarEtapa1Api(request, adminToken, fixture.inscricaoId, { publicacao: "PRELIMINAR", liberarEspelho: false });

  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(fixture.email);
  await page.getByLabel("Senha").fill(fixture.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await waitForAuthenticatedSession(page);

  await page.goto(`/candidato/editais/${fixture.editalId}/espelhos`);
  await page.getByRole("button", { name: "Solicitar espelho da etapa 1" }).click();
  await expect(page.getByText("Solicitacao do espelho da etapa 1 registrada.")).toBeVisible({ timeout: 20_000 });

  await liberarEspelhoEtapa1Api(request, adminToken, fixture.inscricaoId);
  await page.reload();
  await page.getByRole("button", { name: "Ver espelho da etapa 1" }).click();
  await expect(page.getByText("Espelho estruturado da etapa 1.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Rubrica detalhada")).toBeVisible();

  await registrarEtapa1Api(request, adminToken, fixture.inscricaoId, { publicacao: "FINAL", liberarEspelho: true });
  await registrarEtapa2Api(request, adminToken, fixture.inscricaoId, { liberarEspelho: false });

  await page.reload();
  await page.getByRole("button", { name: "Solicitar espelho da etapa 2" }).click();
  await expect(page.getByText("Solicitacao do espelho da etapa 2 registrada.")).toBeVisible({ timeout: 20_000 });

  await liberarEspelhoEtapa2Api(request, adminToken, fixture.inscricaoId);
  await page.reload();
  await page.getByRole("button", { name: "Ver espelho da etapa 2" }).click();
  await expect(page.getByText("Espelho estruturado da etapa 2.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Pontuacao por item")).toBeVisible();
  await expect(page.getByText("Glosas", { exact: true })).toBeVisible();
});
