import { FaseHomologacaoRecurso, FaseRecurso, Prisma, ResultadoPoliticasAfirmativas, StatusClassificacaoFinal, StatusInscricao, TipoCronogramaEdital } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { toIsoOrNull } from "../../lib/serialization.js";
import { buildCandidateAnexoIvUrl } from "../inscricao/inscricao-anexo-iv.service.js";
import { buildHomologacaoResumoVigente, parseHomologacaoMotivos } from "../homologacao/homologacao.rules.js";
import { resolveReservasConcorrencia } from "../inscricao/inscricao.rules.js";
import { buildPoliticasAfirmativasResumo } from "../politicas-afirmativas/politicas-afirmativas.service.js";
import { resolveRecursoEfeitoPraticoResumo } from "../recurso/recurso.rules.js";

function resolvePublicacaoArquivoUrl(publicacao: {
  id: string;
  arquivoUrl: string | null;
}) {
  return `/v1/publicacoes/${publicacao.id}/arquivo.pdf`;
}

function resolvePublicacaoOrigemArquivo(arquivoUrl: string | null) {
  return arquivoUrl ? "MANUAL" : "GERADO";
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

type CandidateParticipacao = Prisma.ParticipacaoEditalGetPayload<{
  include: {
    edital: {
      include: {
        cronogramas: true;
        publicacoesOficiais: true;
      };
    };
    pedidoIsencao: true;
    inscricao: {
      include: {
        linhaPesquisa: true;
        documentos: true;
        homologacao: true;
        avaliacaoEtapa1: true;
        avaliacaoEtapa2: true;
        etapasPoliticasAfirmativas: true;
      };
    };
    classificacaoFinal: true;
    recursos: true;
  };
}>;

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
  const latestVersionByTipo = new Map<string, number>();
  const versionById = new Map<string, number>();

  for (const item of records) {
    versionById.set(item.id, item.versao);
    const current = latestVersionByTipo.get(item.tipo);
    if (!current || item.versao > current) {
      latestVersionByTipo.set(item.tipo, item.versao);
    }
  }

  return records.map((item) => ({
    ...item,
    republicacaoDaVersao: item.republicacaoDeId ? (versionById.get(item.republicacaoDeId) ?? null) : null,
    isVersaoAtualDoTipo: latestVersionByTipo.get(item.tipo) === item.versao,
  } satisfies PublicacaoDashboardRecord & { republicacaoDaVersao: number | null; isVersaoAtualDoTipo: boolean }));
}

function buildPublicacaoResumo(publicacao: PublicacaoDashboardRecord) {
  return {
    id: publicacao.id,
    editalId: publicacao.editalId,
    republicacaoDeId: publicacao.republicacaoDeId,
    republicacaoDaVersao: (publicacao as PublicacaoDashboardRecord & { republicacaoDaVersao?: number | null }).republicacaoDaVersao ?? null,
    isVersaoAtualDoTipo: (publicacao as PublicacaoDashboardRecord & { isVersaoAtualDoTipo?: boolean }).isVersaoAtualDoTipo ?? false,
    tipo: publicacao.tipo,
    titulo: publicacao.titulo,
    descricao: publicacao.descricao,
    versao: publicacao.versao,
    versaoFinal: publicacao.versaoFinal,
    origemArquivo: resolvePublicacaoOrigemArquivo(publicacao.arquivoUrl),
    arquivoUrl: resolvePublicacaoArquivoUrl(publicacao),
    publicadoEm: toIsoOrNull(publicacao.publicadoEm),
  };
}

function isCronogramaAberto(cronogramas: Array<{ tipo: string; inicioEm: Date; fimEm: Date }>, tipo: TipoCronogramaEdital) {
  const now = Date.now();
  return cronogramas.some((cronograma) => cronograma.tipo === tipo && cronograma.inicioEm.getTime() <= now && cronograma.fimEm.getTime() >= now);
}

function buildInscricaoReservasConcorrencia(inscricao: {
  dadosFormulario?: unknown;
  modalidadeConcorrencia?: unknown;
  confirmacaoAcoesAfirmativas?: string;
  confirmacaoPcd?: string;
  etapasPoliticasAfirmativas?: Array<{ tipo: string }>;
}) {
  const base = resolveReservasConcorrencia({
    fichaInscricao: inscricao.dadosFormulario as Parameters<typeof resolveReservasConcorrencia>[0]["fichaInscricao"],
    modalidadeConcorrencia: inscricao.modalidadeConcorrencia as Parameters<typeof resolveReservasConcorrencia>[0]["modalidadeConcorrencia"],
  });

  return {
    acoesAfirmativas: base.acoesAfirmativas || inscricao.confirmacaoAcoesAfirmativas !== "NAO_SE_APLICA" || Boolean(inscricao.etapasPoliticasAfirmativas?.some((etapa) => etapa.tipo === "HETEROIDENTIFICACAO")),
    pcd: base.pcd || inscricao.confirmacaoPcd !== "NAO_SE_APLICA" || Boolean(inscricao.etapasPoliticasAfirmativas?.some((etapa) => etapa.tipo === "PCD")),
  };
}

function resolveAcompanhamento(participacao: CandidateParticipacao) {
  const inscricao = participacao.inscricao;
  const etapasPoliticas = [...(inscricao?.etapasPoliticasAfirmativas ?? [])].sort((left, right) => left.tipo.localeCompare(right.tipo));
  const homologacaoVigente = inscricao?.homologacao
    ? buildHomologacaoResumoVigente({
        statusPreliminar: inscricao.homologacao.statusPreliminar,
        motivosPreliminar: inscricao.homologacao.motivosPreliminar,
        parecerPreliminar: inscricao.homologacao.parecerPreliminar,
        publicadoPreliminarEm: inscricao.homologacao.publicadoPreliminarEm,
        statusFinal: inscricao.homologacao.statusFinal,
        motivosFinal: inscricao.homologacao.motivosFinal,
        parecerFinal: inscricao.homologacao.parecerFinal,
        publicadoFinalEm: inscricao.homologacao.publicadoFinalEm,
      })
    : null;

  let faseAtual = "EDITAL";
  let situacaoAtual: string = participacao.status;
  let etapaBloqueio: string | null = null;
  let motivoResumo: string | null = null;
  let proximoPasso: string | null = null;

  if (participacao.classificacaoFinal) {
    faseAtual = participacao.classificacaoFinal.status === StatusClassificacaoFinal.PRELIMINAR ? "CLASSIFICACAO_PRELIMINAR" : "CLASSIFICACAO_FINAL";
    situacaoAtual = participacao.classificacaoFinal.status;
    proximoPasso = participacao.classificacaoFinal.status === StatusClassificacaoFinal.PRELIMINAR ? "Acompanhar classificacao preliminar e janela recursal." : "Acompanhar publicacoes oficiais e orientacoes finais do edital.";
  } else if (etapasPoliticas.length > 0) {
    const etapasComFinal = etapasPoliticas.filter((etapa) => etapa.resultadoFinal !== ResultadoPoliticasAfirmativas.PENDENTE);
    const etapasComPreliminar = etapasPoliticas.filter((etapa) => etapa.resultadoPreliminar !== ResultadoPoliticasAfirmativas.PENDENTE);

    if (etapasComFinal.length > 0) {
      faseAtual = "POLITICAS_AFIRMATIVAS_FINAL";
      situacaoAtual = etapasComFinal.length === 1 ? etapasComFinal[0].resultadoFinal : "EM_ANALISE";
      motivoResumo = etapasComFinal.map((etapa) => etapa.parecerFinal).filter((value): value is string => Boolean(value)).join(" | ") || null;
    } else if (etapasComPreliminar.length > 0) {
      faseAtual = "POLITICAS_AFIRMATIVAS_PRELIMINAR";
      situacaoAtual = etapasComPreliminar.length === 1 ? etapasComPreliminar[0].resultadoPreliminar : "EM_ANALISE";
      motivoResumo = etapasComPreliminar.map((etapa) => etapa.parecerPreliminar).filter((value): value is string => Boolean(value)).join(" | ") || null;
    } else {
      faseAtual = "POLITICAS_AFIRMATIVAS";
      situacaoAtual = etapasPoliticas[0].statusOperacao;
    }
  } else if (inscricao?.avaliacaoEtapa2) {
    faseAtual = inscricao.avaliacaoEtapa2.status === "FINAL_PUBLICADA" ? "ETAPA_2_FINAL" : "ETAPA_2_PRELIMINAR";
    situacaoAtual = inscricao.avaliacaoEtapa2.status;
    motivoResumo = typeof inscricao.avaliacaoEtapa2.espelhoCorrecao === "string" ? inscricao.avaliacaoEtapa2.espelhoCorrecao : null;
  } else if (inscricao?.avaliacaoEtapa1) {
    faseAtual = inscricao.avaliacaoEtapa1.status === "FINAL_PUBLICADA" ? "ETAPA_1_FINAL" : "ETAPA_1_PRELIMINAR";
    situacaoAtual = inscricao.avaliacaoEtapa1.status;
    motivoResumo = inscricao.avaliacaoEtapa1.fundamentoUsoIa ?? ((inscricao.avaliacaoEtapa1.nota?.toNumber() ?? 0) < 7 && inscricao.avaliacaoEtapa1.status === "FINAL_PUBLICADA" ? "Nota inferior a 7,0 na Etapa 1." : null);
    etapaBloqueio = (inscricao.avaliacaoEtapa1.nota?.toNumber() ?? 0) < 7 && inscricao.avaliacaoEtapa1.status === "FINAL_PUBLICADA" ? "ETAPA_1" : null;
  } else if (homologacaoVigente?.statusVigente) {
    faseAtual = homologacaoVigente.faseVigente === "FINAL" ? "HOMOLOGACAO_FINAL" : "HOMOLOGACAO_PRELIMINAR";
    situacaoAtual = homologacaoVigente.statusVigente;
    etapaBloqueio = homologacaoVigente.situacaoVigente === "INDEFERIDO" ? faseAtual : null;
    motivoResumo = homologacaoVigente.motivoResumoVigente ?? homologacaoVigente.parecerVigente;
    proximoPasso = homologacaoVigente.situacaoVigente === "INDEFERIDO" ? "Avaliar recurso de homologacao dentro da janela do edital." : "Acompanhar a proxima etapa do processo seletivo.";
  } else if (inscricao) {
    faseAtual = "INSCRICAO";
    situacaoAtual = inscricao.status;
    proximoPasso = inscricao.status === StatusInscricao.RASCUNHO ? "Concluir e submeter a inscricao dentro do prazo." : "Acompanhar homologacao e publicacoes do edital.";
  } else if (participacao.pedidoIsencao) {
    faseAtual = "ISENCAO";
    situacaoAtual = participacao.pedidoIsencao.status;
    motivoResumo = participacao.pedidoIsencao.parecerFinal ?? participacao.pedidoIsencao.parecerPreliminar ?? null;
    etapaBloqueio = participacao.pedidoIsencao.status.includes("INDEFERIDA") ? "ISENCAO" : null;
  }

  return {
    faseAtual,
    situacaoAtual,
    etapaBloqueio,
    motivoResumo,
    proximoPasso,
  };
}

function resolveElegibilidade(participacao: CandidateParticipacao, publicacoes: PublicacaoDashboardRecord[]) {
  const inscricao = participacao.inscricao;
  const etapasPoliticas = inscricao?.etapasPoliticasAfirmativas ?? [];
  const cronogramas = participacao.edital.cronogramas;
  const janelaInscricaoAberta = isCronogramaAberto(cronogramas, TipoCronogramaEdital.INSCRICAO);
  const janelaIsencaoAberta = isCronogramaAberto(cronogramas, TipoCronogramaEdital.PEDIDO_ISENCAO);
  const fasesComRecursoJaInterposto = new Set(participacao.recursos.map((recurso) => recurso.fase));
  const tiposPoliticasComRecursoJaInterposto = new Set(
    participacao.recursos
      .filter((recurso) => recurso.fase === FaseRecurso.POLITICAS_AFIRMATIVAS)
      .map((recurso) => recurso.tipoPoliticasAfirmativasReferencia)
      .filter((tipo): tipo is NonNullable<typeof tipo> => tipo !== null),
  );
  const faseHomologacaoVigente = inscricao?.homologacao?.statusFinal ? FaseHomologacaoRecurso.FINAL : inscricao?.homologacao?.statusPreliminar ? FaseHomologacaoRecurso.PRELIMINAR : null;
  const recursoHomologacaoJaInterpostoNaFaseVigente = faseHomologacaoVigente
    ? participacao.recursos.some((recurso) => recurso.fase === FaseRecurso.HOMOLOGACAO && recurso.faseHomologacaoReferencia === faseHomologacaoVigente)
    : false;
  const fasesRecursoElegiveis: string[] = [];

  if (participacao.pedidoIsencao && !fasesComRecursoJaInterposto.has(FaseRecurso.ISENCAO) && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_ISENCAO) && ["DEFERIDA_PRELIMINAR", "INDEFERIDA_PRELIMINAR"].includes(participacao.pedidoIsencao.status)) {
    fasesRecursoElegiveis.push(FaseRecurso.ISENCAO);
  }

  if (faseHomologacaoVigente && !recursoHomologacaoJaInterpostoNaFaseVigente && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_HOMOLOGACAO)) {
    fasesRecursoElegiveis.push(FaseRecurso.HOMOLOGACAO);
  }

  if (inscricao?.avaliacaoEtapa1?.espelhoLiberadoEm && !fasesComRecursoJaInterposto.has(FaseRecurso.ETAPA_1) && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_ETAPA_1) && inscricao.avaliacaoEtapa1.status === "PRELIMINAR_PUBLICADA") {
    fasesRecursoElegiveis.push(FaseRecurso.ETAPA_1);
  }

  if (inscricao?.avaliacaoEtapa2?.espelhoLiberadoEm && !fasesComRecursoJaInterposto.has(FaseRecurso.ETAPA_2) && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_ETAPA_2) && inscricao.avaliacaoEtapa2.status === "PRELIMINAR_PUBLICADA") {
    fasesRecursoElegiveis.push(FaseRecurso.ETAPA_2);
  }

  if (participacao.classificacaoFinal?.status === StatusClassificacaoFinal.PRELIMINAR && !fasesComRecursoJaInterposto.has(FaseRecurso.CLASSIFICACAO) && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_CLASSIFICACAO)) {
    fasesRecursoElegiveis.push(FaseRecurso.CLASSIFICACAO);
  }

  if (
    etapasPoliticas.some((etapa) => etapa.resultadoPreliminar && etapa.resultadoPreliminar !== ResultadoPoliticasAfirmativas.PENDENTE && !tiposPoliticasComRecursoJaInterposto.has(etapa.tipo))
    && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_HETEROIDENTIFICACAO)
  ) {
    fasesRecursoElegiveis.push(FaseRecurso.POLITICAS_AFIRMATIVAS);
  }

  const motivoBloqueioInscricao = janelaInscricaoAberta
    ? inscricao?.status === StatusInscricao.SUBMETIDA
      ? "A inscricao foi submetida. Cancele a submissao dentro do prazo para voltar ao rascunho."
      : inscricao && inscricao.status !== StatusInscricao.RASCUNHO
        ? "A inscricao atual nao pode mais ser editada neste estado do processo."
        : null
    : "A janela de inscricao deste edital esta encerrada.";

  const motivoBloqueioIsencao = participacao.pedidoIsencao
    ? "Ja existe pedido de isencao vinculado a este edital."
    : !janelaIsencaoAberta
      ? "A janela de pedido de isencao deste edital esta encerrada."
      : null;

  const motivoBloqueioEspelhoEtapa1 = !inscricao?.avaliacaoEtapa1
    ? "A etapa 1 ainda nao possui resultado preliminar publicado."
    : inscricao.avaliacaoEtapa1.espelhoLiberadoEm
      ? "O espelho da etapa 1 ja esta liberado para visualizacao."
      : inscricao.avaliacaoEtapa1.espelhoSolicitadoEm
        ? "O espelho da etapa 1 ja foi solicitado e aguarda liberacao administrativa."
        : inscricao.avaliacaoEtapa1.status !== "PRELIMINAR_PUBLICADA"
          ? "O espelho da etapa 1 so fica disponivel durante o resultado preliminar publicado."
          : !isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_ETAPA_1)
            ? "A janela recursal da etapa 1 esta encerrada."
            : null;

  const motivoBloqueioEspelhoEtapa2 = !inscricao?.avaliacaoEtapa2
    ? "A etapa 2 ainda nao possui resultado preliminar publicado."
    : inscricao.avaliacaoEtapa2.espelhoLiberadoEm
      ? "O espelho da etapa 2 ja esta liberado para visualizacao."
      : inscricao.avaliacaoEtapa2.espelhoSolicitadoEm
        ? "O espelho da etapa 2 ja foi solicitado e aguarda liberacao administrativa."
        : inscricao.avaliacaoEtapa2.status !== "PRELIMINAR_PUBLICADA"
          ? "O espelho da etapa 2 so fica disponivel durante o resultado preliminar publicado."
          : !isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_ETAPA_2)
            ? "A janela recursal da etapa 2 esta encerrada."
            : null;

  const motivoBloqueioRecurso = fasesRecursoElegiveis.length > 0
    ? null
    : participacao.recursos.length > 0
      ? "Ja existe recurso registrado para as fases atualmente recorriveis deste edital."
      : "Nenhuma fase esta elegivel para recurso no momento. Aguarde publicacao preliminar, liberacao de espelho ou abertura da janela recursal correspondente.";

  return {
    janelaInscricaoAberta,
    janelaIsencaoAberta,
    podeEditarInscricao: janelaInscricaoAberta && (!inscricao || inscricao.status === StatusInscricao.RASCUNHO),
    podeCancelarSubmissao: janelaInscricaoAberta && inscricao?.status === StatusInscricao.SUBMETIDA,
    podeCriarIsencao: janelaIsencaoAberta && !participacao.pedidoIsencao,
    podeSolicitarEspelhoEtapa1: Boolean(inscricao?.avaliacaoEtapa1 && inscricao.avaliacaoEtapa1.status === "PRELIMINAR_PUBLICADA" && !inscricao.avaliacaoEtapa1.espelhoSolicitadoEm && !inscricao.avaliacaoEtapa1.espelhoLiberadoEm && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_ETAPA_1)),
    podeSolicitarEspelhoEtapa2: Boolean(inscricao?.avaliacaoEtapa2 && inscricao.avaliacaoEtapa2.status === "PRELIMINAR_PUBLICADA" && !inscricao.avaliacaoEtapa2.espelhoSolicitadoEm && !inscricao.avaliacaoEtapa2.espelhoLiberadoEm && isCronogramaAberto(cronogramas, TipoCronogramaEdital.RECURSO_ETAPA_2)),
    podeVerEspelhoEtapa1: Boolean(inscricao?.avaliacaoEtapa1?.espelhoLiberadoEm),
    podeVerEspelhoEtapa2: Boolean(inscricao?.avaliacaoEtapa2?.espelhoLiberadoEm),
    fasesRecursoElegiveis,
    podeVerPublicacoes: publicacoes.length > 0,
    motivoBloqueioInscricao,
    motivoBloqueioIsencao,
    motivoBloqueioEspelhoEtapa1,
    motivoBloqueioEspelhoEtapa2,
    motivoBloqueioRecurso,
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
          etapasPoliticasAfirmativas: true,
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
    acompanhamento: resolveAcompanhamento(participacao),
    elegibilidade: resolveElegibilidade(participacao, getPublicacoesDashboard(participacao.edital.publicacoesOficiais)),
    inscricao: participacao.inscricao
      ? {
          reservasConcorrencia: buildInscricaoReservasConcorrencia(participacao.inscricao),
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
          temaRedacaoEditalId: participacao.inscricao.temaRedacaoEditalId,
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
          anexoIvDisponivel: Boolean(participacao.inscricao.dadosFormulario),
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
                  vigente: buildHomologacaoResumoVigente({
                    statusPreliminar: participacao.inscricao.homologacao.statusPreliminar,
                    motivosPreliminar: participacao.inscricao.homologacao.motivosPreliminar,
                    parecerPreliminar: participacao.inscricao.homologacao.parecerPreliminar,
                    publicadoPreliminarEm: participacao.inscricao.homologacao.publicadoPreliminarEm,
                    statusFinal: participacao.inscricao.homologacao.statusFinal,
                    motivosFinal: participacao.inscricao.homologacao.motivosFinal,
                    parecerFinal: participacao.inscricao.homologacao.parecerFinal,
                    publicadoFinalEm: participacao.inscricao.homologacao.publicadoFinalEm,
                  }),
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
          politicasAfirmativas: participacao.inscricao.etapasPoliticasAfirmativas.length > 0
            ? {
                itens: participacao.inscricao.etapasPoliticasAfirmativas.map(buildPoliticasAfirmativasResumo),
              }
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
      faseHomologacaoReferencia: recurso.faseHomologacaoReferencia,
      tipoPoliticasAfirmativasReferencia: recurso.tipoPoliticasAfirmativasReferencia,
      status: recurso.status,
      fundamentacao: recurso.fundamentacao,
      anexoUrl: recurso.anexoUrl,
      decisao: recurso.decisao,
      impactoResultado: recurso.impactoResultado,
      efeitoPraticoResumo: resolveRecursoEfeitoPraticoResumo({
        fase: recurso.fase,
        status: recurso.status,
        impactoResultado: recurso.impactoResultado,
        faseHomologacaoReferencia: recurso.faseHomologacaoReferencia,
      }),
      criadoEm: recurso.criadoEm.toISOString(),
      respondidoEm: toIsoOrNull(recurso.respondidoEm),
    })),
    publicacoes: [...getPublicacoesDashboard(participacao.edital.publicacoesOficiais)].map(buildPublicacaoResumo),
  }));
}
