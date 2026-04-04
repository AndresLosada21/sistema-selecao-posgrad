import { apiGet, apiPost } from "@/lib/http/client";

import type { AuthResponse, AuthUser, LoginPayload, RegisterPayload } from "./types";

export function login(payload: LoginPayload) {
  return apiPost<AuthResponse>("/v1/auth/login", payload);
}

export function register(payload: RegisterPayload) {
  return apiPost<AuthResponse>("/v1/auth/register", payload);
}

export function getAuthenticatedUser(token: string) {
  return apiGet<AuthUser>("/v1/auth/me", token);
}
