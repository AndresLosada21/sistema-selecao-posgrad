type ValidationFlatten = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

type ErrorResponseBase = {
  code: string;
  message: string;
};

function buildErrorResponse<T extends Record<string, unknown>>(code: string, message: string, extra?: T) {
  return {
    code,
    message,
    ...(extra ?? {}),
  };
}

export function validationError(message: string, errors: ValidationFlatten) {
  return buildErrorResponse("VALIDATION_ERROR", message, { errors });
}

export function requestValidationError(
  message: string,
  input: {
    paramsErrors?: ValidationFlatten | null;
    queryErrors?: ValidationFlatten | null;
    bodyErrors?: ValidationFlatten | null;
  },
) {
  return buildErrorResponse("VALIDATION_ERROR", message, {
    paramsErrors: input.paramsErrors ?? null,
    queryErrors: input.queryErrors ?? null,
    bodyErrors: input.bodyErrors ?? null,
  });
}

export function unauthorized(message: string, code = "UNAUTHORIZED") {
  return buildErrorResponse(code, message);
}

export function forbidden(message: string, code = "FORBIDDEN") {
  return buildErrorResponse(code, message);
}

export function notFound(message: string, code = "NOT_FOUND", extra?: Record<string, unknown>) {
  return buildErrorResponse(code, message, extra);
}

export function conflict(message: string, code = "CONFLICT", extra?: Record<string, unknown>) {
  return buildErrorResponse(code, message, extra);
}

export function payloadTooLarge(message: string) {
  return buildErrorResponse("PAYLOAD_TOO_LARGE", message);
}

export function tooManyRequests(message: string) {
  return buildErrorResponse("RATE_LIMITED", message);
}

export function internalError(message: string, code = "INTERNAL_ERROR") {
  return buildErrorResponse(code, message);
}
