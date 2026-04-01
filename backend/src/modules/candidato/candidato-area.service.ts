import { prisma } from "../../lib/prisma.js";
import { buildCandidateAnexoIvUrl } from "../inscricao/inscricao-anexo-iv.service.js";

function toIsoOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function getCandidateDashboard(usuarioId: string) {
  const participacoes = await prisma.participacaoEdital.findMany({
    where: {
      usuarioId,
    },
    include: {
      edital: {
        include: {
          cronogramas: true,
        },
      },
      pedidoIsencao: true,
      inscricao: {
        include: {
          linhaPesquisa: true,
          documentos: true,
          homologacao: true,
          avaliacaoEtapa1: true,
          avaliacaoEtapa2: true,
        },
      },
      classificacaoFinal: true,
      recursos: {
        orderBy: {
          criadoEm: "desc",
        },
      },
    },
    orderBy: {
      criadoEm: "desc",
    },
  });

  return participacoes.map((participacao) => ({
    id: participacao.id,
    statusParticipacao: participacao.status,
    edital: {
      id: participacao.edital.id,
      numero: participacao.edital.numero,
      titulo: participacao.edital.titulo,
      descricao: participacao.edital.descricao,
      cursoNivel: participacao.edital.cursoNivel,
      status: participacao.edital.status,
      publicadoEm: toIsoOrNull(participacao.edital.publicadoEm),
      cronogramas: participacao.edital.cronogramas
        .sort((a, b) => a.inicioEm.getTime() - b.inicioEm.getTime())
        .map((cronograma) => ({
          tipo: cronograma.tipo,
          titulo: cronograma.titulo,
          inicioEm: cronograma.inicioEm.toISOString(),
          fimEm: cronograma.fimEm.toISOString(),
        })),
    },
    isencao: participacao.pedidoIsencao
      ? {
          id: participacao.pedidoIsencao.id,
          status: participacao.pedidoIsencao.status,
          cursoNivel: participacao.pedidoIsencao.cursoNivel,
          inscritoCadUnico: participacao.pedidoIsencao.inscritoCadUnico,
          nis: participacao.pedidoIsencao.nis,
          justificativa: participacao.pedidoIsencao.justificativa,
          comprovanteUrl: participacao.pedidoIsencao.comprovanteUrl,
          comprovanteNomeArquivo: participacao.pedidoIsencao.comprovanteNomeArquivo,
          parecerPreliminar: participacao.pedidoIsencao.parecerPreliminar,
          parecerFinal: participacao.pedidoIsencao.parecerFinal,
          resultadoPreliminarEm: toIsoOrNull(participacao.pedidoIsencao.resultadoPreliminarEm),
          resultadoFinalEm: toIsoOrNull(participacao.pedidoIsencao.resultadoFinalEm),
        }
      : null,
    inscricao: participacao.inscricao
      ? {
          id: participacao.inscricao.id,
          status: participacao.inscricao.status,
          statusPagamento: participacao.inscricao.statusPagamento,
          linhaPesquisa: participacao.inscricao.linhaPesquisa
            ? {
                id: participacao.inscricao.linhaPesquisa.id,
                nome: participacao.inscricao.linhaPesquisa.nome,
              }
            : null,
          temaRedacao: participacao.inscricao.temaRedacao,
          resumoCurriculo: participacao.inscricao.resumoCurriculo,
          redacaoTexto: participacao.inscricao.redacaoTexto,
          dadosFormulario: participacao.inscricao.dadosFormulario,
          anexoIvGeradoUrl: participacao.inscricao.anexoIvGeradoUrl ?? buildCandidateAnexoIvUrl(participacao.inscricao.id),
          assinaturaImagemUrl: participacao.inscricao.assinaturaImagemUrl,
          submissaoSnapshot: participacao.inscricao.submissaoSnapshot,
          versaoSubmissao: participacao.inscricao.versaoSubmissao,
          submetidaEm: toIsoOrNull(participacao.inscricao.submetidaEm),
          canceladaSubmissaoEm: toIsoOrNull(participacao.inscricao.canceladaSubmissaoEm),
          documentos: participacao.inscricao.documentos.map((documento) => ({
            id: documento.id,
            tipo: documento.tipo,
            nome: documento.nome,
            nomeArquivo: documento.nomeArquivo,
            urlArquivo: documento.urlArquivo,
            statusValidacao: documento.statusValidacao,
            observacaoValidacao: documento.observacaoValidacao,
          })),
          homologacao: participacao.inscricao.homologacao
            ? {
                statusPreliminar: participacao.inscricao.homologacao.statusPreliminar,
                parecerPreliminar: participacao.inscricao.homologacao.parecerPreliminar,
                publicadoPreliminarEm: toIsoOrNull(participacao.inscricao.homologacao.publicadoPreliminarEm),
                statusFinal: participacao.inscricao.homologacao.statusFinal,
                parecerFinal: participacao.inscricao.homologacao.parecerFinal,
                publicadoFinalEm: toIsoOrNull(participacao.inscricao.homologacao.publicadoFinalEm),
              }
            : null,
          etapa1: participacao.inscricao.avaliacaoEtapa1
            ? {
                tema: participacao.inscricao.avaliacaoEtapa1.tema,
                nota: participacao.inscricao.avaliacaoEtapa1.nota?.toNumber() ?? null,
                espelhoCorrecao: participacao.inscricao.avaliacaoEtapa1.espelhoCorrecao,
                status: participacao.inscricao.avaliacaoEtapa1.status,
                resultadoPreliminarEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa1.resultadoPreliminarEm),
                resultadoFinalEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa1.resultadoFinalEm),
              }
            : null,
          etapa2: participacao.inscricao.avaliacaoEtapa2
            ? {
                pontuacaoItens: participacao.inscricao.avaliacaoEtapa2.pontuacaoItens,
                pontuacaoBruta: participacao.inscricao.avaliacaoEtapa2.pontuacaoBruta?.toNumber() ?? null,
                notaNormalizada: participacao.inscricao.avaliacaoEtapa2.notaNormalizada?.toNumber() ?? null,
                espelhoCorrecao: participacao.inscricao.avaliacaoEtapa2.espelhoCorrecao,
                status: participacao.inscricao.avaliacaoEtapa2.status,
                resultadoPreliminarEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa2.resultadoPreliminarEm),
                resultadoFinalEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa2.resultadoFinalEm),
              }
            : null,
        }
      : null,
    classificacao: participacao.classificacaoFinal
      ? {
          id: participacao.classificacaoFinal.id,
          status: participacao.classificacaoFinal.status,
          notaEtapa1: participacao.classificacaoFinal.notaEtapa1?.toNumber() ?? null,
          notaEtapa2: participacao.classificacaoFinal.notaEtapa2?.toNumber() ?? null,
          notaFinal: participacao.classificacaoFinal.notaFinal?.toNumber() ?? null,
          posicaoGeral: participacao.classificacaoFinal.posicaoGeral,
          posicaoLinha: participacao.classificacaoFinal.posicaoLinha,
          publicadoPreliminarEm: toIsoOrNull(participacao.classificacaoFinal.publicadoPreliminarEm),
          publicadoFinalEm: toIsoOrNull(participacao.classificacaoFinal.publicadoFinalEm),
        }
      : null,
    recursos: participacao.recursos.map((recurso) => ({
      id: recurso.id,
      fase: recurso.fase,
      status: recurso.status,
      fundamentacao: recurso.fundamentacao,
      anexoUrl: recurso.anexoUrl,
      decisao: recurso.decisao,
      impactoResultado: recurso.impactoResultado,
      criadoEm: recurso.criadoEm.toISOString(),
      respondidoEm: toIsoOrNull(recurso.respondidoEm),
    })),
  }));
}
