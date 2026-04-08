import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { SummaryGrid } from "@/components/shared/summary-grid";

const adminModules = [
  { href: "/admin/editais", title: "Editais", description: "CRUD administrativo de editais, linhas e cronogramas.", section: "Operativo" },
  { href: "/admin/isencao", title: "Isencao", description: "Fila administrativa de pedidos de isencao.", section: "Operativo" },
  { href: "/admin/homologacao", title: "Homologacao", description: "Fila de inscricoes para homologacao preliminar e final.", section: "Operativo" },
  { href: "/admin/etapa-1", title: "Etapa 1 — Redacao", description: "Avaliacao e liberacao de espelho da redacao.", section: "Operativo" },
  { href: "/admin/etapa-2", title: "Etapa 2 — Titulos", description: "Analise curricular e nota normalizada.", section: "Operativo" },
  { href: "/admin/classificacao", title: "Classificacao Final", description: "Ranking final por edital e recalculo.", section: "Operativo" },
  { href: "/admin/politicas-afirmativas", title: "Pol. Afirmativas", description: "Encaminhamento e resultados da etapa.", section: "Operativo" },
  { href: "/admin/recursos", title: "Recursos", description: "Fila de recursos e impactos derivados.", section: "Operativo" },
  { href: "/admin/usuarios", title: "Usuarios", description: "Contas, perfis e escopos de avaliador.", section: "Administracao" },
  { href: "/admin/publicacoes", title: "Publicacoes Oficiais", description: "Preview, publicacao e historico versionado.", section: "Administracao" },
];

export default function AdminHomePage() {
  const groupedModules = {
    Operativo: adminModules.filter((item) => item.section === "Operativo"),
    Administracao: adminModules.filter((item) => item.section === "Administracao"),
  };

  return (
    <div className="stack-layout">
      <PageHeader title="Painel Administrativo" description="Acesse os módulos operacionais do sistema de seleção." />

      <SummaryGrid
        items={[
          { label: "Trilhas prioritarias", value: 3 },
          { label: "Modulos ativos", value: adminModules.length },
          { label: "Entradas rapidas", value: 2 },
        ]}
      />

      <PageFeedback
        type="info"
        title="Operacao administrativa do processo seletivo"
        description="Acesse diretamente o modulo operacional desejado. O foco desta area e execucao funcional das etapas e resultados do edital."
      />

      {Object.entries(groupedModules).map(([section, items]) => (
        <SectionCard key={section} title={section} description={section === "Operativo" ? "Fluxos centrais do edital e das etapas." : "Cadastros e operações estruturantes da área administrativa."}>
          <div className="admin-launcher-grid">
            {items.map((moduleItem) => (
              <article className="admin-launcher-card" key={moduleItem.href}>
                <div className="admin-launcher-card-body">
                  <strong>{moduleItem.title}</strong>
                  <p>{moduleItem.description}</p>
                </div>
                <div className="content-item-links">
                  <Link className="nav-link" href={moduleItem.href}>
                    Abrir modulo
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
