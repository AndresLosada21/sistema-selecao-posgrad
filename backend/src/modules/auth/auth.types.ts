import type { Role, StatusConta, StatusInscricao, StatusIsencao, StatusParticipacaoEdital } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  nomeCompleto: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
   emailVerificadoEm: string | null;
  statusConta: StatusConta;
  perfis: Role[];
};

export type ParticipacaoResumo = {
  id: string;
  status: StatusParticipacaoEdital;
  edital: {
    id: string;
    numero: string;
    titulo: string;
    cursoNivel: string;
    status: string;
  };
  inscricao: {
    id: string;
    status: StatusInscricao;
  } | null;
  pedidoIsencao: {
    id: string;
    status: StatusIsencao;
  } | null;
};
