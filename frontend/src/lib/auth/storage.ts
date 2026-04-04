export const tokenStorageKey = "selecao-posgrad-token";

export function readStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(tokenStorageKey);
}

export function writeStoredToken(token: string) {
  window.localStorage.setItem(tokenStorageKey, token);
}

export function clearStoredToken() {
  window.localStorage.removeItem(tokenStorageKey);
}
