import { expect, test } from "@playwright/test";

import {
  homologarFinalApi,
  homologarPreliminarApi,
  liberarEspelhoEtapa1Api,
  liberarEspelhoEtapa2Api,
  loginCandidateViaUi,
  loginAsAdmin,
  registrarEtapa1Api,
  registrarEtapa2Api,
  signOutViaPublicHeader,
  setupCandidateSubmissionFixture,
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

  await loginCandidateViaUi(page, fixture.email, fixture.senha);

  await page.goto(`/candidato/editais/${fixture.editalId}/espelhos`);
  await page.getByRole("button", { name: "Solicitar espelho" }).click();
  await expect(page.getByText("Solicitação registrada")).toBeVisible({ timeout: 20_000 });

  await liberarEspelhoEtapa1Api(request, adminToken, fixture.inscricaoId);
  await page.reload();
  await page.getByRole("button", { name: "Ver espelho" }).click();
  await expect(page.getByText("Espelho estruturado da etapa 1.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Adequação e domínio do tema")).toBeVisible();

  const etapa2Fixture = await setupCandidateSubmissionFixture(request, [
    { tipo: "INSCRICAO", titulo: "Inscricao aberta" },
    { tipo: "RECURSO_ETAPA_2", titulo: "Recurso da etapa 2" },
  ]);

  await homologarPreliminarApi(request, adminToken, etapa2Fixture.inscricaoId);
  await homologarFinalApi(request, adminToken, etapa2Fixture.inscricaoId);
  await registrarEtapa1Api(request, adminToken, etapa2Fixture.inscricaoId, { publicacao: "PRELIMINAR", liberarEspelho: false });
  await registrarEtapa1Api(request, adminToken, etapa2Fixture.inscricaoId, { publicacao: "FINAL", liberarEspelho: true });
  await registrarEtapa2Api(request, adminToken, etapa2Fixture.inscricaoId, { liberarEspelho: false });

  await signOutViaPublicHeader(page);
  await loginCandidateViaUi(page, etapa2Fixture.email, etapa2Fixture.senha);

  await page.goto(`/candidato/editais/${etapa2Fixture.editalId}/espelhos`);
  await page.getByRole("button", { name: "Solicitar espelho" }).click();
  await expect(page.getByText("Solicitação registrada")).toBeVisible({ timeout: 20_000 });

  await liberarEspelhoEtapa2Api(request, adminToken, etapa2Fixture.inscricaoId);
  await page.reload();
  await page.getByRole("button", { name: "Ver espelho" }).nth(1).click();
  await expect(page.getByText("Espelho estruturado da etapa 2.")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Pontuação bruta:")).toBeVisible();
  await expect(page.getByText("titulo").first()).toBeVisible();
  await expect(page.getByText("Glosas aplicadas:")).toBeVisible();
});
