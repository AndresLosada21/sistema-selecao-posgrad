import assert from "node:assert/strict";
import test from "node:test";

import { CursoNivel } from "@prisma/client";

import { createIsencaoSchema, decidirIsencaoSchema } from "./isencao.schemas.js";

test("isencao sem CadUnico exige justificativa e comprovante PDF", () => {
  const result = createIsencaoSchema.safeParse({
    cursoNivel: CursoNivel.MESTRADO,
    inscritoCadUnico: false,
  });

  assert.equal(result.success, false);
  if (!result.success) {
    const flattened = result.error.flatten();
    assert.match(flattened.fieldErrors.justificativa?.join(" ") ?? "", /Justificativa obrigatoria/);
    assert.match(flattened.fieldErrors.comprovanteUrl?.join(" ") ?? "", /Comprovante obrigatorio/);
    assert.match(flattened.fieldErrors.comprovanteNomeArquivo?.join(" ") ?? "", /Nome do arquivo/);
  }
});

test("isencao com CadUnico aceita NIS opcional e dispensa comprovante", () => {
  const result = createIsencaoSchema.safeParse({
    cursoNivel: CursoNivel.DOUTORADO,
    inscritoCadUnico: true,
  });

  assert.equal(result.success, true);
});

test("isencao sem CadUnico aceita comprovante PDF privado do sistema", () => {
  const result = createIsencaoSchema.safeParse({
    cursoNivel: CursoNivel.MESTRADO,
    inscritoCadUnico: false,
    justificativa: "Solicito isencao por impossibilidade financeira comprovada.",
    comprovanteUrl: "/v1/uploads/private/user-1/comprovante.pdf",
    comprovanteNomeArquivo: "comprovante.pdf",
  });

  assert.equal(result.success, true);
});

test("decisao de isencao exige parecer escrito", () => {
  const result = decidirIsencaoSchema.safeParse({ deferida: true, parecer: "ok" });

  assert.equal(result.success, false);
});
