export type AuthUser = {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf?: string | null;
  telefone?: string | null;
  emailVerificadoEm?: string | null;
  statusConta?: string;
  perfis: string[];
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type LoginPayload = {
  email: string;
  senha: string;
};

export type RegisterPayload = {
  nomeCompleto: string;
  email: string;
  senha: string;
  telefone: string;
  cpf: string;
};

export type PasswordResetRequestPayload = {
  email: string;
};

export type PasswordResetConfirmPayload = {
  token: string;
  senha: string;
};

export type PasswordResetRequestResponse = {
  accepted: true;
  resetTokenPreview?: string;
};

export type EmailVerificationResponse = {
  accepted: true;
  verificationTokenPreview?: string;
};
