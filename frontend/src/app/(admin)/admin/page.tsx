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

/* eslint-disable react/no-array-index-key */

const iconFileText = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></svg>;
const iconUsers = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const iconShield = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>;
const iconClipboard = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg>;
const iconPenTool = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z" /></svg>;
const iconAward = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>;
const iconTrending = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>;
const iconMsg = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
const iconMegaphone = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3Z" /><path d="M11.6 16.8a3 3 0 1 1-5.8 1.4" /></svg>;

const launcherRows = [
  [
    { href: "/admin/editais", title: "Editais", description: "CRUD de editais, linhas e cronograma", icon: iconFileText, color: "var(--color-primary-50)", iconColor: "var(--color-primary-500)" },
    { href: "/admin/usuarios", title: "Usuários", description: "Gestão de contas, perfis e escopos", icon: iconUsers, color: "var(--color-info-bg)", iconColor: "var(--color-info)" },
    { href: "/admin/isencao", title: "Isenção", description: "Pedidos de isenção de taxa", icon: iconShield, color: "var(--color-success-bg)", iconColor: "var(--color-success)" },
  ],
  [
    { href: "/admin/homologacao", title: "Homologação", description: "Fila de inscrições para homologar", icon: iconClipboard, color: "var(--color-warning-bg)", iconColor: "var(--color-warning)" },
    { href: "/admin/etapa-1", title: "Etapa 1 — Redação", description: "Avaliação de redações", icon: iconPenTool, color: "var(--color-error-bg)", iconColor: "var(--color-error)" },
    { href: "/admin/etapa-2", title: "Etapa 2 — Títulos", description: "Análise curricular e pontuação", icon: iconAward, color: "#EDE9FE", iconColor: "#7C3AED" },
  ],
  [
    { href: "/admin/classificacao", title: "Classificação", description: "Ranking final por edital", icon: iconTrending, color: "var(--color-info-bg)", iconColor: "var(--color-info)" },
    { href: "/admin/recursos", title: "Recursos", description: "Fila de recursos interpostos", icon: iconMsg, color: "var(--color-neutral-100)", iconColor: "var(--color-neutral-600)" },
    { href: "/admin/publicacoes", title: "Publicações", description: "Oficiais, retificações e PDFs", icon: iconMegaphone, color: "var(--color-primary-50)", iconColor: "var(--color-primary-500)" },
  ],
];

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
        <article className="admin-stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="admin-stat-icon" style={{ background: "#EFF6FF", color: "#2563EB" }}>{iconFileText}</span>
            <span className="admin-stat-label">Total de Inscrições</span>
          </div>
          <strong className="admin-stat-value">{stats.totalInscricoes}</strong>
        </article>
        <article className="admin-stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="admin-stat-icon" style={{ background: "#DBEAFE", color: "#3B82F6" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
            </span>
            <span className="admin-stat-label">Editais Ativos</span>
          </div>
          <strong className="admin-stat-value">{stats.editaisAtivos}</strong>
        </article>
        <article className="admin-stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="admin-stat-icon" style={{ background: "#FEF3C7", color: "#F59E0B" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </span>
            <span className="admin-stat-label">Pedidos Pendentes</span>
          </div>
          <strong className="admin-stat-value">{stats.pedidosPendentes}</strong>
        </article>
        <article className="admin-stat-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="admin-stat-icon" style={{ background: "#D1FAE5", color: "#10B981" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
            </span>
            <span className="admin-stat-label">Homologacoes Pendentes</span>
          </div>
          <strong className="admin-stat-value">{stats.homologacoesPendentes}</strong>
        </article>
      </div>

      {launcherRows.map((row, ri) => (
        <div className="admin-launcher-grid" key={ri}>
          {row.map((m) => (
            <Link className="admin-launcher-card" href={m.href} key={m.href}>
              <span className="admin-launcher-icon" style={{ background: m.color, color: m.iconColor }}>{m.icon}</span>
              <div className="admin-launcher-card-body">
                <strong>{m.title}</strong>
                <p>{m.description}</p>
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
