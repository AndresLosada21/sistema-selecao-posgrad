-- DropIndex
DROP INDEX "PublicacaoOficial_republicacaoDeId_idx";

-- CreateTable
CREATE TABLE "AvaliadorEscopo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "linhaPesquisaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliadorEscopo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaEvento" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "acao" TEXT NOT NULL,
    "descricao" TEXT,
    "payload" JSONB,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvaliadorEscopo_usuarioId_editalId_idx" ON "AvaliadorEscopo"("usuarioId", "editalId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliadorEscopo_usuarioId_editalId_linhaPesquisaId_key" ON "AvaliadorEscopo"("usuarioId", "editalId", "linhaPesquisaId");

-- CreateIndex
CREATE INDEX "AuditoriaEvento_entidade_entidadeId_criadoEm_idx" ON "AuditoriaEvento"("entidade", "entidadeId", "criadoEm");

-- CreateIndex
CREATE INDEX "AuditoriaEvento_criadoPorId_criadoEm_idx" ON "AuditoriaEvento"("criadoPorId", "criadoEm");

-- AddForeignKey
ALTER TABLE "AvaliadorEscopo" ADD CONSTRAINT "AvaliadorEscopo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliadorEscopo" ADD CONSTRAINT "AvaliadorEscopo_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliadorEscopo" ADD CONSTRAINT "AvaliadorEscopo_linhaPesquisaId_fkey" FOREIGN KEY ("linhaPesquisaId") REFERENCES "LinhaPesquisa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaEvento" ADD CONSTRAINT "AuditoriaEvento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
