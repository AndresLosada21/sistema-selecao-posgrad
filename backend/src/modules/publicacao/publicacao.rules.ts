import { TipoPublicacaoOficial } from "@prisma/client";

export type FaseHomologacaoPublicacao = "PRELIMINAR" | "FINAL";

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
