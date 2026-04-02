CREATE TYPE "TipoEtapaPoliticasAfirmativas" AS ENUM ('HETEROIDENTIFICACAO', 'PCD');
CREATE TYPE "StatusOperacaoPoliticasAfirmativas" AS ENUM ('PENDENTE', 'CONVOCADO', 'DOCUMENTOS_ENCAMINHADOS', 'RESULTADO_PRELIMINAR_REGISTRADO', 'RESULTADO_FINAL_REGISTRADO');
CREATE TYPE "ResultadoPoliticasAfirmativas" AS ENUM ('PENDENTE', 'CONFIRMADO', 'NAO_CONFIRMADO', 'AUSENTE');

ALTER TYPE "TipoCronogramaEdital" ADD VALUE IF NOT EXISTS 'RECURSO_HETEROIDENTIFICACAO';
ALTER TYPE "FaseRecurso" ADD VALUE IF NOT EXISTS 'POLITICAS_AFIRMATIVAS';
ALTER TYPE "TipoPublicacaoOficial" ADD VALUE IF NOT EXISTS 'POLITICAS_AFIRMATIVAS_PRELIMINAR';
ALTER TYPE "TipoPublicacaoOficial" ADD VALUE IF NOT EXISTS 'POLITICAS_AFIRMATIVAS_FINAL';

CREATE TABLE "EtapaPoliticasAfirmativas" (
  "id" TEXT NOT NULL,
  "inscricaoId" TEXT NOT NULL,
  "tipo" "TipoEtapaPoliticasAfirmativas" NOT NULL,
  "statusOperacao" "StatusOperacaoPoliticasAfirmativas" NOT NULL DEFAULT 'PENDENTE',
  "convocadoEm" TIMESTAMP(3),
  "documentosEncaminhadosEm" TIMESTAMP(3),
  "protocoloEncaminhamento" TEXT,
  "observacaoEncaminhamento" TEXT,
  "encaminhadoPorId" TEXT,
  "resultadoPreliminar" "ResultadoPoliticasAfirmativas" NOT NULL DEFAULT 'PENDENTE',
  "parecerPreliminar" TEXT,
  "arquivoRetornoPreliminarUrl" TEXT,
  "resultadoPreliminarEm" TIMESTAMP(3),
  "resultadoPreliminarRegistradoPorId" TEXT,
  "resultadoFinal" "ResultadoPoliticasAfirmativas" NOT NULL DEFAULT 'PENDENTE',
  "parecerFinal" TEXT,
  "arquivoRetornoFinalUrl" TEXT,
  "resultadoFinalEm" TIMESTAMP(3),
  "resultadoFinalRegistradoPorId" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EtapaPoliticasAfirmativas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EtapaPoliticasAfirmativas_inscricaoId_key" ON "EtapaPoliticasAfirmativas"("inscricaoId");
CREATE INDEX "EtapaPoliticasAfirmativas_tipo_statusOperacao_idx" ON "EtapaPoliticasAfirmativas"("tipo", "statusOperacao");

ALTER TABLE "EtapaPoliticasAfirmativas"
ADD CONSTRAINT "EtapaPoliticasAfirmativas_inscricaoId_fkey"
FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "EtapaPoliticasAfirmativas" (
  "id",
  "inscricaoId",
  "tipo",
  "statusOperacao",
  "resultadoFinal",
  "criadoEm",
  "atualizadoEm"
)
SELECT
  concat('epa_', md5(random()::text || clock_timestamp()::text || i."id")),
  i."id",
  CASE
    WHEN i."modalidadeConcorrencia" = 'ACOES_AFIRMATIVAS' THEN 'HETEROIDENTIFICACAO'::"TipoEtapaPoliticasAfirmativas"
    WHEN i."modalidadeConcorrencia" = 'PCD' THEN 'PCD'::"TipoEtapaPoliticasAfirmativas"
  END,
  CASE
    WHEN i."confirmacaoAcoesAfirmativas" = 'CONFIRMADA' OR i."confirmacaoPcd" = 'CONFIRMADA' OR i."confirmacaoAcoesAfirmativas" = 'NAO_CONFIRMADA' OR i."confirmacaoPcd" = 'NAO_CONFIRMADA' OR i."confirmacaoAcoesAfirmativas" = 'AUSENTE' OR i."confirmacaoPcd" = 'AUSENTE'
      THEN 'RESULTADO_FINAL_REGISTRADO'::"StatusOperacaoPoliticasAfirmativas"
    ELSE 'PENDENTE'::"StatusOperacaoPoliticasAfirmativas"
  END,
  CASE
    WHEN i."confirmacaoAcoesAfirmativas" = 'CONFIRMADA' OR i."confirmacaoPcd" = 'CONFIRMADA' THEN 'CONFIRMADO'::"ResultadoPoliticasAfirmativas"
    WHEN i."confirmacaoAcoesAfirmativas" = 'NAO_CONFIRMADA' OR i."confirmacaoPcd" = 'NAO_CONFIRMADA' THEN 'NAO_CONFIRMADO'::"ResultadoPoliticasAfirmativas"
    WHEN i."confirmacaoAcoesAfirmativas" = 'AUSENTE' OR i."confirmacaoPcd" = 'AUSENTE' THEN 'AUSENTE'::"ResultadoPoliticasAfirmativas"
    ELSE 'PENDENTE'::"ResultadoPoliticasAfirmativas"
  END,
  NOW(),
  NOW()
FROM "Inscricao" i
WHERE i."modalidadeConcorrencia" IN ('ACOES_AFIRMATIVAS', 'PCD');
