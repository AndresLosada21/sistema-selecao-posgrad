import type { StatusConta } from "@/lib/enums";

export type AdminUsuarioItem = {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  emailVerificadoEm: string | null;
  statusConta: StatusConta;
  perfis: string[];
  escoposAvaliacao: Array<{
    editalId: string;
    linhaPesquisaId: string | null;
  }>;
  criadoEm: string;
  atualizadoEm: string;
};

export type AdminUsuariosResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: AdminUsuarioItem[];
};
