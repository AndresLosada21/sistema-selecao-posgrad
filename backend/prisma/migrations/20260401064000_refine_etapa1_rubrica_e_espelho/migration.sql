-- AlterTable
ALTER TABLE "AvaliacaoEtapa1"
ALTER COLUMN "nota" TYPE DECIMAL(6,3),
ADD COLUMN "rubricaDetalhada" JSONB,
ADD COLUMN "usoIaComprovado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fundamentoUsoIa" TEXT,
ADD COLUMN "espelhoSolicitadoEm" TIMESTAMP(3),
ADD COLUMN "espelhoLiberadoEm" TIMESTAMP(3);
