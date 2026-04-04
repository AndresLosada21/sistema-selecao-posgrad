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
          <li key={moduleName}>{moduleName}</li>
        ))}
      </ul>
    </SectionCard>
  );
}
