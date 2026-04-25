# Sistema de Selecao Pos-Grad

Repositorio privado para desenvolver o portal do processo seletivo stricto sensu do PPGEE/UFAM.

## Estado atual

O projeto ja saiu da fase de descoberta e entrou em implementacao.

O backlog funcional da V1 foi consolidado no GitHub com foco em:

- edital e cronograma
- conta do candidato
- pedido de isencao
- inscricao online
- homologacao
- etapa 1 e etapa 2
- classificacao final
- recursos
- publicacoes oficiais
- acompanhamento do candidato

## Escopo da V1

O sistema atende mestrado e doutorado do PPGEE e deve suportar multiplos editais ativos em paralelo.

Itens fora do primeiro corte continuam no backlog de segunda fase, especialmente:

- heteroidentificacao operacional completa
- matricula e pos-aprovacao
- expansao para outros programas

## Stack escolhida

- `frontend`: Next.js com TypeScript
- `backend`: TypeScript
- `banco de dados`: PostgreSQL
- `ORM`: Prisma

## Estrutura do repositorio

- `frontend/`: aplicacao Next.js
- `backend/`: API e regras de negocio em TypeScript
- `docker-compose.yml`: ambiente padrao de desenvolvimento com frontend, backend e PostgreSQL

## Gestao do projeto

As decisoes de produto, backlog, epicos e lote tecnico estao sendo mantidos diretamente nas issues do GitHub.

Issue principal:

- `#2` Backlog mestre do produto

## Execucao inicial

Ordem tecnica atual:

1. estruturar entidades e estados centrais do dominio
2. aplicar regras de edital, linhas e cronograma
3. implementar conta do candidato e vinculo com inscricao
4. implementar pedido de isencao e impacto na taxa
5. implementar inscricao online com redacao e pacote documental

## Ambiente local

O projeto nasce dockerizado e possui dois arquivos de compose:

- `docker-compose-dev.yml`: desenvolvimento com hot reload
- `docker-compose.yml`: producao

### Desenvolvimento

1. copie `.env.example` para `.env`
2. suba o ambiente com `docker compose -f docker-compose-dev.yml up --build`
3. frontend: `http://localhost:3000`
4. backend: `http://localhost:4000/health`

### Producao

```bash
docker compose -f docker-compose.yml up --build -d
```

## Validacao e CI

O repositorio possui pipeline em GitHub Actions para bloquear regressao antes de mudancas chegarem a `main`.

Comandos executados pelo CI:

```bash
npm ci
npm run lint -w backend
npm run lint -w frontend
npm run build -w backend
npm run build -w frontend
npm run test:e2e -w backend
npm run test:e2e -w frontend
```

Para os testes E2E do backend, mantenha um PostgreSQL acessivel em `localhost:5432` com:

```env
POSTGRES_DB=selecao_posgrad
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public
```

Para reproduzir localmente a base usada pelos testes de interface:

```bash
npm run prisma:generate -w backend
npm run prisma:deploy -w backend
npm run prisma:seed -w backend
npm run dev:backend
npm run dev:frontend
npm run test:e2e -w frontend
```

O workflow roda em `pull_request` e em `push` para `main`. A protecao da branch `main` deve exigir os checks verdes do workflow depois da primeira execucao bem-sucedida.

## Repositorio

```bash
git clone https://github.com/AndresLosada21/sistema-selecao-posgrad.git
cd sistema-selecao-posgrad
```

## Uso interno

Projeto de uso restrito ao time responsavel pelo desenvolvimento e operacao do sistema.
