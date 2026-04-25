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

  const fixture = await setupCandidateSubmissionFixture(request, [
    { tipo: "INSCRICAO", titulo: "Inscricao aberta" },
    { tipo: "RECURSO_ETAPA_1", titulo: "Recurso da etapa 1" },
  ]);
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
  await page.getByRole("button", { name: "Solicitar espelho" }).click();
  await expect(page.getByText("Solicitacao registrada")).toBeVisible({ timeout: 20_000 });

  await liberarEspelhoEtapa1Api(request, adminToken, fixture.inscricaoId);
  await page.reload();
  await page.getByRole("button", { name: "Ver espelho" }).click();
  await expect(page.getByText("Espelho estruturado da etapa 1.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Adequacao e dominio do tema")).toBeVisible();

  const etapa2Fixture = await setupCandidateSubmissionFixture(request, [
    { tipo: "INSCRICAO", titulo: "Inscricao aberta" },
    { tipo: "RECURSO_ETAPA_2", titulo: "Recurso da etapa 2" },
  ]);

  await homologarPreliminarApi(request, adminToken, etapa2Fixture.inscricaoId);
  await homologarFinalApi(request, adminToken, etapa2Fixture.inscricaoId);
  await registrarEtapa1Api(request, adminToken, etapa2Fixture.inscricaoId, { publicacao: "PRELIMINAR", liberarEspelho: false });
  await registrarEtapa1Api(request, adminToken, etapa2Fixture.inscricaoId, { publicacao: "FINAL", liberarEspelho: true });
  await registrarEtapa2Api(request, adminToken, etapa2Fixture.inscricaoId, { liberarEspelho: false });

  await page.goto("/entrar");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(etapa2Fixture.email);
  await page.getByLabel("Senha").fill(etapa2Fixture.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await waitForAuthenticatedSession(page);

  await page.goto(`/candidato/editais/${etapa2Fixture.editalId}/espelhos`);
  await page.getByRole("button", { name: "Solicitar espelho" }).click();
  await expect(page.getByText("Solicitacao registrada")).toBeVisible({ timeout: 20_000 });

  await liberarEspelhoEtapa2Api(request, adminToken, etapa2Fixture.inscricaoId);
  await page.reload();
  await page.getByRole("button", { name: "Ver espelho" }).nth(1).click();
  await expect(page.getByText("Espelho estruturado da etapa 2.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Pontuacao bruta:")).toBeVisible();
  await expect(page.getByText("producao").first()).toBeVisible();
  await expect(page.getByText("Glosas aplicadas:")).toBeVisible();
});
