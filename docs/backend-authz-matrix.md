# Matriz de Rotas Protegidas do Backend

Este documento consolida o modelo atual de autenticacao, papel e ownership do backend.

## Politica atual

- `requireAuth` valida JWT, reconsulta o usuario no banco e rejeita conta bloqueada ou removida.
- `requireRole` usa os perfis carregados no contexto autenticado.
- rotas de candidato que acessam recursos por `inscricaoId` ou similares dependem de filtro por ownership no service.
- o comportamento atual para acesso a recurso de outro candidato e mascaramento por `404` nos fluxos de ownership baseados em inscricao.
- falta zero-trust por recurso individual em todos os modulos administrativos porque admin e avaliador continuam governados por papel, nao por ownership.

## Grupos de rota

### Publicas

| Rota | Auth | Papel | Ownership | Observacao |
| --- | --- | --- | --- | --- |
| `GET /health` | nao | - | - | saude do backend |
| `GET /docs` e `GET /docs/openapi.json` | nao | - | - | documentacao |
| `GET /v1/editais` | nao | - | - | listagem publica |
| `GET /v1/editais/:editalId` | nao | - | - | detalhe publico |
| `GET /v1/editais/:editalId/publicacoes` | nao | - | - | publicacoes oficiais minimizadas |
| `GET /v1/publicacoes/:publicacaoId/arquivo.pdf` | nao | - | - | PDF oficial gerado do snapshot |

### Autenticadas sem papel adicional

| Rota | Auth | Papel | Ownership | Observacao |
| --- | --- | --- | --- | --- |
| `GET /v1/auth/me` | sim | qualquer conta ativa | n/a | retorna usuario autenticado |
| `GET /v1/candidato/participacoes` | sim | qualquer conta ativa | `request.auth.userId` | escopo do proprio usuario |
| `GET /v1/candidato/area` | sim | qualquer conta ativa | `request.auth.userId` | painel consolidado do proprio usuario |
| `GET /v1/candidato/isencoes` | sim | qualquer conta ativa | `request.auth.userId` | listagem do proprio usuario |
| `GET /v1/candidato/inscricoes` | sim | qualquer conta ativa | `request.auth.userId` | listagem do proprio usuario |
| `GET /v1/candidato/recursos` | sim | qualquer conta ativa | `request.auth.userId` | listagem do proprio usuario |

### Candidato com ownership por inscricao

| Rota | Auth | Papel | Ownership | Resultado negativo atual |
| --- | --- | --- | --- | --- |
| `PUT /v1/editais/:editalId/inscricao/rascunho` | sim | qualquer conta ativa | `usuarioId` no draft | `404` ou `409` conforme regra |
| `POST /v1/inscricoes/:inscricaoId/documentos` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `POST /v1/inscricoes/:inscricaoId/submeter` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `POST /v1/inscricoes/:inscricaoId/cancelar-submissao` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `GET /v1/inscricoes/:inscricaoId/anexo-iv` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `GET /v1/inscricoes/:inscricaoId/pacote-documental` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `POST /v1/inscricoes/:inscricaoId/etapa-1/espelho/solicitar` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `GET /v1/inscricoes/:inscricaoId/etapa-1/espelho` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `POST /v1/inscricoes/:inscricaoId/etapa-2/espelho/solicitar` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |
| `GET /v1/inscricoes/:inscricaoId/etapa-2/espelho` | sim | qualquer conta ativa | inscricao do proprio usuario | `404 INSCRICAO_NAO_ENCONTRADA` |

### Admin

| Rota | Auth | Papel |
| --- | --- | --- |
| homologacao: fundamentos, listagem, preliminar, final, confirmacao de reserva | sim | `ADMIN` |
| classificacao: listagem, recalculo | sim | `ADMIN` |
| recurso: listagem admin, decisao | sim | `ADMIN` |
| publicacoes: criacao, preview, PDFs admin por inscricao | sim | `ADMIN` |
| politicas afirmativas: listagem, encaminhamento, resultados, preview e publicacao | sim | `ADMIN` |
| pacote documental admin | sim | `ADMIN` |

### Admin ou avaliador

| Rota | Auth | Papel |
| --- | --- | --- |
| `GET /v1/admin/etapa-1/inscricoes` | sim | `ADMIN` ou `AVALIADOR` |
| `PUT /v1/admin/etapa-1/inscricoes/:inscricaoId/resultado` | sim | `ADMIN` ou `AVALIADOR` |
| `POST /v1/admin/inscricoes/:inscricaoId/etapa-1/espelho/liberar` | sim | `ADMIN` ou `AVALIADOR` |
| `GET /v1/admin/inscricoes/:inscricaoId/etapa-1/espelho` | sim | `ADMIN` ou `AVALIADOR` |
| `GET /v1/admin/etapa-2/inscricoes` | sim | `ADMIN` ou `AVALIADOR` |
| `PUT /v1/admin/etapa-2/inscricoes/:inscricaoId/resultado` | sim | `ADMIN` ou `AVALIADOR` |
| `POST /v1/admin/inscricoes/:inscricaoId/etapa-2/espelho/liberar` | sim | `ADMIN` ou `AVALIADOR` |
| `GET /v1/admin/inscricoes/:inscricaoId/etapa-2/espelho` | sim | `ADMIN` ou `AVALIADOR` |

## Evidencia automatizada atual

- suite `backend/src/modules/auth/auth.e2e.test.ts`
- suite `backend/src/modules/authz-ownership.e2e.test.ts`
- suites funcionais que tambem exercitam ownership indireto por inscricao e recurso

## Pendencias residuais

- manter esta matriz atualizada quando novas rotas forem adicionadas
- avaliar se algum caso futuro deve migrar de mascaramento por `404` para `403` explicito
