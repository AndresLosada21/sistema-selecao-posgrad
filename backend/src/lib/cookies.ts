export function parseCookieHeader(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>();

  for (const part of cookieHeader?.split(";") ?? []) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;

    const value = rawValue.join("=");
    try {
      cookies.set(rawName, decodeURIComponent(value));
    } catch {
      cookies.set(rawName, value);
    }
  }

  return cookies;
}
