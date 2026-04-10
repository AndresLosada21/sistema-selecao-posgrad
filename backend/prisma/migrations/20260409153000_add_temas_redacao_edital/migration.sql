-- CreateTable
CREATE TABLE "TemaRedacaoEdital" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemaRedacaoEdital_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Inscricao"
ADD COLUMN "temaRedacaoEditalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TemaRedacaoEdital_editalId_titulo_key" ON "TemaRedacaoEdital"("editalId", "titulo");

-- CreateIndex
CREATE INDEX "TemaRedacaoEdital_editalId_ativo_ordem_idx" ON "TemaRedacaoEdital"("editalId", "ativo", "ordem");

-- AddForeignKey
ALTER TABLE "TemaRedacaoEdital"
ADD CONSTRAINT "TemaRedacaoEdital_editalId_fkey"
FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao"
ADD CONSTRAINT "Inscricao_temaRedacaoEditalId_fkey"
FOREIGN KEY ("temaRedacaoEditalId") REFERENCES "TemaRedacaoEdital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
