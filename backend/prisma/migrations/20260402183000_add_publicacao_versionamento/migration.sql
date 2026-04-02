ALTER TABLE "PublicacaoOficial"
ADD COLUMN "republicacaoDeId" TEXT,
ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "editalId", tipo
      ORDER BY COALESCE("publicadoEm", "criadoEm") ASC, "criadoEm" ASC, id ASC
    ) AS versao_ordenada,
    LAG(id) OVER (
      PARTITION BY "editalId", tipo
      ORDER BY COALESCE("publicadoEm", "criadoEm") ASC, "criadoEm" ASC, id ASC
    ) AS republicacao_de_id
  FROM "PublicacaoOficial"
)
UPDATE "PublicacaoOficial" AS p
SET
  "versao" = ordered.versao_ordenada,
  "republicacaoDeId" = ordered.republicacao_de_id
FROM ordered
WHERE ordered.id = p.id;

ALTER TABLE "PublicacaoOficial"
ADD CONSTRAINT "PublicacaoOficial_republicacaoDeId_fkey"
FOREIGN KEY ("republicacaoDeId") REFERENCES "PublicacaoOficial"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PublicacaoOficial_editalId_tipo_versao_key"
ON "PublicacaoOficial"("editalId", "tipo", "versao");

CREATE INDEX "PublicacaoOficial_republicacaoDeId_idx"
ON "PublicacaoOficial"("republicacaoDeId");
