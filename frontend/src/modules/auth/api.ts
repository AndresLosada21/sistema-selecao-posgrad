import { apiGet, apiPost, apiRequest } from "@/lib/http/client";

import type {
  AuthResponse,
  AuthUser,
  EmailVerificationResponse,
  LoginPayload,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  PasswordResetRequestResponse,
  RegisterPayload,
} from "./types";

export function login(payload: LoginPayload) {
  return apiPost<AuthResponse>("/v1/auth/login", payload);
}

export function register(payload: RegisterPayload) {
  return apiPost<AuthResponse>("/v1/auth/register", payload);
}

export function refreshSession() {
  return apiRequest<AuthResponse>("/v1/auth/refresh", { method: "POST", skipAuthRefresh: true });
}

export function logout(token?: string | null) {
  return apiRequest<void>("/v1/auth/logout", { method: "POST", token, skipAuthRefresh: true });
}

export function getAuthenticatedUser(token: string) {
  return apiGet<AuthUser>("/v1/auth/me", token);
}

export function requestPasswordReset(payload: PasswordResetRequestPayload) {
  return apiPost<PasswordResetRequestResponse>("/v1/auth/password-reset/request", payload);
}

export function confirmPasswordReset(payload: PasswordResetConfirmPayload) {
  return apiPost<{ accepted: true }>("/v1/auth/password-reset/confirm", payload);
}

export function requestEmailVerification(token: string) {
  return apiPost<EmailVerificationResponse>("/v1/auth/email-verification/request", undefined, token);
}

export function confirmEmailVerification(token: string) {
  return apiPost<{ accepted: true }>("/v1/auth/email-verification/confirm", { token });
}
