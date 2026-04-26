export const tokenStorageKey = "selecao-posgrad-token";
let memoryToken: string | null = null;

export function readStoredToken() {
  return memoryToken;
}

export function writeStoredToken(token: string) {
  memoryToken = token;
}

export function clearStoredToken() {
  memoryToken = null;
}
