import Link from "next/link";

import { SectionCard } from "@/components/shared/section-card";

const adminModules = [
  "homologacao",
  "etapa-1",
  "etapa-2",
  "politicas-afirmativas",
  "recursos",
  "classificacao",
  "publicacoes",
];

export default function AdminHomePage() {
  return (
    <SectionCard
      title="Base administrativa"
      description="Estrutura inicial para os modulos administrativos do processo seletivo, com protecao por sessao e papel."
    >
      <ul className="plain-list">
        {adminModules.map((moduleName) => (
          <li key={moduleName}>
            {moduleName === "homologacao" ? <Link href="/admin/homologacao">homologacao</Link> : null}
            {moduleName === "etapa-1" ? <Link href="/admin/etapa-1">etapa-1</Link> : null}
            {moduleName === "etapa-2" ? <Link href="/admin/etapa-2">etapa-2</Link> : null}
            {moduleName === "politicas-afirmativas" ? <Link href="/admin/politicas-afirmativas">politicas-afirmativas</Link> : null}
            {moduleName === "recursos" ? <Link href="/admin/recursos">recursos</Link> : null}
            {moduleName === "classificacao" ? <Link href="/admin/classificacao">classificacao</Link> : null}
            {moduleName === "publicacoes" ? <Link href="/admin/publicacoes">publicacoes</Link> : null}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
