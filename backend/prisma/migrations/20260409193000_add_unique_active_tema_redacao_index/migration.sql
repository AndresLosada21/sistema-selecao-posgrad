CREATE UNIQUE INDEX "TemaRedacaoEdital_unique_active_title_per_edital"
ON "TemaRedacaoEdital" ("editalId", (LOWER(BTRIM("titulo"))))
WHERE "ativo" = true;
