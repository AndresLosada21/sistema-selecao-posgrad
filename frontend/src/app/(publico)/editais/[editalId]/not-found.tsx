import Link from "next/link";

import { EmptyState } from "@/components/shared/page-states";

export default function EditalNotFound() {
  return (
    <div className="stack-layout">
      <EmptyState
        title="Edital nao encontrado"
        description="O identificador informado nao corresponde a um edital publico disponivel."
      />
      <div className="content-item-links">
        <Link className="nav-link" href="/editais">
          Voltar para editais publicados
        </Link>
      </div>
    </div>
  );
}
