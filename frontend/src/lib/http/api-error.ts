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
