-- AlterTable
ALTER TABLE "Inscricao"
ADD COLUMN "pacoteDocumentalUrl" TEXT,
ADD COLUMN "pacoteDocumentalNomeArquivo" TEXT,
ADD COLUMN "pacoteDocumentalMimeType" TEXT,
ADD COLUMN "pacoteDocumentalTamanhoBytes" INTEGER,
ADD COLUMN "pacoteDocumentalSnapshot" JSONB,
ADD COLUMN "pacoteDocumentalVersaoSubmissao" INTEGER,
ADD COLUMN "pacoteDocumentalGeradoEm" TIMESTAMP(3),
ADD COLUMN "pacoteDocumentalGeradoPorId" TEXT;
