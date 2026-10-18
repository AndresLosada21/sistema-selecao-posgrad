-- CreateEnum
CREATE TYPE "ModalidadeEtapa1" AS ENUM ('REDACAO', 'PRE_PROJETO');

-- CreateEnum
CREATE TYPE "DesempateClassificacao" AS ENUM ('ETAPA1_ETAPA2_IDADE', 'ETAPA1_IDADE');

-- AlterEnum
ALTER TYPE "TipoDocumentoInscricao" ADD VALUE 'PRE_PROJETO';

-- AlterTable
ALTER TABLE "Inscricao" ADD COLUMN     "grupoPesquisaId" TEXT;

-- CreateTable
CREATE TABLE "ConfiguracaoProcessoEdital" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "modalidadeEtapa1" "ModalidadeEtapa1" NOT NULL DEFAULT 'REDACAO',
    "pesoEtapa1" INTEGER NOT NULL DEFAULT 1,
    "pesoEtapa2" INTEGER NOT NULL DEFAULT 2,
    "notaMinimaEtapa1" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "desempate" "DesempateClassificacao" NOT NULL DEFAULT 'ETAPA1_ETAPA2_IDADE',
    "avaliadoresEtapa1" INTEGER NOT NULL DEFAULT 1,
    "exigeDiplomaGraduacao" BOOLEAN NOT NULL DEFAULT true,
    "exigeHistoricoGraduacao" BOOLEAN NOT NULL DEFAULT true,
    "exigeGrupoPesquisa" BOOLEAN NOT NULL DEFAULT false,
    "permiteCancelarSubmissao" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoProcessoEdital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriterioAvaliacaoEtapa1Edital" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "chaveInterna" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "peso" INTEGER NOT NULL,
    "notaMaxima" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriterioAvaliacaoEtapa1Edital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoPesquisa" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrupoPesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoEtapa1Avaliador" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "avaliadorUsuarioId" TEXT NOT NULL,
    "nota" DECIMAL(6,3) NOT NULL,
    "rubricaDetalhada" JSONB,
    "espelhoCorrecao" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoEtapa1Avaliador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracaoProcessoEdital_editalId_key" ON "ConfiguracaoProcessoEdital"("editalId");

-- CreateIndex
CREATE INDEX "CriterioAvaliacaoEtapa1Edital_editalId_ativo_ordem_idx" ON "CriterioAvaliacaoEtapa1Edital"("editalId", "ativo", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "CriterioAvaliacaoEtapa1Edital_editalId_chaveInterna_key" ON "CriterioAvaliacaoEtapa1Edital"("editalId", "chaveInterna");

-- CreateIndex
CREATE INDEX "GrupoPesquisa_editalId_ativo_idx" ON "GrupoPesquisa"("editalId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "GrupoPesquisa_editalId_nome_key" ON "GrupoPesquisa"("editalId", "nome");

-- CreateIndex
CREATE INDEX "AvaliacaoEtapa1Avaliador_editalId_avaliadorUsuarioId_idx" ON "AvaliacaoEtapa1Avaliador"("editalId", "avaliadorUsuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoEtapa1Avaliador_inscricaoId_avaliadorUsuarioId_key" ON "AvaliacaoEtapa1Avaliador"("inscricaoId", "avaliadorUsuarioId");

-- AddForeignKey
ALTER TABLE "ConfiguracaoProcessoEdital" ADD CONSTRAINT "ConfiguracaoProcessoEdital_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterioAvaliacaoEtapa1Edital" ADD CONSTRAINT "CriterioAvaliacaoEtapa1Edital_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoPesquisa" ADD CONSTRAINT "GrupoPesquisa_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_grupoPesquisaId_fkey" FOREIGN KEY ("grupoPesquisaId") REFERENCES "GrupoPesquisa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoEtapa1Avaliador" ADD CONSTRAINT "AvaliacaoEtapa1Avaliador_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoEtapa1Avaliador" ADD CONSTRAINT "AvaliacaoEtapa1Avaliador_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoEtapa1Avaliador" ADD CONSTRAINT "AvaliacaoEtapa1Avaliador_avaliadorUsuarioId_fkey" FOREIGN KEY ("avaliadorUsuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Recurso_participacaoEditalId_fase_tipoPoliticasAfirmati_idx" RENAME TO "Recurso_participacaoEditalId_fase_tipoPoliticasAfirmativasR_idx";

-- Backfill: todo edital existente passa a ter o perfil legado (mestrado) explicito.
INSERT INTO "ConfiguracaoProcessoEdital" (
    "id", "editalId", "modalidadeEtapa1", "pesoEtapa1", "pesoEtapa2", "notaMinimaEtapa1",
    "desempate", "avaliadoresEtapa1", "exigeDiplomaGraduacao", "exigeHistoricoGraduacao",
    "exigeGrupoPesquisa", "permiteCancelarSubmissao", "criadoEm", "atualizadoEm"
)
SELECT
    'cfg_' || e."id", e."id", 'REDACAO', 1, 2, 7,
    'ETAPA1_ETAPA2_IDADE', 1, true, true,
    false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Edital" e
ON CONFLICT ("editalId") DO NOTHING;

-- Backfill: editais sem rubrica recebem os cinco criterios legados da redacao.
INSERT INTO "CriterioAvaliacaoEtapa1Edital" (
    "id", "editalId", "chaveInterna", "label", "peso", "notaMaxima", "ordem", "ativo", "criadoEm", "atualizadoEm"
)
SELECT
    'crit_' || e."id" || '_' || c."chaveInterna", e."id", c."chaveInterna", c."label", c."peso", 10, c."ordem", true,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Edital" e
CROSS JOIN (VALUES
    ('adequacaoDominioTema', 'Adequação e domínio do tema', 50, 0),
    ('estrutura', 'Estrutura', 10, 1),
    ('organizacaoCoerencia', 'Organização textual e coerência', 15, 2),
    ('objetividadeSintese', 'Objetividade e capacidade de síntese', 15, 3),
    ('grafiaGramatica', 'Grafia, acentuação e gramática', 10, 4)
) AS c("chaveInterna", "label", "peso", "ordem")
WHERE NOT EXISTS (
    SELECT 1 FROM "CriterioAvaliacaoEtapa1Edital" existente WHERE existente."editalId" = e."id"
)
ON CONFLICT ("editalId", "chaveInterna") DO NOTHING;

