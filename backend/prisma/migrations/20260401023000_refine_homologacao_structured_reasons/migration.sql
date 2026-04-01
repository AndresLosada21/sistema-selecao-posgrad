-- AlterTable
ALTER TABLE "HomologacaoInscricao"
ADD COLUMN "motivosPreliminar" JSONB,
ADD COLUMN "submissaoSnapshotPreliminar" JSONB,
ADD COLUMN "versaoSubmissaoPreliminar" INTEGER,
ADD COLUMN "motivosFinal" JSONB,
ADD COLUMN "submissaoSnapshotFinal" JSONB,
ADD COLUMN "versaoSubmissaoFinal" INTEGER;
