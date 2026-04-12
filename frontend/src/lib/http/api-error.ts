export type ApiValidationErrors = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

type ApiErrorPayload = {
  code?: string;
  message?: string;
  errors?: ApiValidationErrors;
  paramsErrors?: ApiValidationErrors;
  queryErrors?: ApiValidationErrors;
  bodyErrors?: ApiValidationErrors;
  details?: string[];
  checklist?: unknown[];
};

export class ApiError extends Error {
  status: number;
  code: string;
  payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message ?? "Falha na requisicao.");
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code ?? "UNKNOWN_ERROR";
    this.payload = payload;
  }
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Falha inesperada na requisicao.";
}

export function getApiValidationMap(error: unknown) {
  if (!(error instanceof ApiError)) {
    return {} as Record<string, string[]>;
  }

  return {
    ...(error.payload.errors?.fieldErrors ?? {}),
    ...(error.payload.paramsErrors?.fieldErrors ?? {}),
    ...(error.payload.queryErrors?.fieldErrors ?? {}),
    ...(error.payload.bodyErrors?.fieldErrors ?? {}),
  };
}

export function getFirstFieldError(error: unknown, field: string) {
  const map = getApiValidationMap(error);
  const value = map[field];
  return Array.isArray(value) && value.length > 0 ? value[0] : null;
}

export function pickFirstFieldErrors<T extends string>(error: unknown, fields: readonly T[]) {
  return Object.fromEntries(fields.map((field) => [field, getFirstFieldError(error, field)])) as Record<T, string | null>;
}

export function getFirstFormError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const candidates = [
    ...(error.payload.errors?.formErrors ?? []),
    ...(error.payload.paramsErrors?.formErrors ?? []),
    ...(error.payload.queryErrors?.formErrors ?? []),
    ...(error.payload.bodyErrors?.formErrors ?? []),
  ];

  return candidates[0] ?? null;
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
