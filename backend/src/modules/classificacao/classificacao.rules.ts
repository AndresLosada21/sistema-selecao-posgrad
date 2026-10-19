import { DesempateClassificacao, ModalidadeConcorrencia, StatusClassificacaoFinal, StatusConfirmacaoReserva } from "@prisma/client";

export type ClassificacaoConfiguracao = {
  pesoEtapa1: number;
  pesoEtapa2: number;
  desempate: DesempateClassificacao;
  reservaUnificada?: boolean;
};

export const CLASSIFICACAO_CONFIGURACAO_PADRAO: ClassificacaoConfiguracao = {
  pesoEtapa1: 1,
  pesoEtapa2: 2,
  desempate: DesempateClassificacao.ETAPA1_ETAPA2_IDADE,
};

export type ClassificacaoLinhaConfig = {
  id: string;
  vagasAmplaConcorrencia: number;
  vagasAcoesAfirmativas: number;
  vagasPcd: number;
};

export type ClassificacaoCandidate = {
  inscricaoId: string;
  participacaoEditalId: string;
  linhaPesquisaId: string;
  modalidadeConcorrencia: ModalidadeConcorrencia;
  confirmacaoAcoesAfirmativas: StatusConfirmacaoReserva;
  confirmacaoPcd: StatusConfirmacaoReserva;
  notaEtapa1: number;
  notaEtapa2: number;
  dataNascimento: Date | null;
};

export type RankedClassificacaoCandidate = ClassificacaoCandidate & {
  notaFinal: number;
  posicaoGeral: number;
  posicaoLinha: number;
  status: StatusClassificacaoFinal;
};

function compareNullableDatesAsc(a: Date | null, b: Date | null) {
  if (a && b) {
    return a.getTime() - b.getTime();
  }

  if (a) {
    return -1;
  }

  if (b) {
    return 1;
  }

  return 0;
}

export function calculateNotaFinal(input: {
  notaEtapa1: number;
  notaEtapa2: number;
  pesoEtapa1?: number;
  pesoEtapa2?: number;
}) {
  const pesoEtapa1 = input.pesoEtapa1 ?? CLASSIFICACAO_CONFIGURACAO_PADRAO.pesoEtapa1;
  const pesoEtapa2 = input.pesoEtapa2 ?? CLASSIFICACAO_CONFIGURACAO_PADRAO.pesoEtapa2;
  const somaPesos = pesoEtapa1 + pesoEtapa2;

  if (somaPesos <= 0) {
    return 0;
  }

  return Number((((input.notaEtapa1 * pesoEtapa1) + (input.notaEtapa2 * pesoEtapa2)) / somaPesos).toFixed(2));
}

export function compareClassificacaoCandidates(
  a: Pick<ClassificacaoCandidate, "notaEtapa1" | "notaEtapa2" | "dataNascimento"> & { notaFinal: number },
  b: Pick<ClassificacaoCandidate, "notaEtapa1" | "notaEtapa2" | "dataNascimento"> & { notaFinal: number },
  desempate: DesempateClassificacao = CLASSIFICACAO_CONFIGURACAO_PADRAO.desempate,
) {
  if (b.notaFinal !== a.notaFinal) {
    return b.notaFinal - a.notaFinal;
  }

  if (b.notaEtapa1 !== a.notaEtapa1) {
    return b.notaEtapa1 - a.notaEtapa1;
  }

  if (desempate === DesempateClassificacao.ETAPA1_ETAPA2_IDADE && b.notaEtapa2 !== a.notaEtapa2) {
    return b.notaEtapa2 - a.notaEtapa2;
  }

  return compareNullableDatesAsc(a.dataNascimento, b.dataNascimento);
}

function buildApprovedSet(
  items: Array<ClassificacaoCandidate & { notaFinal: number }>,
  linha: ClassificacaoLinhaConfig,
  reservaUnificada: boolean,
) {
  const approvedByParticipacaoId = new Map<string, ModalidadeConcorrencia>();

  for (const item of items.slice(0, linha.vagasAmplaConcorrencia)) {
    approvedByParticipacaoId.set(item.participacaoEditalId, ModalidadeConcorrencia.AMPLA_CONCORRENCIA);
  }

  const totalVagasReservadas = linha.vagasAcoesAfirmativas + linha.vagasPcd;
  const limiteReservas = linha.vagasAmplaConcorrencia + totalVagasReservadas;

  if (reservaUnificada) {
    for (const item of items) {
      if (approvedByParticipacaoId.size >= limiteReservas) {
        break;
      }

      if (approvedByParticipacaoId.has(item.participacaoEditalId)) {
        continue;
      }

      const acoesAfirmativas = item.confirmacaoAcoesAfirmativas === StatusConfirmacaoReserva.CONFIRMADA;
      const pcd = item.confirmacaoPcd === StatusConfirmacaoReserva.CONFIRMADA;

      if (acoesAfirmativas || pcd) {
        approvedByParticipacaoId.set(
          item.participacaoEditalId,
          acoesAfirmativas ? ModalidadeConcorrencia.ACOES_AFIRMATIVAS : ModalidadeConcorrencia.PCD,
        );
      }
    }

    return approvedByParticipacaoId;
  }

  for (const item of items) {
    if (approvedByParticipacaoId.size >= linha.vagasAmplaConcorrencia + linha.vagasAcoesAfirmativas) {
      break;
    }

    if (approvedByParticipacaoId.has(item.participacaoEditalId)) {
      continue;
    }

    if (item.confirmacaoAcoesAfirmativas === StatusConfirmacaoReserva.CONFIRMADA) {
      approvedByParticipacaoId.set(item.participacaoEditalId, ModalidadeConcorrencia.ACOES_AFIRMATIVAS);
    }
  }

  const limitePcd = linha.vagasAmplaConcorrencia + linha.vagasAcoesAfirmativas + linha.vagasPcd;

  for (const item of items) {
    if (approvedByParticipacaoId.size >= limitePcd) {
      break;
    }

    if (approvedByParticipacaoId.has(item.participacaoEditalId)) {
      continue;
    }

    if (item.confirmacaoPcd === StatusConfirmacaoReserva.CONFIRMADA) {
      approvedByParticipacaoId.set(item.participacaoEditalId, ModalidadeConcorrencia.PCD);
    }
  }

  return approvedByParticipacaoId;
}

export function rankClassificacao(input: {
  candidates: ClassificacaoCandidate[];
  linhas: ClassificacaoLinhaConfig[];
  publicacao: "PRELIMINAR" | "FINAL";
  configuracao?: ClassificacaoConfiguracao;
}) {
  const configuracao = input.configuracao ?? CLASSIFICACAO_CONFIGURACAO_PADRAO;
  const base = input.candidates
    .map((candidate) => ({
      ...candidate,
      notaFinal: calculateNotaFinal({
        notaEtapa1: candidate.notaEtapa1,
        notaEtapa2: candidate.notaEtapa2,
        pesoEtapa1: configuracao.pesoEtapa1,
        pesoEtapa2: configuracao.pesoEtapa2,
      }),
    }))
    .sort((a, b) => compareClassificacaoCandidates(a, b, configuracao.desempate));

  const posicaoGeralMap = new Map<string, number>();

  base.forEach((candidate, index) => {
    posicaoGeralMap.set(candidate.participacaoEditalId, index + 1);
  });

  const linhaConfigMap = new Map(input.linhas.map((linha) => [linha.id, linha]));
  const itemsByLine = new Map<string, typeof base>();

  for (const candidate of base) {
    const current = itemsByLine.get(candidate.linhaPesquisaId) ?? [];
    current.push(candidate);
    itemsByLine.set(candidate.linhaPesquisaId, current);
  }

  const ranked: RankedClassificacaoCandidate[] = [];

  for (const [linhaId, items] of itemsByLine.entries()) {
    const linha = linhaConfigMap.get(linhaId);

    if (!linha) {
      continue;
    }

    const approvedIds = input.publicacao === "FINAL"
      ? buildApprovedSet(items, linha, configuracao.reservaUnificada === true)
      : new Map<string, ModalidadeConcorrencia>();

    items.forEach((item, index) => {
      ranked.push({
        ...item,
        modalidadeConcorrencia: approvedIds.get(item.participacaoEditalId) ?? item.modalidadeConcorrencia,
        posicaoGeral: posicaoGeralMap.get(item.participacaoEditalId) ?? index + 1,
        posicaoLinha: index + 1,
        status:
          input.publicacao === "PRELIMINAR"
            ? StatusClassificacaoFinal.PRELIMINAR
            : approvedIds.has(item.participacaoEditalId)
              ? StatusClassificacaoFinal.APROVADO
              : StatusClassificacaoFinal.LISTA_DE_ESPERA,
      });
    });
  }

  return ranked.sort((a, b) => a.posicaoGeral - b.posicaoGeral);
}
