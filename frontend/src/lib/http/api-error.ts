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

function normalizeFieldErrorMessage(label: string, message: string | null) {
  if (!message) {
    return null;
  }

  const normalized = message.trim();

  if (normalized === "Required") {
    return `Preencha ${label}.`;
  }

  if (normalized === "Invalid input") {
    return `Revise ${label}.`;
  }

  if (normalized === "Invalid datetime") {
    return `Informe ${label} em data e hora validas.`;
  }

  return normalized;
}

export function pickLabeledFieldErrors<T extends string>(error: unknown, labels: Record<T, string>) {
  return Object.fromEntries(
    (Object.entries(labels) as Array<[T, string]>).map(([field, label]) => [field, normalizeFieldErrorMessage(label, getFirstFieldError(error, field))]),
  ) as Record<T, string | null>;
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

export function getFieldErrorCount(error: unknown) {
  return Object.values(getApiValidationMap(error)).filter((value) => Array.isArray(value) && value.length > 0).length;
}

export function getActionableErrorMessage(error: unknown, fieldFallback = "Revise os campos destacados para continuar.") {
  const formError = getFirstFormError(error);

  if (formError) {
    return formError;
  }

  if (getFieldErrorCount(error) > 0) {
    return fieldFallback;
  }

  return getErrorMessage(error);
}

export function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
