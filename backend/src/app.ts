import "express-async-errors";

import cors from "cors";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env.js";
import { openApiDocument } from "./docs/openapi/document.js";
import { payloadTooLarge, tooManyRequests, validationError } from "./lib/http-errors.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { candidatoAreaRouter } from "./modules/candidato/candidato-area.routes.js";
import { classificacaoRouter } from "./modules/classificacao/classificacao.routes.js";
import { editalRouter } from "./modules/edital/edital.routes.js";
import { etapa1Router } from "./modules/etapa1/etapa1.routes.js";
import { etapa2Router } from "./modules/etapa2/etapa2.routes.js";
import { homologacaoRouter } from "./modules/homologacao/homologacao.routes.js";
import { inscricaoRouter } from "./modules/inscricao/inscricao.routes.js";
import { isencaoRouter } from "./modules/isencao/isencao.routes.js";
import { publicacaoRouter } from "./modules/publicacao/publicacao.routes.js";
import { politicasAfirmativasRouter } from "./modules/politicas-afirmativas/politicas-afirmativas.routes.js";
import { recursoRouter } from "./modules/recurso/recurso.routes.js";
import { uploadRouter } from "./modules/upload/upload.routes.js";
import { usuarioAdminRouter } from "./modules/usuario-admin/usuario-admin.routes.js";
import { healthRouter } from "./routes/health.routes.js";

export const app = express();

const jsonBodyLimit = "1mb";
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (request) => {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "anon";
    return `${ipKeyGenerator(request.ip ?? "")}:${request.path}:${email}`;
  },
  message: {
    ...tooManyRequests("Muitas tentativas consecutivas. Tente novamente em instantes."),
  },
});

const expensiveRouteRateLimitMax = env.NODE_ENV === "production" ? 30 : 1000;

const expensiveRouteRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: expensiveRouteRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (request) => `${ipKeyGenerator(request.ip ?? "")}:${request.path}`,
  message: {
    ...tooManyRequests("Muitas operacoes custosas em sequencia. Tente novamente em instantes."),
  },
});

app.disable("x-powered-by");
// Mantemos a CSP desabilitada aqui para preservar o Swagger UI operacional em /docs.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: jsonBodyLimit }));
app.use("/v1/auth/login", authRateLimiter);
app.use("/v1/auth/register", authRateLimiter);
app.use("/v1/auth/password-reset/request", authRateLimiter);
app.use("/v1/auth/email-verification/request", expensiveRouteRateLimiter);
app.use("/v1/uploads", expensiveRouteRateLimiter);
app.use(/\/v1\/publicacoes\/.*\/arquivo\.pdf$/, expensiveRouteRateLimiter);
app.use(/\/v1\/inscricoes\/.*\/anexo-iv/, expensiveRouteRateLimiter);
app.use(/\/v1\/admin\/inscricoes\/.*\/anexo-iv/, expensiveRouteRateLimiter);

app.get("/docs/openapi.json", (_request, response) => {
  response.status(200).json(openApiDocument);
});

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "PPGEE/UFAM API Docs",
    customCss: `
      .swagger-ui .topbar { border-bottom: 4px solid #0f766e; }
      .swagger-ui .topbar-wrapper::after {
        content: "Use Authorize ou o campo Authorization em cada rota protegida.";
        color: #e6fffb;
        font-size: 12px;
        margin-left: 16px;
        white-space: nowrap;
      }
      .swagger-ui .auth-wrapper .authorize {
        background: #0f766e;
        border-color: #0f766e;
        color: #fff;
      }
      .swagger-ui .opblock.opblock-get .opblock-summary { border-color: #0ea5e9; }
      .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #16a34a; }
      .swagger-ui .opblock.opblock-put .opblock-summary { border-color: #f59e0b; }
      .swagger-ui .information-container .markdown p code,
      .swagger-ui .opblock-description-wrapper code { background: #f1f5f9; padding: 2px 4px; border-radius: 4px; }
    `,
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true,
      tryItOutEnabled: true,
      filter: true,
      deepLinking: true,
      displayOperationId: true,
      displayRequestDuration: true,
      docExpansion: "list",
      defaultModelExpandDepth: 3,
      defaultModelsExpandDepth: 2,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  }),
);

app.use(healthRouter);
app.use(authRouter);
app.use(candidatoAreaRouter);
app.use(classificacaoRouter);
app.use(editalRouter);
app.use(etapa1Router);
app.use(etapa2Router);
app.use(homologacaoRouter);
app.use(isencaoRouter);
app.use(inscricaoRouter);
app.use(publicacaoRouter);
app.use(politicasAfirmativasRouter);
app.use(recursoRouter);
app.use(uploadRouter);
app.use(usuarioAdminRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  if (error instanceof SyntaxError && "body" in error) {
    return response.status(400).json(validationError("JSON invalido.", { formErrors: ["Corpo JSON malformado."], fieldErrors: {} }));
  }

  if (typeof error === "object" && error && "type" in error && error.type === "entity.too.large") {
    return response.status(413).json(payloadTooLarge("Payload excede o limite permitido."));
  }

  if (typeof error === "object" && error && "code" in error && error.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json(payloadTooLarge("Arquivo excede o limite permitido de upload."));
  }

  console.error("[ERROR_HANDLER]", error);
  return response.status(500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: "Erro interno do servidor.",
  });
});
