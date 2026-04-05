import Link from "next/link";

import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";

const adminModules = [
  { href: "/admin/editais", title: "Editais", description: "CRUD administrativo de editais, linhas de pesquisa e cronogramas." },
  { href: "/admin/isencao", title: "Isencao", description: "Fila administrativa de pedidos de isencao, pareceres e resultados." },
  { href: "/admin/usuarios", title: "Usuarios", description: "Gestao de contas, perfis, bloqueios e escopos de avaliacao." },
  { href: "/admin/homologacao", title: "Homologacao", description: "Fila de inscricoes, documentos, pareceres e confirmacao operacional de reserva." },
  { href: "/admin/etapa-1", title: "Etapa 1", description: "Fila de redacao, nota por rubrica e operacao de espelho." },
  { href: "/admin/etapa-2", title: "Etapa 2", description: "Fila de analise curricular, glosas e normalizacao." },
  { href: "/admin/politicas-afirmativas", title: "Politicas afirmativas", description: "Encaminhamento, resultados preliminar/final e publicacao da etapa." },
  { href: "/admin/recursos", title: "Recursos", description: "Fila de recursos administrativos e julgamento com impacto derivado." },
  { href: "/admin/classificacao", title: "Classificacao", description: "Consulta e recalculo de classificacao por edital." },
  { href: "/admin/publicacoes", title: "Publicacoes", description: "Preview, publicacao oficial e historico versionado por edital." },
];

export default function AdminHomePage() {
  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Operacao administrativa do processo seletivo"
        description="Acesse diretamente o modulo operacional desejado. O foco desta area e execucao funcional das etapas e resultados do edital."
      />

      <SectionCard
        title="Modulos administrativos"
        description="Atalhos operacionais para os modulos protegidos por papel administrativo."
      >
        <div className="content-list">
          {adminModules.map((moduleItem) => (
            <article className="content-item" key={moduleItem.href}>
              <strong>{moduleItem.title}</strong>
              <p>{moduleItem.description}</p>
              <div className="content-item-links">
                <Link className="nav-link" href={moduleItem.href}>
                  Abrir modulo
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
