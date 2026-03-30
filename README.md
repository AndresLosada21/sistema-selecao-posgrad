# Sistema de Selecao Pos-Grad

Repositorio inicial para estruturar a substituicao do processo atual de selecao de pos-graduacao do PPGEE/UFAM.

Neste momento o projeto ainda nao esta em fase de implementacao. O foco e mapear o processo atual, alinhar escopo e preparar a definicao da V1.

## Objetivo desta etapa

- mapear o fluxo atual ponta a ponta
- identificar gargalos operacionais e retrabalho
- levantar regras do edital que precisam virar regra de sistema
- organizar um backlog inicial realista
- adiar decisoes de stack e arquitetura ate termos escopo claro

## Processo atual identificado

Com base no site do PPGEE, o processo hoje segue majoritariamente este fluxo:

1. publicacao do edital
2. solicitacao de isencao de taxa
3. publicacao do resultado da isencao
4. inscricao via formulario externo
5. pagamento da taxa via GRU
6. homologacao preliminar e final das inscricoes
7. execucao das etapas avaliativas do edital
8. publicacao de resultados preliminares e finais por etapa
9. heteroidentificacao, quando aplicavel
10. classificacao final e lista de aprovados

## Principais dores observadas

- informacoes espalhadas entre site, Google Forms, Google Drive e links externos
- publicacoes fragmentadas em muitos arquivos e resultados intermediarios
- pouco rastreamento do status do candidato ao longo do processo
- alta dependencia de operacao manual da secretaria e da comissao
- dificuldade para padronizar etapas entre um edital e outro

## Organizacao desta fase

O levantamento inicial sera conduzido pelo proprio GitHub, usando issues para:

- mapeamento do processo atual
- definicao de requisitos iniciais
- consolidacao do backlog da V1

## Escopo inicial sugerido

Primeiro vamos definir com clareza o que entra na versao 1. O recorte inicial mais provavel e:

- cadastro e publicacao de edital
- inscricao online
- upload basico de documentos
- homologacao de inscricoes
- painel simples para acompanhamento de status
- publicacao de resultados por etapa

Itens como pagamento, recursos, notificacoes, heteroidentificacao e automacoes avancadas podem entrar depois, se fizer sentido.

## Proximos passos

1. consolidar o mapeamento do processo atual nas issues
2. validar as etapas com voce
3. definir o recorte exato da V1
4. escolher a stack minima necessaria
5. iniciar a implementacao

## Repositorio

```bash
git clone https://github.com/AndresLosada21/sistema-selecao-posgrad.git
cd sistema-selecao-posgrad
```

## Licenca

Este projeto esta sob a licenca MIT. Veja `LICENSE`.
