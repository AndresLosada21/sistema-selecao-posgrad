# Matriz de Testes — Regras de Doutorado

Rastreabilidade entre regra de negócio, comportamento esperado, teste automatizado e comando de execução.

| Regra | Comportamento esperado | Teste | Comando |
| --- | --- | --- | --- |
| Espelho com fase própria | Solicitação aceita quando `ESPELHO_ETAPA_1` está aberta e o recurso fechado | `backend/src/modules/etapa1/etapa1-espelho.e2e.test.ts` | `node --import tsx --test src/modules/etapa1/etapa1-espelho.e2e.test.ts` |
| Fallback de espelho | Sem fase de espelho, a janela de recurso permite a solicitação | `backend/src/modules/etapa1/etapa1-espelho.e2e.test.ts` | mesmo comando |
| Sem janela | Sem espelho e sem recurso abertos, a solicitação é recusada com 409 | `backend/src/modules/etapa1/etapa1-espelho.e2e.test.ts` | mesmo comando |
| Sequência de cronograma | `ESPELHO_ETAPA_1` não pode iniciar antes do fim de `ETAPA_1` | `backend/src/modules/edital/edital.e2e.test.ts` | `node --import tsx --test src/modules/edital/edital.e2e.test.ts` |
| Grupo opcional (API) | Submissão de doutorado sem grupo é aceita quando o edital não exige grupo; com grupo, o snapshot registra o nome | `backend/src/modules/doutorado-flows.e2e.test.ts` | `node --import tsx --test src/modules/doutorado-flows.e2e.test.ts` |
| Escala da rubrica | Nota acima do máximo do critério é rejeitada; máximos oficiais (2, 2, 2, 3, 1) consolidam 10 | `backend/src/modules/doutorado-flows.e2e.test.ts` | mesmo comando |
| Reserva unificada | Com a flag ligada, candidato PCD ocupa vaga reservada e AA fica em lista; com a flag desligada, o inverso | `backend/src/modules/classificacao/classificacao.e2e.test.ts` | `node --import tsx --test src/modules/classificacao/classificacao.e2e.test.ts` |
| Grupo opcional (UI) | Seletor de grupo visível e opcional quando o edital tem grupos e não os exige | `frontend/e2e/candidate-optional-group.spec.ts` | `npx playwright test e2e/candidate-optional-group.spec.ts` |
| Reserva unificada (UI) | Checkbox do admin persiste ligado/desligado após salvar e recarregar | `frontend/e2e/admin-edital-config.spec.ts` | `npx playwright test e2e/admin-edital-config.spec.ts` |

## Gate de execução

- Backend: `npm run lint -w backend`, `npm run build -w backend`, `npm test -w backend`, `npm run test:e2e -w backend`.
- Frontend: `npm run lint -w frontend`, `npm run build -w frontend`, `npm run test:e2e -w frontend`.
- Os testes de UI exigem a stack em execução (Docker ou processos locais) nas portas 3000 e 4000.

## Manutenção

- Ao alterar uma regra listada, atualizar o teste correspondente e esta matriz no mesmo bloco.
- Regras novas de doutorado devem entrar aqui com teste e comando antes de serem consideradas prontas.
