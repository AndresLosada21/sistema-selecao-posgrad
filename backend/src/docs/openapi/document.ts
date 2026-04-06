import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import type { ZodTypeAny } from "zod";

import {
  AddDocumentoRequestSchema,
  AuthResponseSchema,
  AuthenticatedUserSchema,
  AuthorizationHeaderSchema,
  CandidateDashboardListResponseSchema,
  ClassificacaoPublicacaoPreviewSchema,
  ClassificacaoListResponseSchema,
  ConfirmacaoReservaResumoSchema,
  ConfirmacaoReservaRequestSchema,
  EncaminhamentoPoliticasAfirmativasRequestSchema,
  CreatePoliticasAfirmativasPublicacaoRequestSchema,
  CreatePoliticasAfirmativasPublicacaoResponseSchema,
  CreateClassificacaoPublicacaoRequestSchema,
  CreateClassificacaoPublicacaoResponseSchema,
  ConflictErrorResponseSchema,
  CreateIsencaoRequestSchema,
  CreateHomologacaoPublicacaoRequestSchema,
  CreateHomologacaoPublicacaoResponseSchema,
  CreatePublicacaoRequestSchema,
  CreateRecursoRequestSchema,
  DecidirRecursoRequestSchema,
  EditalDetalheSchema,
  EditalIdParamSchema,
  EditalListResponseSchema,
  Etapa1EspelhoSchema,
  Etapa1ListResponseSchema,
  Etapa2EspelhoSchema,
  Etapa2ListResponseSchema,
  HealthDegradedSchema,
  HealthOkSchema,
  HomologacaoAdminListResponseSchema,
  HomologacaoDecisionRequestSchema,
  HomologacaoFundamentosListResponseSchema,
  HomologacaoInscricaoModelSchema,
  InscricaoIdParamSchema,
  InscricaoListResponseSchema,
  InscricaoModelSchema,
  PacoteDocumentalDetalheResponseSchema,
  PacoteDocumentalResumoSchema,
  PoliticasAfirmativasAdminListResponseSchema,
  PoliticasAfirmativasResumoSchema,
  PoliticasAfirmativasPublicacaoPreviewSchema,
  PublicacaoIdParamSchema,
  ListEditaisQuerySchema,
  ListRecursosAdminQuerySchema,
  LoginRequestSchema,
  MessageResponseSchema,
  HomologacaoPublicacaoPreviewSchema,
  PayloadTooLargeResponseSchema,
  OptionalEditalIdQuerySchema,
  ParamsBodyValidationErrorResponseSchema,
  ParticipacaoListResponseSchema,
  PedidoIsencaoCriadoSchema,
  PedidoIsencaoListResponseSchema,
  PublicacaoListResponseSchema,
  PublicacaoModelSchema,
  PreviewPoliticasAfirmativasPublicacaoQuerySchema,
  PreviewClassificacaoPublicacaoQuerySchema,
  ResultadoPoliticasAfirmativasRequestSchema,
  PreviewHomologacaoPublicacaoQuerySchema,
  RecalcularClassificacaoRequestSchema,
  RecursoAdminListResponseSchema,
  RecursoIdParamSchema,
  RecursoListResponseSchema,
  RecursoModelSchema,
  RegisterRequestSchema,
  RegistrarPacoteDocumentalRequestSchema,
  ResultadoEtapa1RequestSchema,
  ResultadoEtapa2RequestSchema,
  SaveDraftRequestSchema,
  TooManyRequestsResponseSchema,
  UnauthorizedResponseSchema,
  ValidationErrorResponseSchema,
  DocumentoInscricaoModelSchema,
  AvaliacaoEtapa1ModelSchema,
  AvaliacaoEtapa2ModelSchema,
} from "./schemas.js";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Token JWT obtido em `/v1/auth/login` ou `/v1/auth/register`.",
});

const jsonContent = (schema: ZodTypeAny) => ({
  "application/json": {
    schema,
  },
});

const pdfContent = {
  "application/pdf": {
    schema: {
      type: "string",
      format: "binary",
    },
  },
} as const;

const bearerAuth = [{ bearerAuth: [] }];

function withAuthHeaders(request?: Record<string, unknown>) {
  return {
    ...request,
    headers: AuthorizationHeaderSchema,
  };
}

function withAuthDescription(description: string) {
  return `${description}\n\nAutenticacao: use o botao global Authorize ou preencha o header Authorization desta operacao com \`Bearer <token>\`.`;
}

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Sistema"],
  operationId: "getHealth",
  summary: "Verifica a saude do backend",
  description: "Executa um ping no banco e informa o estado operacional da API.",
  responses: {
    200: { description: "Backend e banco operacionais.", content: jsonContent(HealthOkSchema) },
    503: { description: "Backend ativo, mas banco indisponivel.", content: jsonContent(HealthDegradedSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/auth/register",
  tags: ["Autenticacao"],
  operationId: "registerCandidate",
  summary: "Cria conta de candidato",
  request: { body: { required: true, content: jsonContent(RegisterRequestSchema) } },
  responses: {
    201: { description: "Conta criada com token de acesso.", content: jsonContent(AuthResponseSchema) },
    400: { description: "Payload invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    409: { description: "E-mail ou CPF ja utilizado.", content: jsonContent(MessageResponseSchema) },
    413: { description: "Payload acima do limite permitido.", content: jsonContent(PayloadTooLargeResponseSchema) },
    429: { description: "Muitas tentativas consecutivas.", content: jsonContent(TooManyRequestsResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/auth/login",
  tags: ["Autenticacao"],
  operationId: "login",
  summary: "Autentica usuario",
  request: { body: { required: true, content: jsonContent(LoginRequestSchema) } },
  responses: {
    200: { description: "Login bem-sucedido.", content: jsonContent(AuthResponseSchema) },
    400: { description: "Payload invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Credenciais invalidas ou conta bloqueada.", content: jsonContent(UnauthorizedResponseSchema) },
    413: { description: "Payload acima do limite permitido.", content: jsonContent(PayloadTooLargeResponseSchema) },
    429: { description: "Muitas tentativas consecutivas.", content: jsonContent(TooManyRequestsResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/auth/me",
  tags: ["Autenticacao"],
  operationId: "getAuthenticatedUser",
  summary: "Retorna usuario autenticado",
  description: withAuthDescription("Resolve o usuario a partir do JWT recebido na requisicao."),
  security: bearerAuth,
  request: withAuthHeaders(),
  responses: {
    200: { description: "Usuario autenticado.", content: jsonContent(AuthenticatedUserSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Usuario nao encontrado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/candidato/participacoes",
  tags: ["Autenticacao"],
  operationId: "listUserParticipations",
  summary: "Lista participacoes do candidato por edital",
  description: withAuthDescription("Retorna o vinculo do candidato com cada edital em que participou."),
  security: bearerAuth,
  request: withAuthHeaders(),
  responses: {
    200: { description: "Participacoes retornadas com sucesso.", content: jsonContent(ParticipacaoListResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/candidato/area",
  tags: ["Area do Candidato"],
  operationId: "getCandidateDashboard",
  summary: "Retorna painel consolidado do candidato",
  description: withAuthDescription("Consolida edital, isencao, inscricao, homologacao, etapas, classificacao, recursos e publicacoes oficiais versionadas do edital."),
  security: bearerAuth,
  request: withAuthHeaders(),
  responses: {
    200: { description: "Painel consolidado por participacao.", content: jsonContent(CandidateDashboardListResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/editais",
  tags: ["Editais"],
  operationId: "listEditais",
  summary: "Lista editais",
  request: { query: ListEditaisQuerySchema },
  responses: {
    200: { description: "Editais retornados com sucesso.", content: jsonContent(EditalListResponseSchema) },
    400: { description: "Parametros de consulta invalidos.", content: jsonContent(ValidationErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/editais/{editalId}",
  tags: ["Editais"],
  operationId: "getEditalById",
  summary: "Retorna detalhe de um edital",
  request: { params: EditalIdParamSchema },
  responses: {
    200: { description: "Edital encontrado.", content: jsonContent(EditalDetalheSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/editais/{editalId}/isencao",
  tags: ["Isencao"],
  operationId: "createOrUpdatePedidoIsencao",
  summary: "Cria ou atualiza pedido de isencao",
  description: withAuthDescription("Registra ou sobrescreve o pedido de isencao do candidato dentro da janela configurada no edital."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    body: { required: true, content: jsonContent(CreateIsencaoRequestSchema) },
  }),
  responses: {
    201: { description: "Pedido registrado.", content: jsonContent(PedidoIsencaoCriadoSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Janela de isencao fechada.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/candidato/isencoes",
  tags: ["Isencao"],
  operationId: "listPedidosIsencaoDoUsuario",
  summary: "Lista pedidos de isencao do candidato",
  description: withAuthDescription("Lista todos os pedidos de isencao do candidato autenticado."),
  security: bearerAuth,
  request: withAuthHeaders(),
  responses: {
    200: { description: "Pedidos retornados com sucesso.", content: jsonContent(PedidoIsencaoListResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/editais/{editalId}/inscricao/rascunho",
  tags: ["Inscricao"],
  operationId: "saveInscricaoDraft",
  summary: "Cria ou atualiza rascunho de inscricao",
  description: withAuthDescription("Salva o rascunho da inscricao vinculado ao edital e ao candidato autenticado."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    body: { required: true, content: jsonContent(SaveDraftRequestSchema) },
  }),
  responses: {
    200: { description: "Rascunho salvo com sucesso.", content: jsonContent(InscricaoModelSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Inscricao nao editavel ou fora da janela.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/inscricoes/{inscricaoId}/documentos",
  tags: ["Inscricao"],
  operationId: "addDocumentoToInscricao",
  summary: "Anexa ou substitui documento da inscricao",
  description: withAuthDescription("Anexa documento PDF da inscricao, substituindo o tipo correspondente quando permitido."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(AddDocumentoRequestSchema) },
  }),
  responses: {
    201: { description: "Documento anexado.", content: jsonContent(DocumentoInscricaoModelSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Documento fora do padrao ou inscricao nao editavel.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/inscricoes/{inscricaoId}/submeter",
  tags: ["Inscricao"],
  operationId: "submitInscricao",
  summary: "Submete inscricao",
  description: withAuthDescription("Valida checklist documental e fecha a submissao da inscricao."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Inscricao submetida.", content: jsonContent(InscricaoModelSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Inscricao incompleta, nao editavel ou fora da janela.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/inscricoes/{inscricaoId}/cancelar-submissao",
  tags: ["Inscricao"],
  operationId: "cancelInscricaoSubmission",
  summary: "Cancela submissao para voltar ao rascunho",
  description: withAuthDescription("Reabre a inscricao para edicao enquanto a janela do edital permanecer aberta."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Submissao cancelada.", content: jsonContent(InscricaoModelSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Inscricao nao cancelavel ou fora da janela.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/candidato/inscricoes",
  tags: ["Inscricao"],
  operationId: "listInscricoesDoUsuario",
  summary: "Lista inscricoes do candidato",
  description: withAuthDescription("Retorna as inscricoes do candidato autenticado com resumo do edital e da ficha."),
  security: bearerAuth,
  request: withAuthHeaders(),
  responses: {
    200: { description: "Inscricoes retornadas com sucesso.", content: jsonContent(InscricaoListResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
  },
});

for (const route of [
  {
    path: "/v1/inscricoes/{inscricaoId}/anexo-iv",
    tag: "Inscricao",
    operationId: "getInscricaoAnexoIvForCandidate",
    summary: "Baixa Anexo IV flattened do candidato",
    security: bearerAuth,
  },
  {
    path: "/v1/admin/inscricoes/{inscricaoId}/anexo-iv",
    tag: "Inscricao",
    operationId: "getInscricaoAnexoIvForAdmin",
    summary: "Baixa Anexo IV preenchido para uso administrativo",
    security: bearerAuth,
  },
  {
    path: "/v1/admin/inscricoes/{inscricaoId}/anexo-iv/flatten",
    tag: "Inscricao",
    operationId: "getInscricaoAnexoIvFlattenForAdmin",
    summary: "Baixa Anexo IV flattened para uso administrativo",
    security: bearerAuth,
  },
]) {
  registry.registerPath({
    method: "get",
    path: route.path,
    tags: [route.tag],
    operationId: route.operationId,
    summary: route.summary,
    description: withAuthDescription(route.summary),
    security: route.security,
    request: withAuthHeaders({ params: InscricaoIdParamSchema }),
    responses: {
      200: { description: "Arquivo PDF gerado com sucesso.", content: pdfContent },
      400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
      401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
      403: { description: "Acesso restrito ao papel exigido.", content: jsonContent(MessageResponseSchema) },
      404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
      409: { description: "Arquivo indisponivel no estado atual.", content: jsonContent(MessageResponseSchema) },
    },
  });
}

registry.registerPath({
  method: "post",
  path: "/v1/admin/inscricoes/{inscricaoId}/pacote-documental",
  tags: ["Inscricao"],
  operationId: "registrarPacoteDocumentalConsolidado",
  summary: "Registra pacote documental consolidado da inscricao",
  description: withAuthDescription("Registra o arquivo PDF consolidado da inscricao e congela um snapshot auditavel da versao submetida."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(RegistrarPacoteDocumentalRequestSchema) },
  }),
  responses: {
    201: { description: "Pacote documental consolidado registrado.", content: jsonContent(PacoteDocumentalResumoSchema) },
    400: { description: "Dados invalidos do pacote documental.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Inscricao nao submetida ou pacote fora do padrao PDF.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/inscricoes/{inscricaoId}/pacote-documental",
  tags: ["Inscricao"],
  operationId: "getPacoteDocumentalDaInscricao",
  summary: "Consulta pacote documental da inscricao do candidato",
  description: withAuthDescription("Retorna os metadados do pacote documental consolidado e o snapshot auditavel associado."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
  }),
  responses: {
    200: { description: "Pacote documental retornado.", content: jsonContent(PacoteDocumentalDetalheResponseSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Pacote documental ainda nao gerado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/inscricoes/{inscricaoId}/pacote-documental",
  tags: ["Inscricao"],
  operationId: "getPacoteDocumentalDaInscricaoAdmin",
  summary: "Consulta pacote documental da inscricao no contexto administrativo",
  description: withAuthDescription("Retorna os metadados do pacote documental consolidado e o snapshot auditavel da inscricao para uso administrativo."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
  }),
  responses: {
    200: { description: "Pacote documental retornado.", content: jsonContent(PacoteDocumentalDetalheResponseSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Pacote documental ainda nao gerado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/homologacao/fundamentos",
  tags: ["Homologacao"],
  operationId: "listFundamentosHomologacao",
  summary: "Lista fundamentos padrao de homologacao",
  description: withAuthDescription("Retorna o catalogo administrativo de fundamentos estruturados usados na homologacao."),
  security: bearerAuth,
  request: withAuthHeaders(),
  responses: {
    200: { description: "Catalogo de fundamentos administrativos.", content: jsonContent(HomologacaoFundamentosListResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/inscricoes",
  tags: ["Homologacao"],
  operationId: "listInscricoesParaHomologacao",
  summary: "Lista inscricoes para homologacao",
  description: withAuthDescription("Lista inscricoes com documentos, snapshots, estado de homologacao e confirmacoes operacionais de reserva para analise administrativa."),
  security: bearerAuth,
  request: withAuthHeaders({ query: OptionalEditalIdQuerySchema }),
  responses: {
    200: { description: "Inscricoes listadas para analise documental.", content: jsonContent(HomologacaoAdminListResponseSchema) },
    400: { description: "Filtro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/admin/inscricoes/{inscricaoId}/confirmacao-reserva",
  tags: ["Homologacao"],
  operationId: "atualizarConfirmacaoReserva",
  summary: "Atualiza confirmacao operacional de reserva",
  description: withAuthDescription("Registra a confirmacao operacional de acoes afirmativas e/ou PCD para uso na distribuicao final de vagas reservadas."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(ConfirmacaoReservaRequestSchema) },
  }),
  responses: {
    200: { description: "Confirmacao operacional atualizada.", content: jsonContent(ConfirmacaoReservaResumoSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/editais/{editalId}/politicas-afirmativas",
  tags: ["PoliticasAfirmativas"],
  operationId: "listPoliticasAfirmativasByEdital",
  summary: "Lista a etapa de politicas afirmativas do edital",
  description: withAuthDescription("Lista inscricoes reservadas com documentos, encaminhamento a comissao externa da UFAM e resultados preliminar/final da etapa de politicas afirmativas."),
  security: bearerAuth,
  request: withAuthHeaders({ params: EditalIdParamSchema }),
  responses: {
    200: { description: "Etapa listada com sucesso.", content: jsonContent(PoliticasAfirmativasAdminListResponseSchema) },
    400: { description: "Edital invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/admin/inscricoes/{inscricaoId}/politicas-afirmativas/encaminhamento",
  tags: ["PoliticasAfirmativas"],
  operationId: "registrarEncaminhamentoPoliticasAfirmativas",
  summary: "Registra encaminhamento para a comissao externa",
  description: withAuthDescription("Registra convocacao e encaminhamento documental da etapa de politicas afirmativas para a comissao de heteroidentificacao/PCD da UFAM."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(EncaminhamentoPoliticasAfirmativasRequestSchema) },
  }),
  responses: {
    200: { description: "Encaminhamento registrado.", content: jsonContent(PoliticasAfirmativasResumoSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Etapa nao encontrada para a inscricao.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/admin/inscricoes/{inscricaoId}/politicas-afirmativas/resultado-preliminar",
  tags: ["PoliticasAfirmativas"],
  operationId: "registrarResultadoPreliminarPoliticasAfirmativas",
  summary: "Registra resultado preliminar da etapa",
  description: withAuthDescription("Registra o resultado preliminar devolvido pela comissao externa da UFAM para a etapa de politicas afirmativas."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(ResultadoPoliticasAfirmativasRequestSchema) },
  }),
  responses: {
    200: { description: "Resultado preliminar registrado.", content: jsonContent(PoliticasAfirmativasResumoSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Etapa nao encontrada para a inscricao.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/admin/inscricoes/{inscricaoId}/politicas-afirmativas/resultado-final",
  tags: ["PoliticasAfirmativas"],
  operationId: "registrarResultadoFinalPoliticasAfirmativas",
  summary: "Registra resultado final da etapa",
  description: withAuthDescription("Registra o resultado final devolvido pela comissao externa da UFAM para a etapa de politicas afirmativas e sincroniza o efeito na ocupacao de vagas reservadas."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(ResultadoPoliticasAfirmativasRequestSchema) },
  }),
  responses: {
    200: { description: "Resultado final registrado.", content: jsonContent(PoliticasAfirmativasResumoSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Etapa nao encontrada para a inscricao.", content: jsonContent(MessageResponseSchema) },
  },
});

for (const phase of [
  { suffix: "preliminar", operationId: "registrarHomologacaoPreliminar", summary: "Registra homologacao preliminar" },
  { suffix: "final", operationId: "registrarHomologacaoFinal", summary: "Registra homologacao final" },
]) {
  registry.registerPath({
    method: "put",
    path: `/v1/admin/inscricoes/{inscricaoId}/homologacao/${phase.suffix}`,
    tags: ["Homologacao"],
    operationId: phase.operationId,
    summary: phase.summary,
    description: withAuthDescription(`${phase.summary} com parecer e fundamentos vinculados ao edital.`),
    security: bearerAuth,
    request: withAuthHeaders({
      params: InscricaoIdParamSchema,
      body: { required: true, content: jsonContent(HomologacaoDecisionRequestSchema) },
    }),
    responses: {
      200: { description: "Decisao registrada com sucesso.", content: jsonContent(HomologacaoInscricaoModelSchema) },
      400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
      401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
      403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
      404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
      409: { description: "Inscricao fora do estado esperado para homologacao.", content: jsonContent(ConflictErrorResponseSchema) },
    },
  });
}

registry.registerPath({
  method: "get",
  path: "/v1/admin/etapa-1/inscricoes",
  tags: ["Etapa 1"],
  operationId: "listInscricoesParaEtapa1",
  summary: "Lista inscricoes elegiveis para etapa 1",
  description: withAuthDescription("Lista inscricoes aptas para lancamento ou revisao da avaliacao da etapa 1."),
  security: bearerAuth,
  request: withAuthHeaders({ query: OptionalEditalIdQuerySchema }),
  responses: {
    200: { description: "Inscricoes da etapa 1 retornadas.", content: jsonContent(Etapa1ListResponseSchema) },
    400: { description: "Filtro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/admin/etapa-1/inscricoes/{inscricaoId}/resultado",
  tags: ["Etapa 1"],
  operationId: "registrarResultadoEtapa1",
  summary: "Registra resultado da etapa 1",
  description: withAuthDescription("Registra rubrica oficial, nota calculada, espelho e situacao preliminar ou final da etapa 1."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(ResultadoEtapa1RequestSchema) },
  }),
  responses: {
    200: { description: "Resultado registrado.", content: jsonContent(AvaliacaoEtapa1ModelSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Inscricao nao apta para etapa 1.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/inscricoes/{inscricaoId}/etapa-1/espelho/solicitar",
  tags: ["Etapa 1"],
  operationId: "solicitarEspelhoEtapa1",
  summary: "Solicita espelho da etapa 1",
  description: withAuthDescription("Permite ao candidato solicitar o espelho da etapa 1 apos publicacao preliminar."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Solicitacao registrada.", content: jsonContent(AvaliacaoEtapa1ModelSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Resultado preliminar ainda nao publicado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/admin/inscricoes/{inscricaoId}/etapa-1/espelho/liberar",
  tags: ["Etapa 1"],
  operationId: "liberarEspelhoEtapa1",
  summary: "Libera espelho da etapa 1",
  description: withAuthDescription("Libera o espelho da etapa 1 para visualizacao do candidato."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Espelho liberado.", content: jsonContent(AvaliacaoEtapa1ModelSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Espelho indisponivel para liberacao.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/inscricoes/{inscricaoId}/etapa-1/espelho",
  tags: ["Etapa 1"],
  operationId: "getEspelhoEtapa1ForCandidate",
  summary: "Consulta espelho liberado da etapa 1",
  description: withAuthDescription("Retorna o espelho estruturado da etapa 1 somente quando ja liberado ao candidato."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Espelho estruturado da etapa 1 retornado.", content: jsonContent(Etapa1EspelhoSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Espelho indisponivel ou ainda nao liberado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/inscricoes/{inscricaoId}/etapa-1/espelho",
  tags: ["Etapa 1"],
  operationId: "getEspelhoEtapa1ForAdmin",
  summary: "Consulta espelho administrativo da etapa 1",
  description: withAuthDescription("Retorna o espelho estruturado da etapa 1 no contexto administrativo, independentemente da liberacao ao candidato."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Espelho estruturado da etapa 1 retornado.", content: jsonContent(Etapa1EspelhoSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Espelho indisponivel para a inscricao.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/etapa-2/inscricoes",
  tags: ["Etapa 2"],
  operationId: "listInscricoesParaEtapa2",
  summary: "Lista inscricoes elegiveis para etapa 2",
  description: withAuthDescription("Lista inscricoes aptas para lancamento ou revisao da avaliacao curricular."),
  security: bearerAuth,
  request: withAuthHeaders({ query: OptionalEditalIdQuerySchema }),
  responses: {
    200: { description: "Inscricoes da etapa 2 retornadas.", content: jsonContent(Etapa2ListResponseSchema) },
    400: { description: "Filtro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/admin/etapa-2/inscricoes/{inscricaoId}/resultado",
  tags: ["Etapa 2"],
  operationId: "registrarResultadoEtapa2",
  summary: "Registra resultado da etapa 2",
  description: withAuthDescription("Registra pontuacao, espelho e situacao preliminar ou final da etapa 2."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: InscricaoIdParamSchema,
    body: { required: true, content: jsonContent(ResultadoEtapa2RequestSchema) },
  }),
  responses: {
    200: { description: "Resultado registrado.", content: jsonContent(AvaliacaoEtapa2ModelSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Inscricao nao apta para etapa 2.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/inscricoes/{inscricaoId}/etapa-2/espelho/solicitar",
  tags: ["Etapa 2"],
  operationId: "solicitarEspelhoEtapa2",
  summary: "Solicita espelho da etapa 2",
  description: withAuthDescription("Permite ao candidato solicitar o espelho da etapa 2 apos publicacao preliminar."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Solicitacao registrada.", content: jsonContent(AvaliacaoEtapa2ModelSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Resultado preliminar ainda nao publicado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/admin/inscricoes/{inscricaoId}/etapa-2/espelho/liberar",
  tags: ["Etapa 2"],
  operationId: "liberarEspelhoEtapa2",
  summary: "Libera espelho da etapa 2",
  description: withAuthDescription("Libera o espelho da etapa 2 para visualizacao do candidato."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Espelho liberado.", content: jsonContent(AvaliacaoEtapa2ModelSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Espelho indisponivel para liberacao.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/inscricoes/{inscricaoId}/etapa-2/espelho",
  tags: ["Etapa 2"],
  operationId: "getEspelhoEtapa2ForCandidate",
  summary: "Consulta espelho liberado da etapa 2",
  description: withAuthDescription("Retorna o espelho estruturado da etapa 2 somente quando ja liberado ao candidato."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Espelho estruturado da etapa 2 retornado.", content: jsonContent(Etapa2EspelhoSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Espelho indisponivel ou ainda nao liberado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/inscricoes/{inscricaoId}/etapa-2/espelho",
  tags: ["Etapa 2"],
  operationId: "getEspelhoEtapa2ForAdmin",
  summary: "Consulta espelho administrativo da etapa 2",
  description: withAuthDescription("Retorna o espelho estruturado da etapa 2 no contexto administrativo, independentemente da liberacao ao candidato."),
  security: bearerAuth,
  request: withAuthHeaders({ params: InscricaoIdParamSchema }),
  responses: {
    200: { description: "Espelho estruturado da etapa 2 retornado.", content: jsonContent(Etapa2EspelhoSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito a admin ou avaliador.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Inscricao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Espelho indisponivel para a inscricao.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/editais/{editalId}/classificacao",
  tags: ["Classificacao"],
  operationId: "listClassificacao",
  summary: "Lista classificacao por edital",
  description: withAuthDescription("Lista a classificacao atual por edital, com posicao geral, por linha e modalidade de concorrencia."),
  security: bearerAuth,
  request: withAuthHeaders({ params: EditalIdParamSchema }),
  responses: {
    200: { description: "Classificacao retornada com sucesso.", content: jsonContent(ClassificacaoListResponseSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/admin/editais/{editalId}/classificacao/recalcular",
  tags: ["Classificacao"],
  operationId: "recalcularClassificacao",
  summary: "Recalcula classificacao do edital",
  description: withAuthDescription("Recalcula a classificacao preliminar ou final do edital aplicando NF, desempate operacional e distribuicao de vagas por linha e modalidade."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    body: { required: true, content: jsonContent(RecalcularClassificacaoRequestSchema) },
  }),
  responses: {
    200: { description: "Classificacao recalculada com sucesso.", content: jsonContent(ClassificacaoListResponseSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/editais/{editalId}/publicacoes/classificacao/preview",
  tags: ["Publicacoes"],
  operationId: "buildClassificacaoPublicacaoPreview",
  summary: "Previsualiza publicacao da classificacao",
  description: withAuthDescription("Gera o preview auditavel da publicacao de classificacao preliminar ou final a partir do snapshot atual da classificacao, informando a proxima versao e eventual republicacao encadeada."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    query: PreviewClassificacaoPublicacaoQuerySchema,
  }),
  responses: {
    200: { description: "Preview da publicacao de classificacao gerado.", content: jsonContent(ClassificacaoPublicacaoPreviewSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Classificacao ausente ou incompleta para a fase solicitada.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/editais/{editalId}/publicacoes/politicas-afirmativas/preview",
  tags: ["Publicacoes"],
  operationId: "buildPoliticasAfirmativasPublicacaoPreview",
  summary: "Previsualiza publicacao da etapa de politicas afirmativas",
  description: withAuthDescription("Gera o preview auditavel da publicacao preliminar ou final da etapa de politicas afirmativas a partir do retorno registrado da comissao externa da UFAM."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    query: PreviewPoliticasAfirmativasPublicacaoQuerySchema,
  }),
  responses: {
    200: { description: "Preview da etapa gerado.", content: jsonContent(PoliticasAfirmativasPublicacaoPreviewSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Etapa sem dados ou incompleta para a fase solicitada.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/admin/editais/{editalId}/publicacoes/classificacao",
  tags: ["Publicacoes"],
  operationId: "createClassificacaoPublicacao",
  summary: "Publica classificacao oficial",
  description: withAuthDescription("Cria a publicacao oficial da classificacao preliminar ou final, preservando o snapshot consolidado no momento da publicacao com versionamento e encadeamento explicito de republicacao."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    body: { required: true, content: jsonContent(CreateClassificacaoPublicacaoRequestSchema) },
  }),
  responses: {
    201: { description: "Publicacao da classificacao criada.", content: jsonContent(CreateClassificacaoPublicacaoResponseSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Classificacao ausente ou incompleta para publicacao.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/admin/editais/{editalId}/publicacoes/politicas-afirmativas",
  tags: ["Publicacoes"],
  operationId: "createPoliticasAfirmativasPublicacao",
  summary: "Publica resultado oficial da etapa de politicas afirmativas",
  description: withAuthDescription("Cria a publicacao oficial preliminar ou final da etapa de politicas afirmativas, preservando o snapshot consolidado e versionado do retorno da comissao externa da UFAM."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    body: { required: true, content: jsonContent(CreatePoliticasAfirmativasPublicacaoRequestSchema) },
  }),
  responses: {
    201: { description: "Publicacao criada.", content: jsonContent(CreatePoliticasAfirmativasPublicacaoResponseSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Etapa sem dados ou incompleta para publicacao.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/candidato/recursos",
  tags: ["Recursos"],
  operationId: "createRecurso",
  summary: "Cria recurso administrativo do candidato",
  description: withAuthDescription("Registra recurso do candidato dentro da janela da fase correspondente."),
  security: bearerAuth,
  request: withAuthHeaders({ body: { required: true, content: jsonContent(CreateRecursoRequestSchema) } }),
  responses: {
    201: { description: "Recurso criado.", content: jsonContent(RecursoModelSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    404: { description: "Participacao nao encontrada.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Janela fechada, duplicidade ou ausencia de resultado preliminar.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/candidato/recursos",
  tags: ["Recursos"],
  operationId: "listRecursosDoUsuario",
  summary: "Lista recursos do candidato",
  description: withAuthDescription("Lista os recursos do candidato autenticado."),
  security: bearerAuth,
  request: withAuthHeaders(),
  responses: {
    200: { description: "Recursos retornados com sucesso.", content: jsonContent(RecursoListResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/recursos",
  tags: ["Recursos"],
  operationId: "listRecursosAdmin",
  summary: "Lista recursos para administracao",
  description: withAuthDescription("Lista os recursos administrativos por edital e fase."),
  security: bearerAuth,
  request: withAuthHeaders({ query: ListRecursosAdminQuerySchema }),
  responses: {
    200: { description: "Recursos retornados com sucesso.", content: jsonContent(RecursoAdminListResponseSchema) },
    400: { description: "Filtro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "put",
  path: "/v1/admin/recursos/{recursoId}/decisao",
  tags: ["Recursos"],
  operationId: "decidirRecurso",
  summary: "Registra decisao administrativa do recurso",
  description: withAuthDescription("Registra decisao final do recurso e, quando deferido com impacto, reprocessa resultados derivados e republica snapshots administrativos aplicaveis."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: RecursoIdParamSchema,
    body: { required: true, content: jsonContent(DecidirRecursoRequestSchema) },
  }),
  responses: {
    200: { description: "Recurso atualizado.", content: jsonContent(RecursoModelSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Recurso nao encontrado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/editais/{editalId}/publicacoes",
  tags: ["Publicacoes"],
  operationId: "listPublicacoesByEdital",
  summary: "Lista publicacoes oficiais do edital",
  request: { params: EditalIdParamSchema },
  responses: {
    200: { description: "Publicacoes retornadas com sucesso.", content: jsonContent(PublicacaoListResponseSchema) },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/publicacoes/{publicacaoId}/arquivo.pdf",
  tags: ["Publicacoes"],
  operationId: "downloadPublicacaoPdf",
  summary: "Gera PDF oficial da publicacao",
  description: "Gera o PDF oficial de forma deterministica a partir do snapshot salvo em `dadosConsolidados`.",
  request: {
    params: PublicacaoIdParamSchema,
  },
  responses: {
    200: { description: "Arquivo PDF gerado com sucesso.", content: pdfContent },
    400: { description: "Parametro invalido.", content: jsonContent(ValidationErrorResponseSchema) },
    404: { description: "Publicacao nao encontrada.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/admin/editais/{editalId}/publicacoes",
  tags: ["Publicacoes"],
  operationId: "createPublicacao",
  summary: "Cria publicacao oficial",
  description: withAuthDescription("Cria publicacao oficial vinculada ao edital, com titulo, tipo e arquivo opcional."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    body: { required: true, content: jsonContent(CreatePublicacaoRequestSchema) },
  }),
  responses: {
    201: { description: "Publicacao criada.", content: jsonContent(PublicacaoModelSchema) },
    400: { description: "Dados invalidos.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/v1/admin/editais/{editalId}/publicacoes/homologacao/preview",
  tags: ["Publicacoes", "Homologacao"],
  operationId: "buildHomologacaoPublicacaoPreview",
  summary: "Gera preview da publicacao de homologacao",
  description: withAuthDescription("Consolida o resultado preliminar ou final da homologacao em payload auditavel antes da publicacao oficial, informando a proxima versao e eventual republicacao encadeada."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    query: PreviewHomologacaoPublicacaoQuerySchema,
  }),
  responses: {
    200: { description: "Preview consolidado da homologacao.", content: jsonContent(HomologacaoPublicacaoPreviewSchema) },
    400: { description: "Dados invalidos para gerar o preview.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Homologacao incompleta ou sem dados suficientes para a fase informada.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/v1/admin/editais/{editalId}/publicacoes/homologacao",
  tags: ["Publicacoes", "Homologacao"],
  operationId: "createHomologacaoPublicacao",
  summary: "Cria publicacao oficial da homologacao",
  description: withAuthDescription("Congela em `dadosConsolidados` o preview auditavel da homologacao preliminar ou final e cria a publicacao oficial correspondente com versionamento e encadeamento explicito de republicacao."),
  security: bearerAuth,
  request: withAuthHeaders({
    params: EditalIdParamSchema,
    body: { required: true, content: jsonContent(CreateHomologacaoPublicacaoRequestSchema) },
  }),
  responses: {
    201: { description: "Publicacao oficial de homologacao criada.", content: jsonContent(CreateHomologacaoPublicacaoResponseSchema) },
    400: { description: "Dados invalidos para a publicacao.", content: jsonContent(ParamsBodyValidationErrorResponseSchema) },
    401: { description: "Token ausente ou invalido.", content: jsonContent(UnauthorizedResponseSchema) },
    403: { description: "Acesso restrito ao papel admin.", content: jsonContent(MessageResponseSchema) },
    404: { description: "Edital nao encontrado.", content: jsonContent(MessageResponseSchema) },
    409: { description: "Homologacao incompleta ou sem dados suficientes para a fase informada.", content: jsonContent(ConflictErrorResponseSchema) },
  },
});

export const openApiDocument = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: "3.0.3",
  info: {
    title: "API Sistema de Selecao Pos-Graduacao PPGEE/UFAM",
    version: "0.1.0",
    description:
      "Documentacao completa da API backend do processo seletivo stricto sensu do PPGEE/UFAM, com foco em fluxos multi-edital, autenticacao, inscricao, homologacao, recursos, avaliacao e publicacoes.\n\nGuia rapido de autenticacao:\n1. Execute `/v1/auth/login` ou `/v1/auth/register`.\n2. Copie o valor de `token` retornado.\n3. Clique em `Authorize` no topo da UI e informe o JWT.\n4. Se preferir testar por operacao, preencha o campo `Authorization` visivel nas rotas protegidas com `Bearer <token>`.\n5. Reexecute a chamada protegida.",
    contact: {
      name: "PPGEE/UFAM",
      email: "ppgee@ufam.edu.br",
    },
  },
  servers: [
    {
      url: "/",
      description: "Servidor atual",
    },
    {
      url: "http://localhost:4000",
      description: "Desenvolvimento local",
    },
  ],
  security: bearerAuth,
  tags: [
    { name: "Sistema", description: "Operacao e monitoramento do backend." },
    { name: "Autenticacao", description: "Cadastro, login e leitura de identidade autenticada." },
    { name: "Area do Candidato", description: "Painel consolidado do candidato por participacao em edital." },
    { name: "Editais", description: "Consulta publica de editais, linhas e cronogramas." },
    { name: "Isencao", description: "Fluxo de solicitacao e acompanhamento de isencao da taxa." },
    { name: "Inscricao", description: "Rascunho, anexos, submissao, download de Anexo IV e consulta de inscricoes." },
    { name: "Homologacao", description: "Analise documental administrativa com fundamentos estruturados e estados preliminar/final." },
    { name: "Etapa 1", description: "Lancamento e consulta da avaliacao da redacao tecnica objetiva." },
    { name: "Etapa 2", description: "Lancamento e consulta da analise curricular." },
    { name: "Classificacao", description: "Recalculo e consulta da classificacao final por edital." },
    { name: "Recursos", description: "Criacao e decisao administrativa de recursos." },
    { name: "Publicacoes", description: "Criacao administrativa e consulta publica de publicacoes oficiais." },
  ],
});
