# Matriz de Pronto do Frontend

Este documento consolida o estado atual do frontend da V1, os modulos implementados, a validacao minima executavel e os riscos residuais que ainda devem ser acompanhados.

## Principios adotados

- o frontend consome contratos backend por uma camada HTTP unica em `frontend/src/lib/http/client.ts`
- erros do backend sao tratados a partir do envelope `code` + `message`
- sessao e guards de rota estao centralizados em `frontend/src/lib/auth/`
- area publica, area do candidato e area administrativa ficam separadas por grupos de rota do App Router
- modulos de dominio ficam separados em `frontend/src/modules/`
- o frontend nao replica regra critica de negocio ja resolvida no backend; consome e apresenta os retornos operacionais reais

## Gate minimo atual do frontend

- `npm run lint -w frontend`
- `npm run build -w frontend`
- smoke funcional das rotas alteradas em runtime quando houver mudanca de fluxo
- atualizacao do backlog correspondente no GitHub com o estado real entregue

## Evidencia estrutural de consumo uniforme dos contratos

- chamadas HTTP centralizadas em `frontend/src/lib/http/client.ts`
- normalizacao de erros em `frontend/src/lib/http/api-error.ts`
- busca direta com `fetch(` aparece apenas dentro de `frontend/src/lib/http/client.ts`

## Modulos implementados

| Issue | Modulo | Estado | Evidencia principal |
| --- | --- | --- | --- |
| `#69` | Fundacao da aplicacao, sessao e contratos compartilhados | concluido | App Router por grupos, sessao, guards, cliente HTTP, componentes compartilhados tecnicos |
| `#70` | Publico de editais, cronograma e publicacoes | concluido | `/editais`, `/editais/[editalId]`, `/cronograma`, `/publicacoes` |
| `#71` | Autenticacao, sessao e area do candidato | concluido | `/entrar`, `/criar-conta`, `/candidato`, `/candidato/participacoes`, `/candidato/editais/[editalId]` |
| `#72` | Isencao do candidato | concluido | `/candidato/isencoes`, `/candidato/editais/[editalId]/isencao/nova` |
| `#73` | Inscricao, documentos e Anexo IV | concluido | `/candidato/inscricoes`, `/candidato/editais/[editalId]/inscricao` |
| `#74` | Homologacao admin | concluido | `/admin/homologacao`, `/admin/homologacao/[inscricaoId]` |
| `#75` | Etapas, espelhos e politicas afirmativas | concluido | `/admin/etapa-1/*`, `/admin/etapa-2/*`, `/admin/politicas-afirmativas/*` |
| `#76` | Recursos, classificacao e publicacoes oficiais | concluido | `/admin/recursos/*`, `/admin/classificacao/*`, `/admin/publicacoes/*` |

## Rotas atualmente implementadas

### Publicas

- `/editais`
- `/editais/[editalId]`
- `/editais/[editalId]/cronograma`
- `/editais/[editalId]/publicacoes`
- `/entrar`
- `/criar-conta`

### Candidato

- `/candidato`
- `/candidato/participacoes`
- `/candidato/isencoes`
- `/candidato/inscricoes`
- `/candidato/editais/[editalId]`
- `/candidato/editais/[editalId]/isencao/nova`
- `/candidato/editais/[editalId]/inscricao`

### Admin

- `/admin`
- `/admin/homologacao`
- `/admin/homologacao/[inscricaoId]`
- `/admin/etapa-1`
- `/admin/etapa-1/[inscricaoId]`
- `/admin/etapa-2`
- `/admin/etapa-2/[inscricaoId]`
- `/admin/politicas-afirmativas`
- `/admin/politicas-afirmativas/[inscricaoId]`
- `/admin/recursos`
- `/admin/recursos/[recursoId]`
- `/admin/classificacao`
- `/admin/classificacao/[editalId]`
- `/admin/publicacoes`
- `/admin/publicacoes/[editalId]`

## Checklist de pronto para mudancas futuras de frontend

1. o modulo novo ou alterado usa a camada `frontend/src/lib/http/client.ts`
2. erros de backend sao tratados via `ApiError` e `getErrorMessage`
3. o contexto autenticado usa `SessionProvider` e `RouteGuard` quando aplicavel
4. a rota alterada fica no grupo correto: publico, candidato ou admin
5. os tipos do modulo refletem o contrato real do backend consumido
6. `npm run lint -w frontend` passa
7. `npm run build -w frontend` passa
8. quando houver alteracao relevante de fluxo, a issue correspondente no GitHub e atualizada com o estado real entregue

## Riscos residuais conhecidos

- ainda nao existe cobertura automatizada dedicada de interface do frontend; a validacao atual do cliente depende de lint e build
- o frontend ainda esta agnostico a camada visual final; ha estrutura funcional, mas nao ha acabamento visual final do produto
- parte das telas administrativas usa payloads JSON amplos do backend em `textarea` e `pre` para operacao inicial; isso e aceitavel como base funcional, mas deve ser refinado depois sem reabrir os contratos
- a issue `#77` fecha criterio de pronto e consistencia estrutural, mas nao substitui revisao de UX ou acabamento visual futuro
- varias rotas do candidato e do admin ainda dependem de payload consolidado amplo para resolver um unico detalhe operacional
- a superficie publica ainda precisa separar melhor editais reais de editais tecnicos/smoke/E2E no ambiente atual

## Gate funcional atual

- o checklist operacional deste ciclo esta documentado em `docs/frontend-functional-gate.md`

## Ordem de validacao local recomendada

1. `npm run lint -w frontend`
2. `npm run build -w frontend`
3. validar a rota alterada no ambiente Docker ou dev server local quando houver mudanca de navegacao, sessao ou fluxo operacional
