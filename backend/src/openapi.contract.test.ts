import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/selecao_posgrad?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-real-environments";

const { app } = await import("./app.js");
const { openApiDocument } = await import("./docs/openapi/document.js");

type ExpressRoute = {
  path: string | RegExp;
  methods: Record<string, boolean>;
};

type ExpressLayer = {
  route?: ExpressRoute;
  handle?: { stack?: ExpressLayer[] };
};

function normalizeExpressPath(path: string | RegExp) {
  if (path instanceof RegExp) return path.toString();
  return path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

function collectRoutes(layers: ExpressLayer[] | undefined): Array<{ method: string; path: string }> {
  if (!layers) return [];

  return layers.flatMap((layer) => {
    if (layer.route) {
      return Object.entries(layer.route.methods)
        .filter(([, enabled]) => enabled)
        .map(([method]) => ({ method: method.toLowerCase(), path: normalizeExpressPath(layer.route!.path) }));
    }

    return collectRoutes(layer.handle?.stack);
  });
}

test("contrato OpenAPI cobre rotas criticas registradas no Express", () => {
  const router = (app as unknown as { _router?: { stack?: ExpressLayer[] } })._router;
  const registered = new Set(collectRoutes(router?.stack).map((route) => `${route.method.toUpperCase()} ${route.path}`));

  const criticalRoutes = [
    { method: "get", path: "/health", statuses: [200, 503] },
    { method: "post", path: "/v1/auth/register", statuses: [201, 400, 409] },
    { method: "post", path: "/v1/auth/login", statuses: [200, 400, 401] },
    { method: "post", path: "/v1/auth/refresh", statuses: [200, 401, 403] },
    { method: "post", path: "/v1/auth/logout", statuses: [204, 403] },
    { method: "post", path: "/v1/editais/{editalId}/isencao", statuses: [201, 400, 409] },
    { method: "put", path: "/v1/editais/{editalId}/inscricao/rascunho", statuses: [200, 400, 409] },
    { method: "post", path: "/v1/inscricoes/{inscricaoId}/documentos", statuses: [201, 400, 409] },
    { method: "post", path: "/v1/inscricoes/{inscricaoId}/submeter", statuses: [200, 400, 409] },
    { method: "put", path: "/v1/admin/etapa-1/inscricoes/{inscricaoId}/resultado", statuses: [200, 400, 409] },
    { method: "put", path: "/v1/admin/etapa-2/inscricoes/{inscricaoId}/resultado", statuses: [200, 400, 409] },
    { method: "post", path: "/v1/candidato/recursos", statuses: [201, 400, 409] },
    { method: "put", path: "/v1/admin/recursos/{recursoId}/decisao", statuses: [200, 400, 409] },
  ] as const;

  for (const route of criticalRoutes) {
    assert.equal(registered.has(`${route.method.toUpperCase()} ${route.path}`), true, `rota Express ausente: ${route.method.toUpperCase()} ${route.path}`);

    const pathItem = openApiDocument.paths?.[route.path];
    assert.ok(pathItem, `path ausente no OpenAPI: ${route.path}`);

    const operation = pathItem?.[route.method];
    assert.ok(operation, `metodo ausente no OpenAPI: ${route.method.toUpperCase()} ${route.path}`);

    const responses = operation?.responses ?? {};
    for (const status of route.statuses) {
      assert.ok(String(status) in responses, `status ${status} ausente no OpenAPI: ${route.method.toUpperCase()} ${route.path}`);
    }
  }
});
