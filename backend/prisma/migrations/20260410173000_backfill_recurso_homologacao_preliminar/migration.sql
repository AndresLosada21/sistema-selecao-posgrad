UPDATE "Recurso"
SET "faseHomologacaoReferencia" = 'PRELIMINAR'::"FaseHomologacaoRecurso"
WHERE "fase" = 'HOMOLOGACAO'
  AND "faseHomologacaoReferencia" IS NULL;
