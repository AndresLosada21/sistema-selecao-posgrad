CREATE TABLE "TituloInscricao" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "criterioTitulacaoEditalId" TEXT NOT NULL,
    "descricaoTitulo" TEXT NOT NULL,
    "urlArquivo" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TituloInscricao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TituloInscricao_inscricaoId_criterioTitulacaoEditalId_idx" ON "TituloInscricao"("inscricaoId", "criterioTitulacaoEditalId");

CREATE INDEX "TituloInscricao_criterioTitulacaoEditalId_idx" ON "TituloInscricao"("criterioTitulacaoEditalId");

ALTER TABLE "TituloInscricao" ADD CONSTRAINT "TituloInscricao_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TituloInscricao" ADD CONSTRAINT "TituloInscricao_criterioTitulacaoEditalId_fkey" FOREIGN KEY ("criterioTitulacaoEditalId") REFERENCES "CriterioTitulacaoEdital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
