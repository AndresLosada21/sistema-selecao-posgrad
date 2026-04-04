import Link from "next/link";

import { SectionCard } from "@/components/shared/section-card";

export default function AdminPublicacoesIndexPage() {
  return (
    <SectionCard title="Publicacoes oficiais" description="Use a rota por edital para operar previews e criacao de publicacoes oficiais.">
      <div className="content-list">
        <article className="content-item">
          <strong>Operacao por edital</strong>
          <small>Use a rota `/admin/publicacoes/[editalId]` para operar homologacao, classificacao e politicas afirmativas por edital.</small>
          <div className="content-item-links"><Link className="nav-link" href="/editais">Abrir modulo publico de editais para localizar o ID desejado</Link></div>
        </article>
      </div>
    </SectionCard>
  );
}
