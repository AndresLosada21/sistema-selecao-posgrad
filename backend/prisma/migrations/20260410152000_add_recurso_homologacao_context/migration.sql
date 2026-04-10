-- CreateEnum
CREATE TYPE "FaseHomologacaoRecurso" AS ENUM ('PRELIMINAR', 'FINAL');

-- AlterTable
ALTER TABLE "Recurso"
ADD COLUMN "faseHomologacaoReferencia" "FaseHomologacaoRecurso";
