ALTER TABLE "AvaliacaoEtapa1" ADD COLUMN "editalId" TEXT;
ALTER TABLE "AvaliacaoEtapa2" ADD COLUMN "editalId" TEXT;
ALTER TABLE "Recurso" ADD COLUMN "editalId" TEXT;
ALTER TABLE "ClassificacaoFinal" ADD COLUMN "editalId" TEXT;

UPDATE "AvaliacaoEtapa1" a
SET "editalId" = p."editalId"
FROM "Inscricao" i
JOIN "ParticipacaoEdital" p ON p.id = i."participacaoEditalId"
WHERE i.id = a."inscricaoId";

UPDATE "AvaliacaoEtapa2" a
SET "editalId" = p."editalId"
FROM "Inscricao" i
JOIN "ParticipacaoEdital" p ON p.id = i."participacaoEditalId"
WHERE i.id = a."inscricaoId";

UPDATE "Recurso" r
SET "editalId" = p."editalId"
FROM "ParticipacaoEdital" p
WHERE p.id = r."participacaoEditalId";

UPDATE "ClassificacaoFinal" c
SET "editalId" = p."editalId"
FROM "ParticipacaoEdital" p
WHERE p.id = c."participacaoEditalId";

ALTER TABLE "AvaliacaoEtapa1" ALTER COLUMN "editalId" SET NOT NULL;
ALTER TABLE "AvaliacaoEtapa2" ALTER COLUMN "editalId" SET NOT NULL;
ALTER TABLE "Recurso" ALTER COLUMN "editalId" SET NOT NULL;
ALTER TABLE "ClassificacaoFinal" ALTER COLUMN "editalId" SET NOT NULL;

ALTER TABLE "AvaliacaoEtapa1" ADD CONSTRAINT "AvaliacaoEtapa1_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvaliacaoEtapa2" ADD CONSTRAINT "AvaliacaoEtapa2_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassificacaoFinal" ADD CONSTRAINT "ClassificacaoFinal_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ParticipacaoEdital_usuarioId_idx" ON "ParticipacaoEdital"("usuarioId");
CREATE INDEX "AvaliacaoEtapa1_editalId_status_idx" ON "AvaliacaoEtapa1"("editalId", "status");
CREATE INDEX "AvaliacaoEtapa2_editalId_status_idx" ON "AvaliacaoEtapa2"("editalId", "status");
CREATE INDEX "Recurso_editalId_fase_status_idx" ON "Recurso"("editalId", "fase", "status");
CREATE INDEX "Recurso_editalId_status_idx" ON "Recurso"("editalId", "status");
CREATE INDEX "ClassificacaoFinal_editalId_status_idx" ON "ClassificacaoFinal"("editalId", "status");
CREATE INDEX "ClassificacaoFinal_status_modalidadeConcorrencia_idx" ON "ClassificacaoFinal"("status", "modalidadeConcorrencia");
