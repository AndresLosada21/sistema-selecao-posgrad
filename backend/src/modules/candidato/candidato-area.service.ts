import { prisma } from "../../lib/prisma.js";
import { toIsoOrNull } from "../../lib/serialization.js";
import { buildCandidateAnexoIvUrl } from "../inscricao/inscricao-anexo-iv.service.js";
import { parseHomologacaoMotivos } from "../homologacao/homologacao.rules.js";
import { buildPoliticasAfirmativasResumo } from "../politicas-afirmativas/politicas-afirmativas.service.js";

function resolvePublicacaoArquivoUrl(publicacao: {
  id: string;
  arquivoUrl: string | null;
}) {
  return publicacao.arquivoUrl ?? `/v1/publicacoes/${publicacao.id}/arquivo.pdf`;
}

type PublicacaoDashboardRecord = {
  id: string;
  editalId: string;
  republicacaoDeId: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  versao: number;
  versaoFinal: boolean;
  arquivoUrl: string | null;
  publicadoEm: Date | null;
};

function getPublicacoesDashboard(records: Array<{
  id: string;
  editalId: string;
  republicacaoDeId: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  versao: number;
  versaoFinal: boolean;
  arquivoUrl: string | null;
  publicadoEm: Date | null;
}>) {
  return records.map((item) => ({ ...item } satisfies PublicacaoDashboardRecord));
}

function buildPublicacaoResumo(publicacao: PublicacaoDashboardRecord) {
  return {
    id: publicacao.id,
    editalId: publicacao.editalId,
    republicacaoDeId: publicacao.republicacaoDeId,
    tipo: publicacao.tipo,
    titulo: publicacao.titulo,
    descricao: publicacao.descricao,
    versao: publicacao.versao,
    versaoFinal: publicacao.versaoFinal,
    arquivoUrl: resolvePublicacaoArquivoUrl(publicacao),
    publicadoEm: toIsoOrNull(publicacao.publicadoEm),
  };
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
          publicacoesOficiais: {
            orderBy: [{ publicadoEm: "desc" }, { criadoEm: "desc" }],
          },
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
          etapaPoliticasAfirmativas: true,
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
    ...(function () {
      const publicacoesOficiais = getPublicacoesDashboard(participacao.edital.publicacoesOficiais);
      const latestPublicacoesByTipo = new Map<string, PublicacaoDashboardRecord>();

      for (const publicacao of publicacoesOficiais) {
        const current = latestPublicacoesByTipo.get(publicacao.tipo);

        if (!current || publicacao.versao > current.versao) {
          latestPublicacoesByTipo.set(publicacao.tipo, publicacao);
        }
      }

      return {
        publicacoesDestaque: Array.from(latestPublicacoesByTipo.values()).map(buildPublicacaoResumo),
      };
    })(),
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
          id: cronograma.id,
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
          pacoteDocumental: participacao.inscricao.pacoteDocumentalUrl
            ? {
                urlArquivo: participacao.inscricao.pacoteDocumentalUrl,
                nomeArquivo: participacao.inscricao.pacoteDocumentalNomeArquivo,
                mimeType: participacao.inscricao.pacoteDocumentalMimeType,
                tamanhoBytes: participacao.inscricao.pacoteDocumentalTamanhoBytes,
                versaoSubmissao: participacao.inscricao.pacoteDocumentalVersaoSubmissao,
                geradoEm: toIsoOrNull(participacao.inscricao.pacoteDocumentalGeradoEm),
                geradoPorId: participacao.inscricao.pacoteDocumentalGeradoPorId,
              }
            : null,
          id: participacao.inscricao.id,
          status: participacao.inscricao.status,
          statusPagamento: participacao.inscricao.statusPagamento,
          modalidadeConcorrencia: participacao.inscricao.modalidadeConcorrencia,
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
                  motivosPreliminar: parseHomologacaoMotivos(participacao.inscricao.homologacao.motivosPreliminar),
                  parecerPreliminar: participacao.inscricao.homologacao.parecerPreliminar,
                  publicadoPreliminarEm: toIsoOrNull(participacao.inscricao.homologacao.publicadoPreliminarEm),
                  statusFinal: participacao.inscricao.homologacao.statusFinal,
                  motivosFinal: parseHomologacaoMotivos(participacao.inscricao.homologacao.motivosFinal),
                  parecerFinal: participacao.inscricao.homologacao.parecerFinal,
                  publicadoFinalEm: toIsoOrNull(participacao.inscricao.homologacao.publicadoFinalEm),
                }
            : null,
          etapa1: participacao.inscricao.avaliacaoEtapa1
            ? {
                tema: participacao.inscricao.avaliacaoEtapa1.tema,
                nota: participacao.inscricao.avaliacaoEtapa1.nota?.toNumber() ?? null,
                espelhoDisponivel: Boolean(participacao.inscricao.avaliacaoEtapa1.espelhoLiberadoEm),
                espelhoCorrecao: participacao.inscricao.avaliacaoEtapa1.espelhoLiberadoEm
                  ? participacao.inscricao.avaliacaoEtapa1.espelhoCorrecao
                  : null,
                rubricaDetalhada: participacao.inscricao.avaliacaoEtapa1.espelhoLiberadoEm
                  ? participacao.inscricao.avaliacaoEtapa1.rubricaDetalhada
                  : null,
                usoIaComprovado: participacao.inscricao.avaliacaoEtapa1.usoIaComprovado,
                fundamentoUsoIa: participacao.inscricao.avaliacaoEtapa1.fundamentoUsoIa,
                espelhoSolicitadoEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa1.espelhoSolicitadoEm),
                espelhoLiberadoEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa1.espelhoLiberadoEm),
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
                memoriaCalculo: participacao.inscricao.avaliacaoEtapa2.memoriaCalculo,
                glosas: participacao.inscricao.avaliacaoEtapa2.glosas,
                espelhoDisponivel: Boolean(participacao.inscricao.avaliacaoEtapa2.espelhoLiberadoEm),
                espelhoCorrecao: participacao.inscricao.avaliacaoEtapa2.espelhoLiberadoEm
                  ? participacao.inscricao.avaliacaoEtapa2.espelhoCorrecao
                  : null,
                espelhoSolicitadoEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa2.espelhoSolicitadoEm),
                espelhoLiberadoEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa2.espelhoLiberadoEm),
                status: participacao.inscricao.avaliacaoEtapa2.status,
                resultadoPreliminarEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa2.resultadoPreliminarEm),
                resultadoFinalEm: toIsoOrNull(participacao.inscricao.avaliacaoEtapa2.resultadoFinalEm),
              }
            : null,
          politicasAfirmativas: participacao.inscricao.etapaPoliticasAfirmativas
            ? buildPoliticasAfirmativasResumo(participacao.inscricao.etapaPoliticasAfirmativas)
            : null,
        }
      : null,
    classificacao: participacao.classificacaoFinal
        ? {
            id: participacao.classificacaoFinal.id,
            status: participacao.classificacaoFinal.status,
            modalidadeConcorrencia: participacao.classificacaoFinal.modalidadeConcorrencia,
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
    publicacoes: [...getPublicacoesDashboard(participacao.edital.publicacoesOficiais)]
      .sort((a, b) => {
        if (a.tipo !== b.tipo) {
          return a.tipo.localeCompare(b.tipo);
        }

        return b.versao - a.versao;
      })
      .map(buildPublicacaoResumo),
  }));
}
