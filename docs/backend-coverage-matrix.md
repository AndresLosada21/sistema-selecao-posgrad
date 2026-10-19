# Matriz de Cobertura do Backend

Este documento resume o que hoje esta coberto por testes unitarios, E2E e validacao de build/lint no backend.

## Gate minimo atual

- `npm run build -w backend`
- `npm run lint -w backend`
- `npm run test -w backend`
- `npm run test:e2e -w backend`

## Cobertura por modulo

| Modulo | Unitario | E2E | Observacao |
| --- | --- | --- | --- |
| auth | nao dedicado em unit | sim | auth positiva e negativa, conta bloqueada, token expirado, usuario removido |
| edital | nao dedicado em unit | indireto + publico | validado em fluxos de listagem e detalhe, e em janelas consumidas por isencao/inscricao |
| isencao | nao dedicado em unit | sim | fluxo de criacao, listagem e janela fechada |
| inscricao | sim | sim | regras de submissao, documentos, pacote documental, Anexo IV, janelas e cancelamento |
| homologacao | sim | sim | fundamentos, listagem admin, preliminar e final |
| etapa 1 | sim | sim | regras de rubrica, espelho, solicitacao e liberacao |
| etapa 2 | sim | sim | memoria de calculo, espelho, solicitacao e liberacao |
| politicas afirmativas | sim | sim | encaminhamento, resultado preliminar/final, publicacao |
| classificacao | sim | sim | desempate, distribuicao, recalculo e listagem |
| recurso | sim | sim | criacao, listagem admin, decisao e reprocessamento derivado |
| publicacao | sim | sim | versionamento, snapshots, PDFs e area do candidato |
| hardening HTTP | n/a | sim | headers, payload limit e rate limit |

## Suites E2E atuais

- `backend/src/concurrency.e2e.test.ts`
- `backend/src/hardening.e2e.test.ts`
- `backend/src/modules/auth/auth.e2e.test.ts`
- `backend/src/modules/authz-ownership.e2e.test.ts`
- `backend/src/modules/candidate-flows.e2e.test.ts`
- `backend/src/modules/doutorado-flows.e2e.test.ts`
- `backend/src/modules/inscricao/document-policy.e2e.test.ts`
- `backend/src/modules/admin-flows.e2e.test.ts`
- `backend/src/modules/edital/edital.e2e.test.ts`
- `backend/src/modules/edital/edital-windows.e2e.test.ts`
- `backend/src/modules/etapa1/etapa1-espelho.e2e.test.ts`
- `backend/src/modules/classificacao/classificacao.e2e.test.ts`
- `backend/src/modules/isencao/isencao.e2e.test.ts`
- `backend/src/modules/publicacao/publicacao.e2e.test.ts`
- `backend/src/modules/politicas-afirmativas/politicas-afirmativas.e2e.test.ts`
- `backend/src/modules/operacional-final.e2e.test.ts`

## Riscos residuais conhecidos

- OpenAPI ainda exige acabamento residual continuo quando novos envelopes de erro forem propagados para todas as respostas documentadas
- a matriz de cobertura nao substitui smoke operacional completo em Docker quando houver alteracao grande de fluxo
- ainda existe backlog especifico para acabamento final de contratos de erro (`#65`), consolidacao da cobertura negativa (`#62`) e manutencao desta matriz (`#66`)

## Definicao operacional de pronto para backend

Uma entrega de backend so deve ser considerada pronta quando:

1. build e lint passam
2. testes unitarios passam
3. testes E2E passam
4. os contratos HTTP alterados ficam coerentes com OpenAPI
5. ownership, auth e role continuam cobertos quando a mudanca tocar rotas protegidas
6. qualquer risco residual remanescente fica explicitado na issue ou PR correspondente
