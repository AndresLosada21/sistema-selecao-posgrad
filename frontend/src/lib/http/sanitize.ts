type Primitive = string | number | boolean | null | undefined;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const sanitized = value.map(sanitizeValue).filter((item) => item !== undefined);
    return sanitized;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, Primitive | object | unknown[]>)
      .map(([key, entryValue]) => [key, sanitizeValue(entryValue)] as const)
      .filter(([, entryValue]) => entryValue !== undefined);

    return Object.fromEntries(entries);
  }

  return value;
}

export function sanitizePayload<T>(value: T): T {
  return sanitizeValue(value) as T;
}
