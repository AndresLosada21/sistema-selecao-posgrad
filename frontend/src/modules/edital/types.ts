export type EditalListItem = {
  id: string;
  numero: string;
  titulo: string;
  cursoNivel: string;
  status: string;
  faseAtual: { titulo: string } | null;
  proximaFase: { titulo: string } | null;
};

export type EditaisResponse = {
  total: number;
  items: EditalListItem[];
};
