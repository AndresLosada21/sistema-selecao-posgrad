export const anexoIiItems = [
  { id: "titulo", label: "Titulos academicos" },
  { id: "artigo_periodico", label: "Artigos em periodicos" },
  { id: "trabalho_evento", label: "Trabalhos em eventos" },
  { id: "experiencia_docente", label: "Experiencia docente" },
  { id: "experiencia_profissional", label: "Experiencia profissional" },
  { id: "projeto_pesquisa", label: "Projetos de pesquisa" },
  { id: "producao_tecnica", label: "Producao tecnica" },
  { id: "outros", label: "Outros itens previstos no Anexo II" },
] as const;

export const anexoIiItemIds = anexoIiItems.map((item) => item.id) as [string, ...string[]];

export function isAnexoIiItemId(value: string) {
  return anexoIiItems.some((item) => item.id === value);
}
