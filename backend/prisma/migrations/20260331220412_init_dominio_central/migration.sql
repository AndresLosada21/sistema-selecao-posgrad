-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CANDIDATO', 'AVALIADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusConta" AS ENUM ('CRIADA', 'ATIVA', 'BLOQUEADA');

-- CreateEnum
CREATE TYPE "CursoNivel" AS ENUM ('MESTRADO', 'DOUTORADO');

-- CreateEnum
CREATE TYPE "StatusEdital" AS ENUM ('RASCUNHO', 'PUBLICADO', 'EM_ANDAMENTO', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoCronogramaEdital" AS ENUM ('PEDIDO_ISENCAO', 'RECURSO_ISENCAO', 'INSCRICAO', 'HOMOLOGACAO_PRELIMINAR', 'RECURSO_HOMOLOGACAO', 'HOMOLOGACAO_FINAL', 'ETAPA_1', 'RECURSO_ETAPA_1', 'ETAPA_2', 'RECURSO_ETAPA_2', 'CLASSIFICACAO_PRELIMINAR', 'RECURSO_CLASSIFICACAO', 'CLASSIFICACAO_FINAL', 'PUBLICACAO', 'MATRICULA');

-- CreateEnum
CREATE TYPE "ModalidadeConcorrencia" AS ENUM ('AMPLA_CONCORRENCIA', 'ACOES_AFIRMATIVAS', 'PCD');

-- CreateEnum
CREATE TYPE "StatusParticipacaoEdital" AS ENUM ('ATIVA', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "StatusPagamentoInscricao" AS ENUM ('NAO_APLICAVEL', 'PENDENTE', 'PAGO', 'DISPENSADO', 'INVALIDADO');

-- CreateEnum
CREATE TYPE "StatusInscricao" AS ENUM ('RASCUNHO', 'SUBMETIDA', 'EM_ANALISE_DOCUMENTAL', 'HOMOLOGADA_PRELIMINAR', 'NAO_HOMOLOGADA_PRELIMINAR', 'HOMOLOGADA_FINAL', 'NAO_HOMOLOGADA_FINAL', 'APTA_ETAPA_1', 'ELIMINADA_ETAPA_1', 'APTA_ETAPA_2', 'CLASSIFICACAO_PRELIMINAR', 'AGUARDANDO_HETEROIDENTIFICACAO', 'CLASSIFICACAO_FINAL', 'APROVADA', 'LISTA_DE_ESPERA', 'ELIMINADA', 'MATRICULA_PENDENTE', 'MATRICULADA');

-- CreateEnum
CREATE TYPE "TipoDocumentoInscricao" AS ENUM ('DOCUMENTO_IDENTIFICACAO', 'CPF', 'DIPLOMA', 'HISTORICO', 'CURRICULO', 'COMPROVANTE_PAGAMENTO', 'ANEXO_IV', 'COMPROVANTE_AFFIRMATIVA', 'OUTRO');

-- CreateEnum
CREATE TYPE "StatusDocumentoInscricao" AS ENUM ('PENDENTE', 'ENVIADO', 'VALIDADO', 'INVALIDADO');

-- CreateEnum
CREATE TYPE "StatusIsencao" AS ENUM ('NAO_SOLICITADA', 'SOLICITADA', 'EM_ANALISE', 'DEFERIDA_PRELIMINAR', 'INDEFERIDA_PRELIMINAR', 'DEFERIDA_FINAL', 'INDEFERIDA_FINAL');

-- CreateEnum
CREATE TYPE "StatusRecurso" AS ENUM ('ABERTO', 'EM_ANALISE', 'DEFERIDO', 'INDEFERIDO', 'RESPONDIDO');

-- CreateEnum
CREATE TYPE "FaseRecurso" AS ENUM ('ISENCAO', 'HOMOLOGACAO', 'ETAPA_1', 'ETAPA_2', 'CLASSIFICACAO');

-- CreateEnum
CREATE TYPE "StatusAvaliacaoEtapa" AS ENUM ('PENDENTE', 'EM_AVALIACAO', 'PRELIMINAR_PUBLICADA', 'FINAL_PUBLICADA');

-- CreateEnum
CREATE TYPE "StatusClassificacaoFinal" AS ENUM ('PRELIMINAR', 'FINAL', 'APROVADO', 'LISTA_DE_ESPERA', 'ELIMINADO');

-- CreateEnum
CREATE TYPE "TipoPublicacaoOficial" AS ENUM ('EDITAL', 'RETIFICACAO', 'ISENCAO_PRELIMINAR', 'ISENCAO_FINAL', 'HOMOLOGACAO_PRELIMINAR', 'HOMOLOGACAO_FINAL', 'RESULTADO_ETAPA_1', 'RESULTADO_ETAPA_2', 'CLASSIFICACAO_PRELIMINAR', 'CLASSIFICACAO_FINAL', 'COMUNICADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "cpf" TEXT,
    "telefone" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "emailVerificadoEm" TIMESTAMP(3),
    "statusConta" "StatusConta" NOT NULL DEFAULT 'CRIADA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPerfil" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioPerfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edital" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "ano" INTEGER NOT NULL,
    "semestre" INTEGER,
    "cursoNivel" "CursoNivel" NOT NULL,
    "status" "StatusEdital" NOT NULL DEFAULT 'RASCUNHO',
    "publicadoEm" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Edital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronogramaEdital" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "tipo" "TipoCronogramaEdital" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronogramaEdital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinhaPesquisa" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "vagasAmplaConcorrencia" INTEGER NOT NULL DEFAULT 0,
    "vagasAcoesAfirmativas" INTEGER NOT NULL DEFAULT 0,
    "vagasPcd" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinhaPesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipacaoEdital" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "status" "StatusParticipacaoEdital" NOT NULL DEFAULT 'ATIVA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipacaoEdital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoIsencao" (
    "id" TEXT NOT NULL,
    "participacaoEditalId" TEXT NOT NULL,
    "cursoNivel" "CursoNivel" NOT NULL,
    "inscritoCadUnico" BOOLEAN NOT NULL,
    "nis" TEXT,
    "justificativa" TEXT,
    "comprovanteUrl" TEXT,
    "comprovanteNomeArquivo" TEXT,
    "status" "StatusIsencao" NOT NULL DEFAULT 'SOLICITADA',
    "parecerPreliminar" TEXT,
    "parecerFinal" TEXT,
    "resultadoPreliminarEm" TIMESTAMP(3),
    "resultadoFinalEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoIsencao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscricao" (
    "id" TEXT NOT NULL,
    "participacaoEditalId" TEXT NOT NULL,
    "linhaPesquisaId" TEXT,
    "modalidadeConcorrencia" "ModalidadeConcorrencia" NOT NULL DEFAULT 'AMPLA_CONCORRENCIA',
    "status" "StatusInscricao" NOT NULL DEFAULT 'RASCUNHO',
    "statusPagamento" "StatusPagamentoInscricao" NOT NULL DEFAULT 'PENDENTE',
    "resumoCurriculo" TEXT,
    "redacaoTexto" TEXT,
    "anexoIvGeradoUrl" TEXT,
    "assinaturaImagemUrl" TEXT,
    "submetidaEm" TIMESTAMP(3),
    "canceladaSubmissaoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoInscricao" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "tipo" "TipoDocumentoInscricao" NOT NULL,
    "nome" TEXT NOT NULL,
    "urlArquivo" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT,
    "tamanhoBytes" INTEGER,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT true,
    "statusValidacao" "StatusDocumentoInscricao" NOT NULL DEFAULT 'ENVIADO',
    "observacaoValidacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomologacaoInscricao" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "statusPreliminar" "StatusInscricao",
    "parecerPreliminar" TEXT,
    "publicadoPreliminarEm" TIMESTAMP(3),
    "statusFinal" "StatusInscricao",
    "parecerFinal" TEXT,
    "publicadoFinalEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomologacaoInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoEtapa1" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "tema" TEXT,
    "textoSubmetido" TEXT,
    "nota" DECIMAL(5,2),
    "espelhoCorrecao" TEXT,
    "status" "StatusAvaliacaoEtapa" NOT NULL DEFAULT 'PENDENTE',
    "resultadoPreliminarEm" TIMESTAMP(3),
    "resultadoFinalEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoEtapa1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoEtapa2" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "pontuacaoItens" JSONB,
    "pontuacaoBruta" DECIMAL(7,2),
    "notaNormalizada" DECIMAL(5,2),
    "espelhoCorrecao" TEXT,
    "status" "StatusAvaliacaoEtapa" NOT NULL DEFAULT 'PENDENTE',
    "resultadoPreliminarEm" TIMESTAMP(3),
    "resultadoFinalEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoEtapa2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recurso" (
    "id" TEXT NOT NULL,
    "participacaoEditalId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "fase" "FaseRecurso" NOT NULL,
    "status" "StatusRecurso" NOT NULL DEFAULT 'ABERTO',
    "fundamentacao" TEXT NOT NULL,
    "anexoUrl" TEXT,
    "decisao" TEXT,
    "impactoResultado" BOOLEAN NOT NULL DEFAULT false,
    "respondidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificacaoFinal" (
    "id" TEXT NOT NULL,
    "participacaoEditalId" TEXT NOT NULL,
    "linhaPesquisaId" TEXT,
    "modalidadeConcorrencia" "ModalidadeConcorrencia" NOT NULL DEFAULT 'AMPLA_CONCORRENCIA',
    "notaEtapa1" DECIMAL(5,2),
    "notaEtapa2" DECIMAL(5,2),
    "notaFinal" DECIMAL(5,2),
    "posicaoGeral" INTEGER,
    "posicaoLinha" INTEGER,
    "status" "StatusClassificacaoFinal" NOT NULL DEFAULT 'PRELIMINAR',
    "publicadoPreliminarEm" TIMESTAMP(3),
    "publicadoFinalEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassificacaoFinal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicacaoOficial" (
    "id" TEXT NOT NULL,
    "editalId" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "tipo" "TipoPublicacaoOficial" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "versaoFinal" BOOLEAN NOT NULL DEFAULT false,
    "arquivoUrl" TEXT,
    "dadosConsolidados" JSONB,
    "publicadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicacaoOficial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cpf_key" ON "Usuario"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioPerfil_usuarioId_role_key" ON "UsuarioPerfil"("usuarioId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Edital_numero_ano_cursoNivel_key" ON "Edital"("numero", "ano", "cursoNivel");

-- CreateIndex
CREATE INDEX "CronogramaEdital_editalId_tipo_idx" ON "CronogramaEdital"("editalId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "LinhaPesquisa_editalId_nome_key" ON "LinhaPesquisa"("editalId", "nome");

-- CreateIndex
CREATE INDEX "ParticipacaoEdital_editalId_status_idx" ON "ParticipacaoEdital"("editalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipacaoEdital_usuarioId_editalId_key" ON "ParticipacaoEdital"("usuarioId", "editalId");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoIsencao_participacaoEditalId_key" ON "PedidoIsencao"("participacaoEditalId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscricao_participacaoEditalId_key" ON "Inscricao"("participacaoEditalId");

-- CreateIndex
CREATE INDEX "DocumentoInscricao_inscricaoId_tipo_idx" ON "DocumentoInscricao"("inscricaoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "HomologacaoInscricao_inscricaoId_key" ON "HomologacaoInscricao"("inscricaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoEtapa1_inscricaoId_key" ON "AvaliacaoEtapa1"("inscricaoId");

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoEtapa2_inscricaoId_key" ON "AvaliacaoEtapa2"("inscricaoId");

-- CreateIndex
CREATE INDEX "Recurso_participacaoEditalId_fase_status_idx" ON "Recurso"("participacaoEditalId", "fase", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassificacaoFinal_participacaoEditalId_key" ON "ClassificacaoFinal"("participacaoEditalId");

-- CreateIndex
CREATE INDEX "PublicacaoOficial_editalId_tipo_publicadoEm_idx" ON "PublicacaoOficial"("editalId", "tipo", "publicadoEm");

-- AddForeignKey
ALTER TABLE "UsuarioPerfil" ADD CONSTRAINT "UsuarioPerfil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edital" ADD CONSTRAINT "Edital_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CronogramaEdital" ADD CONSTRAINT "CronogramaEdital_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaPesquisa" ADD CONSTRAINT "LinhaPesquisa_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipacaoEdital" ADD CONSTRAINT "ParticipacaoEdital_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipacaoEdital" ADD CONSTRAINT "ParticipacaoEdital_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoIsencao" ADD CONSTRAINT "PedidoIsencao_participacaoEditalId_fkey" FOREIGN KEY ("participacaoEditalId") REFERENCES "ParticipacaoEdital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_participacaoEditalId_fkey" FOREIGN KEY ("participacaoEditalId") REFERENCES "ParticipacaoEdital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_linhaPesquisaId_fkey" FOREIGN KEY ("linhaPesquisaId") REFERENCES "LinhaPesquisa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoInscricao" ADD CONSTRAINT "DocumentoInscricao_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomologacaoInscricao" ADD CONSTRAINT "HomologacaoInscricao_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoEtapa1" ADD CONSTRAINT "AvaliacaoEtapa1_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoEtapa2" ADD CONSTRAINT "AvaliacaoEtapa2_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_participacaoEditalId_fkey" FOREIGN KEY ("participacaoEditalId") REFERENCES "ParticipacaoEdital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recurso" ADD CONSTRAINT "Recurso_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificacaoFinal" ADD CONSTRAINT "ClassificacaoFinal_participacaoEditalId_fkey" FOREIGN KEY ("participacaoEditalId") REFERENCES "ParticipacaoEdital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificacaoFinal" ADD CONSTRAINT "ClassificacaoFinal_linhaPesquisaId_fkey" FOREIGN KEY ("linhaPesquisaId") REFERENCES "LinhaPesquisa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicacaoOficial" ADD CONSTRAINT "PublicacaoOficial_editalId_fkey" FOREIGN KEY ("editalId") REFERENCES "Edital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicacaoOficial" ADD CONSTRAINT "PublicacaoOficial_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
