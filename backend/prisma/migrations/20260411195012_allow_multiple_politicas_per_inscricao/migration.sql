DROP INDEX "EtapaPoliticasAfirmativas_inscricaoId_key";

CREATE UNIQUE INDEX "EtapaPoliticasAfirmativas_inscricaoId_tipo_key"
ON "EtapaPoliticasAfirmativas"("inscricaoId", "tipo");

CREATE INDEX "EtapaPoliticasAfirmativas_inscricaoId_idx"
ON "EtapaPoliticasAfirmativas"("inscricaoId");
