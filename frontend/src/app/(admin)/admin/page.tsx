"use client";

"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listAllAdminEditais } from "@/modules/admin-edital/api";
import { listInscricoesParaHomologacao } from "@/modules/admin-homologacao/api";
import { listAdminIsencoes } from "@/modules/admin-isencao/api";

const launcherRows = [
  [
    { href: "/admin/editais", title: "Editais", description: "Ver editais, linhas e cronograma" },
    { href: "/admin/usuarios", title: "Usuários", description: "Contas, perfis e escopos" },
    { href: "/admin/isencao", title: "Isenção", description: "Fila de pedidos de isenção de taxa" },
  ],
  [
    { href: "/admin/homologacao", title: "Homologação", description: "Fila de inscrições para homologar" },
    { href: "/admin/etapa-1", title: "Etapa 1 — Redação", description: "Avaliação de redações" },
    { href: "/admin/etapa-2", title: "Etapa 2 — Títulos", description: "Análise curricular e pontuação" },
  ],
  [
    { href: "/admin/classificacao", title: "Classificação", description: "Ranking final por edital" },
    { href: "/admin/recursos", title: "Recursos", description: "Fila de recursos interpostos" },
    { href: "/admin/publicacoes", title: "Publicações", description: "Oficiais, retificações e PDFs" },
  ],
] as const;

export default function AdminHomePage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalInscricoes: 0, editaisAtivos: 0, pedidosPendentes: 0, homologacoesPendentes: 0 });

  useAbortableEffect(async (signal) => {
    if (!token) return;

    try {
      const [editais, isencoes, homologacao] = await Promise.all([
        listAllAdminEditais(token),
        listAdminIsencoes(token, { page: 1, pageSize: 1 }),
        listInscricoesParaHomologacao(token, { page: 1, pageSize: 1 }),
      ]);

      if (signal.aborted) return;

      setStats({
        totalInscricoes: homologacao.total,
        editaisAtivos: editais.items.filter((item) => item.status === "PUBLICADO" || item.status === "EM_ANDAMENTO").length,
        pedidosPendentes: isencoes.total,
        homologacoesPendentes: homologacao.total,
      });
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [signOut, token]);

  if (status === "loading") {
    return <LoadingState title="Carregando painel administrativo" description="Consultando atalhos e indicadores operacionais." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar painel administrativo" description={message ?? undefined} />;
  }

  return (
    <div className="stack-layout">
      <PageHeader title="Painel Administrativo" description="Acesse os módulos operacionais do sistema de seleção." />

      <div className="admin-stats-grid">
        <article className="admin-stat-card"><span className="admin-stat-label">Trilhas/Inscrições</span><strong className="admin-stat-value">{stats.totalInscricoes}</strong></article>
        <article className="admin-stat-card"><span className="admin-stat-label">Editais Ativos</span><strong className="admin-stat-value">{stats.editaisAtivos}</strong></article>
        <article className="admin-stat-card"><span className="admin-stat-label">Pedidos Pendentes</span><strong className="admin-stat-value">{stats.pedidosPendentes}</strong></article>
        <article className="admin-stat-card"><span className="admin-stat-label">Homologações Pendentes</span><strong className="admin-stat-value">{stats.homologacoesPendentes}</strong></article>
      </div>

      {launcherRows.map((row) => (
        <div className="admin-launcher-grid" key={row[0].href}>
          {row.map((moduleItem) => (
            <article className="admin-launcher-card" key={moduleItem.href}>
              <div className="admin-launcher-card-body">
                <strong>{moduleItem.title}</strong>
                <p>{moduleItem.description}</p>
              </div>
              <div className="content-item-links">
                <Link className="nav-link" href={moduleItem.href}>
                  Abrir
                </Link>
              </div>
            </article>
          ))}
        </div>
      ))}
    </div>
  );
}
