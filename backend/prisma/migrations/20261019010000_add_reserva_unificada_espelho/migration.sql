-- AlterEnum
ALTER TYPE "TipoCronogramaEdital" ADD VALUE 'ESPELHO_ETAPA_1';
ALTER TYPE "TipoCronogramaEdital" ADD VALUE 'ESPELHO_ETAPA_2';

-- AlterTable
ALTER TABLE "ConfiguracaoProcessoEdital" ADD COLUMN     "unificarReservasAcoesAfirmativasPcd" BOOLEAN NOT NULL DEFAULT false;
