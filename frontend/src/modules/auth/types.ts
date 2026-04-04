export type AuthUser = {
  id: string;
  nomeCompleto: string;
  email: string;
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
