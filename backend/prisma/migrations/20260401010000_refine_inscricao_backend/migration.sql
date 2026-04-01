-- AlterEnum
ALTER TYPE "TipoDocumentoInscricao" ADD VALUE IF NOT EXISTS 'RNE_PASSAPORTE';

-- AlterEnum
ALTER TYPE "TipoDocumentoInscricao" ADD VALUE IF NOT EXISTS 'ANEXO_V';

-- AlterEnum
ALTER TYPE "TipoDocumentoInscricao" ADD VALUE IF NOT EXISTS 'LAUDO_PCD';

-- AlterEnum
ALTER TYPE "TipoDocumentoInscricao" ADD VALUE IF NOT EXISTS 'ANEXO_VIII_AUTODECLARACAO';

-- AlterEnum
ALTER TYPE "TipoDocumentoInscricao" ADD VALUE IF NOT EXISTS 'COMPROVANTE_ETNICO';

-- AlterTable
ALTER TABLE "Inscricao"
ADD COLUMN "temaRedacao" TEXT,
ADD COLUMN "dadosFormulario" JSONB,
ADD COLUMN "submissaoSnapshot" JSONB,
ADD COLUMN "versaoSubmissao" INTEGER NOT NULL DEFAULT 0;
