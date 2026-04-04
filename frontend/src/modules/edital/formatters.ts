export function formatIsoDate(value: string | null) {
  if (!value) {
    return "nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatSemestre(ano: number, semestre: number | null) {
  return semestre ? `${ano}.${semestre}` : String(ano);
}
