import { ModalidadeConcorrencia, StatusClassificacaoFinal, StatusConfirmacaoReserva } from "@prisma/client";

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

export function calculateNotaFinal(notaEtapa1: number, notaEtapa2: number) {
  return Number(((notaEtapa1 + 2 * notaEtapa2) / 3).toFixed(2));
}

export function compareClassificacaoCandidates(
  a: Pick<ClassificacaoCandidate, "notaEtapa1" | "notaEtapa2" | "dataNascimento"> & { notaFinal: number },
  b: Pick<ClassificacaoCandidate, "notaEtapa1" | "notaEtapa2" | "dataNascimento"> & { notaFinal: number },
) {
  if (b.notaFinal !== a.notaFinal) {
    return b.notaFinal - a.notaFinal;
  }

  if (b.notaEtapa1 !== a.notaEtapa1) {
    return b.notaEtapa1 - a.notaEtapa1;
  }

  if (b.notaEtapa2 !== a.notaEtapa2) {
    return b.notaEtapa2 - a.notaEtapa2;
  }

  return compareNullableDatesAsc(a.dataNascimento, b.dataNascimento);
}

function buildApprovedSet(
  items: Array<ClassificacaoCandidate & { notaFinal: number }>,
  linha: ClassificacaoLinhaConfig,
) {
  const approvedIds = new Set<string>();

  for (const item of items.slice(0, linha.vagasAmplaConcorrencia)) {
    approvedIds.add(item.participacaoEditalId);
  }

  for (const item of items) {
    if (approvedIds.size >= linha.vagasAmplaConcorrencia + linha.vagasAcoesAfirmativas) {
      break;
    }

    if (approvedIds.has(item.participacaoEditalId)) {
      continue;
    }

    if (
      item.modalidadeConcorrencia === ModalidadeConcorrencia.ACOES_AFIRMATIVAS &&
      item.confirmacaoAcoesAfirmativas === StatusConfirmacaoReserva.CONFIRMADA
    ) {
      approvedIds.add(item.participacaoEditalId);
    }
  }

  const limitePcd = linha.vagasAmplaConcorrencia + linha.vagasAcoesAfirmativas + linha.vagasPcd;

  for (const item of items) {
    if (approvedIds.size >= limitePcd) {
      break;
    }

    if (approvedIds.has(item.participacaoEditalId)) {
      continue;
    }

    if (
      item.modalidadeConcorrencia === ModalidadeConcorrencia.PCD &&
      item.confirmacaoPcd === StatusConfirmacaoReserva.CONFIRMADA
    ) {
      approvedIds.add(item.participacaoEditalId);
    }
  }

  return approvedIds;
}

export function rankClassificacao(input: {
  candidates: ClassificacaoCandidate[];
  linhas: ClassificacaoLinhaConfig[];
  publicacao: "PRELIMINAR" | "FINAL";
}) {
  const base = input.candidates
    .map((candidate) => ({
      ...candidate,
      notaFinal: calculateNotaFinal(candidate.notaEtapa1, candidate.notaEtapa2),
    }))
    .sort((a, b) => compareClassificacaoCandidates(a, b));

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

    const approvedIds = input.publicacao === "FINAL" ? buildApprovedSet(items, linha) : new Set<string>();

    items.forEach((item, index) => {
      ranked.push({
        ...item,
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
