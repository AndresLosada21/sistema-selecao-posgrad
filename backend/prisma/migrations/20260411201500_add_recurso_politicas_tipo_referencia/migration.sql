ALTER TABLE "Recurso"
ADD COLUMN "tipoPoliticasAfirmativasReferencia" "TipoEtapaPoliticasAfirmativas";

DROP INDEX "Recurso_participacaoEditalId_fase_status_idx";

CREATE INDEX "Recurso_participacaoEditalId_fase_tipoPoliticasAfirmati_idx"
ON "Recurso"("participacaoEditalId", "fase", "tipoPoliticasAfirmativasReferencia", "status");
