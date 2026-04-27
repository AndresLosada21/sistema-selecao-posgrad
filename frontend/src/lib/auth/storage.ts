export const tokenStorageKey = "selecao-posgrad-token";
const sessionHintStorageKey = "selecao-posgrad-session-active";
let memoryToken: string | null = null;

function getBrowserStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredToken() {
  return memoryToken;
}

export function writeStoredToken(token: string) {
  memoryToken = token;
}

export function clearStoredToken() {
  memoryToken = null;
}

export function hasStoredSessionHint() {
  return getBrowserStorage()?.getItem(sessionHintStorageKey) === "1";
}

export function writeStoredSessionHint() {
  getBrowserStorage()?.setItem(sessionHintStorageKey, "1");
}

export function clearStoredSessionHint() {
  getBrowserStorage()?.removeItem(sessionHintStorageKey);
}
