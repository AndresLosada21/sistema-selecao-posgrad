"use client";

import Link from "next/link";
import { useCallback, useState, type FormEvent } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { cursoNivelOptions, statusEditalOptions, type CursoNivel, type StatusEdital } from "@/lib/enums";
import { createAdminEdital, createTemaRedacaoAdmin, listAdminEditais } from "@/modules/admin-edital/api";
import type { AdminEditaisResponse } from "@/modules/admin-edital/types";

const iconPlus = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
const iconPencil = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z" /></svg>;
const iconChevL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
const iconChevR = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;

export default function AdminEditaisPage() {
  const session = useSession();
  const [data, setData] = useState<AdminEditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ numero: "", titulo: "", descricao: "", ano: String(new Date().getFullYear()), semestre: "1", cursoNivel: "MESTRADO" as CursoNivel, status: "RASCUNHO" as StatusEdital });
  const [temaForm, setTemaForm] = useState({ titulo: "", descricao: "" });
  const [temasRedacao, setTemasRedacao] = useState<Array<{ id: string; titulo: string; descricao: string; ordem: number }>>([]);

  const load = useCallback(async () => {
    if (!session.token) return;
    const response = await listAdminEditais(session.token, { page, pageSize: 20 });
    setData(response);
  }, [page, session.token]);

  useAbortableEffect(async (signal) => {
    if (!session.token) return;
    try {
      await load();
      if (signal.aborted) return;
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) }); setStatus("error");
    }
  }, [load, session.signOut, session.token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session.token) return;
    setBusy(true); setMessage(null);
    try {
      const created = await createAdminEdital({ numero: form.numero, titulo: form.titulo, descricao: form.descricao || undefined, ano: Number(form.ano), semestre: form.semestre ? Number(form.semestre) : undefined, cursoNivel: form.cursoNivel, status: form.status }, session.token) as { id?: string };
      if (!created.id) {
        throw new Error("Nao foi possivel identificar o edital criado para vincular os temas de redacao.");
      }
      for (const tema of temasRedacao) {
        await createTemaRedacaoAdmin(created.id, { titulo: tema.titulo, descricao: tema.descricao || undefined, ordem: tema.ordem, ativo: true }, session.token);
      }
      await load();
      setForm({ numero: "", titulo: "", descricao: "", ano: String(new Date().getFullYear()), semestre: "1", cursoNivel: "MESTRADO", status: "RASCUNHO" });
      setTemaForm({ titulo: "", descricao: "" });
      setTemasRedacao([]);
      setShowForm(false);
      setMessage({ type: "success", text: "Edital criado com sucesso." });
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando editais" description="Consultando editais administrativos." />;
  if (status === "error") return <ErrorState title="Falha ao carregar editais" description={message?.text} />;

  function addTemaRedacaoInicial() {
    if (!temaForm.titulo.trim()) {
      setMessage({ type: "error", text: "Informe o titulo do tema de redacao antes de adicionar." });
      return;
    }

    setTemasRedacao((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        titulo: temaForm.titulo.trim(),
        descricao: temaForm.descricao.trim(),
        ordem: current.length,
      },
    ]);
    setTemaForm({ titulo: "", descricao: "" });
    setMessage(null);
  }

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {message ? <PageFeedback type={message.type} title={message.type === "success" ? "Sucesso" : "Erro"} description={message.text} /> : null}

      {/* Header */}
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Editais</h1>
          <p>Listagem e gerenciamento de editais do programa.</p>
        </div>
        <button type="button" className="admin-page-cta" onClick={() => setShowForm((v) => !v)}>
          {iconPlus} Novo edital
        </button>
      </div>

      {/* Create form (toggleable) */}
      {showForm ? (
        <div className="admin-form-card">
          <h3 className="admin-form-card-title">Novo edital</h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="admin-form-row">
              <div className="wiz-field"><label className="wiz-field-label">Numero *</label><input required value={form.numero} onChange={(e) => setForm((c) => ({ ...c, numero: e.target.value }))} /></div>
              <div className="wiz-field"><label className="wiz-field-label">Titulo *</label><input required value={form.titulo} onChange={(e) => setForm((c) => ({ ...c, titulo: e.target.value }))} /></div>
            </div>
            <div className="wiz-field"><label className="wiz-field-label">Descricao</label><textarea value={form.descricao} onChange={(e) => setForm((c) => ({ ...c, descricao: e.target.value }))} style={{ minHeight: 60 }} /></div>
            <div className="admin-form-row">
              <div className="wiz-field"><label className="wiz-field-label">Ano</label><input type="number" min="2024" required value={form.ano} onChange={(e) => setForm((c) => ({ ...c, ano: e.target.value }))} /></div>
              <div className="wiz-field"><label className="wiz-field-label">Semestre</label><select value={form.semestre} onChange={(e) => setForm((c) => ({ ...c, semestre: e.target.value }))}><option value="1">1</option><option value="2">2</option></select></div>
              <div className="wiz-field"><label className="wiz-field-label">Curso</label><select value={form.cursoNivel} onChange={(e) => setForm((c) => ({ ...c, cursoNivel: e.target.value as CursoNivel }))}>{cursoNivelOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}</select></div>
              <div className="wiz-field"><label className="wiz-field-label">Status</label><select value={form.status} onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as StatusEdital }))}>{statusEditalOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}</select></div>
            </div>
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 14, color: "#1E293B" }}>Temas de redacao iniciais</h4>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748B" }}>Cadastre os temas que ficarao disponiveis em dropdown para o candidato.</p>
              </div>
              <div className="admin-form-row">
                <div className="wiz-field"><label className="wiz-field-label">Titulo do tema</label><input value={temaForm.titulo} onChange={(e) => setTemaForm((current) => ({ ...current, titulo: e.target.value }))} /></div>
                <div className="wiz-field"><label className="wiz-field-label">Descricao</label><input value={temaForm.descricao} onChange={(e) => setTemaForm((current) => ({ ...current, descricao: e.target.value }))} /></div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="button" className="admin-page-cta" onClick={addTemaRedacaoInicial}>Adicionar tema</button>
                <span style={{ fontSize: 12, color: "#64748B", alignSelf: "center" }}>{temasRedacao.length} tema(s) preparado(s)</span>
              </div>
              {temasRedacao.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {temasRedacao.map((tema, index) => (
                    <div key={tema.id} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: 13, color: "#1E293B" }}>{index + 1}. {tema.titulo}</strong>
                        <span style={{ display: "block", fontSize: 12, color: "#64748B" }}>{tema.descricao || "Sem descricao adicional."}</span>
                      </div>
                      <button type="button" onClick={() => setTemasRedacao((current) => current.filter((item) => item.id !== tema.id).map((item, itemIndex) => ({ ...item, ordem: itemIndex })))} style={{ border: "1px solid #CBD5E1", background: "#fff", borderRadius: 6, padding: "8px 12px", cursor: "pointer" }}>Remover</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="wiz-info-box" style={{ marginTop: -4 }}><span>Quando o edital for criado ou atualizado com status `PUBLICADO` ou `EM_ANDAMENTO`, o sistema define `Publicado em` automaticamente.</span></div>
            <button type="submit" disabled={busy} className="admin-page-cta" style={{ alignSelf: "flex-start" }}>{busy ? "Criando..." : "Criar edital"}</button>
          </form>
        </div>
      ) : null}

      {/* Search bar */}
      <div className="admin-search-bar">
        <div className="admin-search-input">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input placeholder="Buscar por numero, titulo ou curso..." />
        </div>
      </div>

      {/* Table */}
      {data?.items.length ? (
        <div className="admin-table">
          <div className="admin-table-head">
            <span className="admin-table-cell" style={{ width: 120 }}>Numero</span>
            <span className="admin-table-cell admin-table-cell--grow">Titulo</span>
            <span className="admin-table-cell" style={{ width: 200 }}>Curso/Nivel</span>
            <span className="admin-table-cell admin-table-cell--center" style={{ width: 120 }}>Status</span>
            <span className="admin-table-cell admin-table-cell--center" style={{ width: 80 }}>Acoes</span>
          </div>
          {data.items.map((item) => (
            <div key={item.id} className="admin-table-row">
              <span className="admin-table-cell admin-table-cell--bold" style={{ width: 120 }}>{item.numero}</span>
              <span className="admin-table-cell admin-table-cell--grow admin-table-cell--muted">{item.titulo}</span>
              <span className="admin-table-cell admin-table-cell--muted" style={{ width: 200 }}>{getStatusLabel(item.cursoNivel)}</span>
              <span className="admin-table-cell admin-table-cell--center" style={{ width: 120 }}>
                <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
              </span>
              <span className="admin-table-cell admin-table-cell--center" style={{ width: 80 }}>
                <Link href={`/admin/editais/${item.id}`} title="Editar">{iconPencil}</Link>
              </span>
            </div>
          ))}
          <div className="admin-pagination">
            <span>Mostrando {((page - 1) * 20) + 1}-{Math.min(page * 20, data.total)} de {data.total} editais</span>
            <div className="admin-pagination-controls">
              <button type="button" className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{iconChevL}</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} type="button" className={`admin-pagination-btn${page === i + 1 ? " admin-pagination-btn--active" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{iconChevR}</button>
            </div>
          </div>
        </div>
      ) : <EmptyState title="Sem editais" description="Nenhum edital cadastrado ainda." />}
    </div>
  );
}
