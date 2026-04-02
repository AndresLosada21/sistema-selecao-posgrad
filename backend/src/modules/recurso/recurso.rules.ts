import { FaseRecurso, StatusClassificacaoFinal } from "@prisma/client";

export function shouldReprocessClassificacaoAfterRecurso(fase: FaseRecurso) {
  return (
    fase === FaseRecurso.HOMOLOGACAO ||
    fase === FaseRecurso.ETAPA_1 ||
    fase === FaseRecurso.ETAPA_2 ||
    fase === FaseRecurso.CLASSIFICACAO
  );
}

export function resolveClassificacaoPublicacaoAtual(statuses: StatusClassificacaoFinal[]) {
  if (statuses.some((status) => status === StatusClassificacaoFinal.PRELIMINAR)) {
    return "PRELIMINAR" as const;
  }

  if (
    statuses.some(
      (status) =>
        status === StatusClassificacaoFinal.APROVADO ||
        status === StatusClassificacaoFinal.LISTA_DE_ESPERA ||
        status === StatusClassificacaoFinal.ELIMINADO ||
        status === StatusClassificacaoFinal.FINAL,
    )
  ) {
    return "FINAL" as const;
  }

  return null;
}
