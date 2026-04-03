import { TipoPublicacaoOficial } from "@prisma/client";

export type FaseHomologacaoPublicacao = "PRELIMINAR" | "FINAL";
export type FaseClassificacaoPublicacao = "PRELIMINAR" | "FINAL";
export type FasePoliticasAfirmativasPublicacao = "PRELIMINAR" | "FINAL";

export function resolvePublicacaoVersionamento(existing: Array<{ id: string; versao: number }>) {
  if (existing.length === 0) {
    return {
      versao: 1,
      republicacaoDeId: null,
      republicacaoDaVersao: null,
    };
  }

  const latest = existing.reduce((current, item) => (item.versao > current.versao ? item : current));

  return {
    versao: latest.versao + 1,
    republicacaoDeId: latest.id,
    republicacaoDaVersao: latest.versao,
  };
}

export function resolveHomologacaoTipoPublicacao(fase: FaseHomologacaoPublicacao) {
  return fase === "PRELIMINAR"
    ? TipoPublicacaoOficial.HOMOLOGACAO_PRELIMINAR
    : TipoPublicacaoOficial.HOMOLOGACAO_FINAL;
}

export function buildHomologacaoPublicacaoTitulo(fase: FaseHomologacaoPublicacao) {
  return fase === "PRELIMINAR"
    ? "Resultado preliminar da homologacao das inscricoes"
    : "Resultado final da homologacao das inscricoes";
}

export function resolveClassificacaoTipoPublicacao(fase: FaseClassificacaoPublicacao) {
  return fase === "PRELIMINAR"
    ? TipoPublicacaoOficial.CLASSIFICACAO_PRELIMINAR
    : TipoPublicacaoOficial.CLASSIFICACAO_FINAL;
}

export function buildClassificacaoPublicacaoTitulo(fase: FaseClassificacaoPublicacao) {
  return fase === "PRELIMINAR"
    ? "Resultado preliminar da classificacao final"
    : "Resultado final da classificacao final";
}

export function resolvePoliticasAfirmativasTipoPublicacao(fase: FasePoliticasAfirmativasPublicacao) {
  return fase === "PRELIMINAR"
    ? TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_PRELIMINAR
    : TipoPublicacaoOficial.POLITICAS_AFIRMATIVAS_FINAL;
}

export function buildPoliticasAfirmativasPublicacaoTitulo(fase: FasePoliticasAfirmativasPublicacao) {
  return fase === "PRELIMINAR"
    ? "Resultado preliminar da etapa de politicas afirmativas"
    : "Resultado final da etapa de politicas afirmativas";
}
