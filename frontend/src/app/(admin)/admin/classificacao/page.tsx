import Link from "next/link";

import { SectionCard } from "@/components/shared/section-card";

export default function AdminClassificacaoIndexPage() {
  return (
    <SectionCard title="Classificacao" description="Informe ou navegue para o edital cuja classificacao deve ser consultada ou recalculada.">
      <div className="content-list">
        <article className="content-item">
          <strong>Consulta por edital</strong>
          <small>Use a rota `/admin/classificacao/[editalId]` para consultar e recalcular a classificacao de um edital especifico.</small>
          <div className="content-item-links">
            <Link className="nav-link" href="/editais">
              Abrir modulo publico de editais para copiar o ID desejado
            </Link>
          </div>
        </article>
      </div>
    </SectionCard>
  );
}
