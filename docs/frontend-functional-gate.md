# Gate Funcional do Frontend

Este documento define o gate funcional atual do frontend da V1 com foco em comportamento das paginas, navegacao, escrita e evidencia operacional.

## Objetivo

Garantir que uma tela do frontend nao seja considerada pronta apenas por compilar.

Uma alteracao funcional no frontend so deve ser considerada pronta quando:

- a rota cumpre seu papel individual no fluxo;
- a integracao com as outras rotas nao cria beco sem saida;
- os contratos do backend sao consumidos de forma coerente;
- erros, vazios, ausencia de permissao e dados parciais nao quebram a experiencia;
- existe evidencia minima de validacao local e operacional.

## Gate obrigatorio atual

1. `npm run lint -w frontend`
2. `npm run build -w frontend`
3. smoke manual ou assistido da rota alterada em runtime
4. atualizacao da issue do GitHub com o que foi entregue e o que ficou pendente

## Checklist por tipo de pagina

### Publica

- trata loading, erro, vazio e `not found`
- nao depende de redirecionamento inseguro
- usa links externos/arquivos com abertura segura quando aplicavel
- nao mistura editais tecnicos de teste com fluxo publico real sem decisao explicita

### Candidato

- nao deixa a conta sem proximo passo acionavel
- trata ausencia de participacao, isencao, inscricao, publicacao e recurso
- reconcilia ou pelo menos explicita estado parcial apos operacoes relevantes
- nao esconde informacao relevante quando existe multi-edital

### Admin

- nao depende apenas de instrucoes textuais para abrir modulos principais
- evita filtros disparados a cada tecla quando a operacao pede controle mais preciso
- exibe estados e resultados de forma legivel para operacao
- informa claramente contexto, erro e sucesso operacional

## Evidencia de smoke executada neste ciclo

### Publico

- `/editais`
- `/editais/[editalId]`
- `/editais/[editalId]/cronograma`
- `/editais/[editalId]/publicacoes`
- `/entrar`
- `/criar-conta`
- validacao da ocultacao padrao de editais tecnicos/smoke/E2E na listagem publica

### Candidato

- cadastro de nova conta e redirecionamento para `/candidato`
- `/candidato/participacoes`
- `/candidato/isencoes`
- `/candidato/inscricoes`
- `/candidato/editais/[editalId]/inscricao` com participacao ausente tratada sem quebra

### Admin

- login admin e redirecionamento para `/admin`
- `/admin`
- `/admin/homologacao`
- `/admin/homologacao/[inscricaoId]`
- `/admin/etapa-1/[inscricaoId]`
- `/admin/etapa-2`
- `/admin/recursos`
- `/admin/recursos/[recursoId]`
- `/admin/classificacao`
- `/admin/classificacao/[editalId]`
- `/admin/publicacoes`
- `/admin/publicacoes/[editalId]`

## Pendencias residuais conhecidas neste gate

- o frontend ainda nao possui suite dedicada de testes de interface automatizados
- varias telas ainda dependem de payload consolidado amplo em vez de fetch direcionado por ID
- algumas operacoes administrativas ainda dependem de formularios genericos com JSON/textarea para entrada estrutural, apesar de ja estarem operaveis
