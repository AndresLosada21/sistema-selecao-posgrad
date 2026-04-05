const DEFAULT_AUTH_REDIRECT = "/candidato";

export function sanitizeNextPath(nextPath?: string | null) {
  if (!nextPath) {
    return undefined;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.includes("://")) {
    return undefined;
  }

  return nextPath;
}

export function resolveAuthRedirectPath(nextPath?: string | null) {
  return sanitizeNextPath(nextPath) ?? DEFAULT_AUTH_REDIRECT;
}
