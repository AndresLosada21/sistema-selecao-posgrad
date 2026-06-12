-- CreateTable
CREATE TABLE "CriterioTitulacaoEdital" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "chaveInterna" TEXT NOT NULL,
    "numeroNormativo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "fator" DECIMAL(8,3),
    "teto" DECIMAL(8,2),
    "unidade" TEXT NOT NULL,
    "regraEspecial" TEXT,
    "metadados" JSONB,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pacoteOrigemSlug" TEXT,
    "pacoteOrigemVersao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriterioTitulacaoEdital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CriterioTitulacaoEdital_editalId_chaveInterna_key" ON "CriterioTitulacaoEdital"("editalId", "chaveInterna");

-- CreateIndex
CREATE INDEX "CriterioTitulacaoEdital_editalId_ativo_ordem_idx" ON "CriterioTitulacaoEdital"("editalId", "ativo", "ordem");

-- CreateIndex
CREATE INDEX "CriterioTitulacaoEdital_editalId_numeroNormativo_idx" ON "CriterioTitulacaoEdital"("editalId", "numeroNormativo");

-- AddForeignKey
ALTER TABLE "CriterioTitulacaoEdital"
ADD CONSTRAINT "CriterioTitulacaoEdital_editalId_fkey"
FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
