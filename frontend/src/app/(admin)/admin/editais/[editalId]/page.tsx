"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { isoToDatetimeLocalInput } from "@/lib/datetime-local";
import { getErrorMessage, getFirstFormError, pickFirstFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { cursoNivelOptions, statusEditalOptions, tipoCronogramaEditalOptions, type CursoNivel, type StatusEdital, type TipoCronogramaEdital } from "@/lib/enums";
import {
  createCronogramaAdmin, createLinhaPesquisaAdmin, createTemaRedacaoAdmin,
  deleteCronogramaAdmin, deleteLinhaPesquisaAdmin, deleteAdminEdital, deleteTemaRedacaoAdmin,
  getAdminEditalById, updateCronogramaAdmin, updateAdminEdital, updateLinhaPesquisaAdmin, updateTemaRedacaoAdmin,
} from "@/modules/admin-edital/api";
import type { AdminEditalDetalhe } from "@/modules/admin-edital/types";

type Props = { params: Promise<{ editalId: string }> };

export default function AdminEditalDetailPage({ params }: Props) {
  const router = useRouter();
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<AdminEditalDetalhe | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  const [editalForm, setEditalForm] = useState<{
    numero: string; titulo: string; descricao: string; ano: string; semestre: string;
    cursoNivel: CursoNivel; status: StatusEdital; publicadoEm: string;
  }>({ numero: "", titulo: "", descricao: "", ano: "", semestre: "1", cursoNivel: "MESTRADO", status: "RASCUNHO", publicadoEm: "" });

  const [editingLinhaId, setEditingLinhaId] = useState<string | null>(null);
  const [linhaForm, setLinhaForm] = useState({ nome: "", descricao: "", vagasAmplaConcorrencia: "0", vagasAcoesAfirmativas: "0", vagasPcd: "0" });
  const [showLinhaForm, setShowLinhaForm] = useState(false);

  const [editingCronogramaId, setEditingCronogramaId] = useState<string | null>(null);
  const [cronogramaForm, setCronogramaForm] = useState<{ tipo: TipoCronogramaEdital; titulo: string; descricao: string; inicioEm: string; fimEm: string }>({ tipo: "INSCRICAO", titulo: "", descricao: "", inicioEm: "", fimEm: "" });
  const [showCronogramaForm, setShowCronogramaForm] = useState(false);

  const [editingTemaId, setEditingTemaId] = useState<string | null>(null);
  const [temaForm, setTemaForm] = useState({ titulo: "", descricao: "", ordem: "0", ativo: true });
  const [showTemaForm, setShowTemaForm] = useState(false);

  useEffect(() => { let c = false; params.then((r) => { if (!c) setEditalId(r.editalId); }); return () => { c = true; }; }, [params]);

  const load = useCallback(async () => {
    if (!editalId || !token) return;
    const r = await getAdminEditalById(editalId, token);
    setData(r);
    setEditalForm({
      numero: r.numero, titulo: r.titulo, descricao: r.descricao ?? "",
      ano: String(r.ano), semestre: String(r.semestre ?? 1),
      cursoNivel: r.cursoNivel as CursoNivel, status: r.status as StatusEdital,
      publicadoEm: isoToDatetimeLocalInput(r.publicadoEm),
    });
  }, [editalId, token]);

  useAbortableEffect(async (signal) => {
    if (!token || !editalId) return;
    try { await load(); if (signal.aborted) return; setStatus("ready"); }
    catch (e) { if (signal.aborted) return; if (isUnauthorizedError(e)) { signOut(); return; } setFeedback({ type: "error", text: getErrorMessage(e) }); setStatus("error"); }
  }, [editalId, load, signOut, token]);

  async function wrap(fn: () => Promise<void>) {
    setBusy(true); setFeedback(null);
    try { await fn(); await load(); } catch (e) { if (isUnauthorizedError(e)) { signOut(); return; } applyEditalErrors(e); setFeedback({ type: "error", text: getFirstFormError(e) ?? getErrorMessage(e) }); } finally { setBusy(false); }
  }

  function applyEditalErrors(error: unknown) {
    setFieldErrors(pickFirstFieldErrors(error, ["numero", "titulo", "descricao", "ano", "semestre", "cursoNivel", "status", "publicadoEm", "nome", "vagasAmplaConcorrencia", "vagasAcoesAfirmativas", "vagasPcd", "tipo", "inicioEm", "fimEm", "ordem", "ativo"] as const));
  }

  async function submitEdital(e: FormEvent) {
    e.preventDefault(); if (!token || !editalId) return;
    setFieldErrors({});
    await wrap(async () => {
      await updateAdminEdital(editalId, {
        numero: editalForm.numero, titulo: editalForm.titulo, descricao: editalForm.descricao || undefined,
        ano: Number(editalForm.ano), semestre: editalForm.semestre ? Number(editalForm.semestre) : undefined,
        cursoNivel: editalForm.cursoNivel, status: editalForm.status,
        publicadoEm: editalForm.publicadoEm ? new Date(editalForm.publicadoEm).toISOString() : undefined,
      }, token);
      setFeedback({ type: "success", text: "Edital atualizado." });
    });
  }

  async function submitLinha(e: FormEvent) {
    e.preventDefault(); if (!token || !editalId) return;
    setFieldErrors({});
    await wrap(async () => {
      const p = { nome: linhaForm.nome, descricao: linhaForm.descricao || undefined, vagasAmplaConcorrencia: Number(linhaForm.vagasAmplaConcorrencia), vagasAcoesAfirmativas: Number(linhaForm.vagasAcoesAfirmativas), vagasPcd: Number(linhaForm.vagasPcd) };
      if (editingLinhaId) await updateLinhaPesquisaAdmin(editingLinhaId, p, token);
      else await createLinhaPesquisaAdmin(editalId, p, token);
      setEditingLinhaId(null); setLinhaForm({ nome: "", descricao: "", vagasAmplaConcorrencia: "0", vagasAcoesAfirmativas: "0", vagasPcd: "0" }); setShowLinhaForm(false);
      setFeedback({ type: "success", text: editingLinhaId ? "Linha atualizada." : "Linha criada." });
    });
  }

  async function submitCronograma(e: FormEvent) {
    e.preventDefault(); if (!token || !editalId) return;
    setFieldErrors({});
    await wrap(async () => {
      const inicioDate = new Date(cronogramaForm.inicioEm); const fimDate = new Date(cronogramaForm.fimEm);
      const p = { tipo: cronogramaForm.tipo, titulo: cronogramaForm.titulo, descricao: cronogramaForm.descricao || undefined, inicioEm: inicioDate.toISOString(), fimEm: fimDate.toISOString() };
      if (editingCronogramaId) await updateCronogramaAdmin(editingCronogramaId, p, token);
      else await createCronogramaAdmin(editalId, p, token);
      setEditingCronogramaId(null); setCronogramaForm({ tipo: "INSCRICAO", titulo: "", descricao: "", inicioEm: "", fimEm: "" }); setShowCronogramaForm(false);
      setFeedback({ type: "success", text: editingCronogramaId ? "Fase atualizada." : "Fase criada." });
    });
  }

  async function submitTema(e: FormEvent) {
    e.preventDefault(); if (!token || !editalId) return;
    setFieldErrors({});
    await wrap(async () => {
      const p = { titulo: temaForm.titulo, descricao: temaForm.descricao || undefined, ordem: Number(temaForm.ordem || 0), ativo: temaForm.ativo };
      if (editingTemaId) await updateTemaRedacaoAdmin(editingTemaId, p, token);
      else await createTemaRedacaoAdmin(editalId, p, token);
      setEditingTemaId(null); setTemaForm({ titulo: "", descricao: "", ordem: "0", ativo: true }); setShowTemaForm(false);
      setFeedback({ type: "success", text: editingTemaId ? "Tema atualizado." : "Tema criado." });
    });
  }

  function handleEditLinha(id: string) {
    const l = data?.linhasPesquisa.find((i) => i.id === id); if (!l) return;
    setEditingLinhaId(id); setShowLinhaForm(true);
    setLinhaForm({ nome: l.nome, descricao: l.descricao ?? "", vagasAmplaConcorrencia: String(l.vagasAmplaConcorrencia), vagasAcoesAfirmativas: String(l.vagasAcoesAfirmativas), vagasPcd: String(l.vagasPcd) });
  }

  function handleEditCronograma(id: string) {
    const c = data?.cronogramas.find((i) => i.id === id); if (!c) return;
    setEditingCronogramaId(id); setShowCronogramaForm(true);
    setCronogramaForm({ tipo: c.tipo as TipoCronogramaEdital, titulo: c.titulo, descricao: c.descricao ?? "", inicioEm: c.inicioEm.slice(0, 16), fimEm: c.fimEm.slice(0, 16) });
  }

  function handleEditTema(id: string) {
    const t = data?.temasRedacao.find((i) => i.id === id); if (!t) return;
    setEditingTemaId(id); setShowTemaForm(true);
    setTemaForm({ titulo: t.titulo, descricao: t.descricao ?? "", ordem: String(t.ordem), ativo: t.ativo });
  }

  if (status === "loading") return <LoadingState title="Carregando edital" description="Consultando detalhe do edital." />;
  if (status === "error") return <ErrorState title="Falha ao carregar edital" description={feedback?.text} />;
  if (!data) return <EmptyState title="Edital indisponivel" description="Edital nao encontrado." />;

  const cursoLabel = data.cursoNivel === "MESTRADO" ? "Mestrado em Engenharia Eletrica" : "Doutorado em Engenharia Eletrica";

  function formatDateRange(inicio: string, fim: string) {
    return `${formatIsoDate(inicio)} – ${formatIsoDate(fim)}`;
  }

  function getCronoBadgeVariant(tipo: string): "warning" | "info" | "neutral" {
    const now = new Date();
    const c = data?.cronogramas.find((i) => i.tipo === tipo);
    if (!c) return "neutral";
    const inicio = new Date(c.inicioEm); const fim = new Date(c.fimEm);
    if (now >= inicio && now <= fim) return "warning";
    if (now < inicio) return "info";
    return "neutral";
  }

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {feedback && <PageFeedback description={feedback.text} title="Retorno" type={feedback.type} />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div className="admin-page-header-left" style={{ flex: 1 }}>
          <h1>Edital {data.numero}</h1>
          <p>{cursoLabel} &middot; Edite os dados principais, o cronograma e as regras do edital.</p>
        </div>
        <button className="admin-page-cta" disabled={busy} form="edital-form" type="submit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar edital
        </button>
      </div>

      {/* Metadados card */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Metadados</h2>
        <form id="edital-form" onSubmit={submitEdital} style={{ display: "contents" }}>
          <div className="admin-form-row">
            <div className="admin-eval-field"><label>Numero</label><input aria-invalid={!!fieldErrors.numero} onChange={(e) => { setEditalForm((c) => ({ ...c, numero: e.target.value })); setFieldErrors((current) => ({ ...current, numero: null })); }} required value={editalForm.numero} />{fieldErrors.numero ? <span className="field-error-text">{fieldErrors.numero}</span> : null}</div>
            <div className="admin-eval-field"><label>Titulo</label><input aria-invalid={!!fieldErrors.titulo} onChange={(e) => { setEditalForm((c) => ({ ...c, titulo: e.target.value })); setFieldErrors((current) => ({ ...current, titulo: null })); }} required value={editalForm.titulo} />{fieldErrors.titulo ? <span className="field-error-text">{fieldErrors.titulo}</span> : null}</div>
          </div>
          <div className="admin-form-row">
            <div className="admin-eval-field"><label>Ano</label><input aria-invalid={!!fieldErrors.ano} min={2024} onChange={(e) => { setEditalForm((c) => ({ ...c, ano: e.target.value })); setFieldErrors((current) => ({ ...current, ano: null })); }} type="number" value={editalForm.ano} />{fieldErrors.ano ? <span className="field-error-text">{fieldErrors.ano}</span> : null}</div>
            <div className="admin-eval-field"><label>Semestre</label><select aria-invalid={!!fieldErrors.semestre} className="select-field" onChange={(e) => { setEditalForm((c) => ({ ...c, semestre: e.target.value })); setFieldErrors((current) => ({ ...current, semestre: null })); }} value={editalForm.semestre}><option value="1">1</option><option value="2">2</option></select>{fieldErrors.semestre ? <span className="field-error-text">{fieldErrors.semestre}</span> : null}</div>
            <div className="admin-eval-field"><label>Curso</label><select aria-invalid={!!fieldErrors.cursoNivel} className="select-field" onChange={(e) => { setEditalForm((c) => ({ ...c, cursoNivel: e.target.value as CursoNivel })); setFieldErrors((current) => ({ ...current, cursoNivel: null })); }} value={editalForm.cursoNivel}>{cursoNivelOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}</select>{fieldErrors.cursoNivel ? <span className="field-error-text">{fieldErrors.cursoNivel}</span> : null}</div>
          </div>
          <div className="admin-eval-field"><label>Descricao</label><textarea aria-invalid={!!fieldErrors.descricao} className="text-area" onChange={(e) => { setEditalForm((c) => ({ ...c, descricao: e.target.value })); setFieldErrors((current) => ({ ...current, descricao: null })); }} style={{ minHeight: 80 }} value={editalForm.descricao} />{fieldErrors.descricao ? <span className="field-error-text">{fieldErrors.descricao}</span> : null}</div>
          <div className="admin-form-row">
            <div className="admin-eval-field"><label>Status</label><select aria-invalid={!!fieldErrors.status} className="select-field" onChange={(e) => { setEditalForm((c) => ({ ...c, status: e.target.value as StatusEdital })); setFieldErrors((current) => ({ ...current, status: null })); }} value={editalForm.status}>{statusEditalOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}</select>{fieldErrors.status ? <span className="field-error-text">{fieldErrors.status}</span> : null}</div>
            <div className="admin-eval-field">
              <label>Publicado em</label>
              <div className="eval-display" style={{ fontSize: 13, fontWeight: 500 }}>{editalForm.publicadoEm ? formatIsoDate(data.publicadoEm) : "Definido automaticamente ao publicar"}</div>
            </div>
          </div>
        </form>
      </div>

      {/* Linhas de pesquisa */}
      <div className="admin-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="admin-form-card-title" style={{ flex: 1 }}>Linhas de pesquisa</h2>
          <button className="admin-pub-btn-preview" onClick={() => { setShowLinhaForm(true); setEditingLinhaId(null); setLinhaForm({ nome: "", descricao: "", vagasAmplaConcorrencia: "0", vagasAcoesAfirmativas: "0", vagasPcd: "0" }); }} type="button">+ Adicionar</button>
        </div>

        {data.linhasPesquisa.map((l, i) => (
          <div className="admin-line-row" key={l.id} style={i % 2 === 0 ? { background: "#F8FAFC" } : undefined}>
            <span className="admin-line-name">{l.nome}</span>
            <span className="admin-line-meta">{l.vagasAmplaConcorrencia} ampla &middot; {l.vagasAcoesAfirmativas} cotas &middot; {l.vagasPcd} PCD = {l.totalVagas}</span>
            <button className="admin-line-edit" onClick={() => handleEditLinha(l.id)} title="Editar" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
            </button>
            <button className="admin-line-edit" onClick={() => wrap(async () => { await deleteLinhaPesquisaAdmin(l.id, token!); setFeedback({ type: "success", text: "Linha removida." }); })} title="Remover" type="button" style={{ color: "#EF4444" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        ))}
        {!data.linhasPesquisa.length && <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhuma linha cadastrada.</span>}

        {showLinhaForm && (
          <form onSubmit={submitLinha} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{editingLinhaId ? "Editar linha" : "Nova linha"}</span>
            <div className="admin-form-row">
              <div className="admin-eval-field"><label>Nome</label><input aria-invalid={!!fieldErrors.nome} onChange={(e) => { setLinhaForm((c) => ({ ...c, nome: e.target.value })); setFieldErrors((current) => ({ ...current, nome: null })); }} required value={linhaForm.nome} />{fieldErrors.nome ? <span className="field-error-text">{fieldErrors.nome}</span> : null}</div>
              <div className="admin-eval-field"><label>Descricao</label><input aria-invalid={!!fieldErrors.descricao} onChange={(e) => { setLinhaForm((c) => ({ ...c, descricao: e.target.value })); setFieldErrors((current) => ({ ...current, descricao: null })); }} value={linhaForm.descricao} />{fieldErrors.descricao ? <span className="field-error-text">{fieldErrors.descricao}</span> : null}</div>
            </div>
            <div className="admin-form-row">
              <div className="admin-eval-field"><label>Ampla</label><input aria-invalid={!!fieldErrors.vagasAmplaConcorrencia} min={0} onChange={(e) => { setLinhaForm((c) => ({ ...c, vagasAmplaConcorrencia: e.target.value })); setFieldErrors((current) => ({ ...current, vagasAmplaConcorrencia: null })); }} required type="number" value={linhaForm.vagasAmplaConcorrencia} />{fieldErrors.vagasAmplaConcorrencia ? <span className="field-error-text">{fieldErrors.vagasAmplaConcorrencia}</span> : null}</div>
              <div className="admin-eval-field"><label>Acoes afirmativas</label><input aria-invalid={!!fieldErrors.vagasAcoesAfirmativas} min={0} onChange={(e) => { setLinhaForm((c) => ({ ...c, vagasAcoesAfirmativas: e.target.value })); setFieldErrors((current) => ({ ...current, vagasAcoesAfirmativas: null })); }} required type="number" value={linhaForm.vagasAcoesAfirmativas} />{fieldErrors.vagasAcoesAfirmativas ? <span className="field-error-text">{fieldErrors.vagasAcoesAfirmativas}</span> : null}</div>
              <div className="admin-eval-field"><label>PCD</label><input aria-invalid={!!fieldErrors.vagasPcd} min={0} onChange={(e) => { setLinhaForm((c) => ({ ...c, vagasPcd: e.target.value })); setFieldErrors((current) => ({ ...current, vagasPcd: null })); }} required type="number" value={linhaForm.vagasPcd} />{fieldErrors.vagasPcd ? <span className="field-error-text">{fieldErrors.vagasPcd}</span> : null}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="admin-page-cta" disabled={busy} type="submit" style={{ fontSize: 13, padding: "8px 16px" }}>{editingLinhaId ? "Salvar" : "Criar"}</button>
              <button className="admin-pub-btn-preview" onClick={() => { setShowLinhaForm(false); setEditingLinhaId(null); }} type="button">Cancelar</button>
            </div>
          </form>
        )}
      </div>

      {/* Cronogramas */}
      <div className="admin-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="admin-form-card-title" style={{ flex: 1 }}>Cronogramas</h2>
          <button className="admin-pub-btn-preview" onClick={() => { setShowCronogramaForm(true); setEditingCronogramaId(null); setCronogramaForm({ tipo: "INSCRICAO", titulo: "", descricao: "", inicioEm: "", fimEm: "" }); }} type="button">+ Adicionar</button>
        </div>

        {data.cronogramas.map((c, i) => (
          <div className="admin-line-row" key={c.id} style={i % 2 === 0 ? { background: "#F8FAFC" } : undefined}>
            <span className="admin-line-name">{c.titulo || getStatusLabel(c.tipo)}</span>
            <span className="admin-line-meta">{formatDateRange(c.inicioEm, c.fimEm)}</span>
            <StatusBadge variant={getStatusVariant(c.tipo)} shape="pill">{getCronoBadgeVariant(c.tipo) === "warning" ? "Em andamento" : getCronoBadgeVariant(c.tipo) === "info" ? "Agendado" : "Encerrado"}</StatusBadge>
            <button className="admin-line-edit" onClick={() => handleEditCronograma(c.id)} title="Editar" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
            </button>
            <button className="admin-line-edit" onClick={() => wrap(async () => { await deleteCronogramaAdmin(c.id, token!); setFeedback({ type: "success", text: "Fase removida." }); })} title="Remover" type="button" style={{ color: "#EF4444" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        ))}
        {!data.cronogramas.length && <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhuma fase cadastrada.</span>}

        {showCronogramaForm && (
          <form onSubmit={submitCronograma} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{editingCronogramaId ? "Editar fase" : "Nova fase"}</span>
            <div className="admin-form-row">
              <div className="admin-eval-field"><label>Tipo</label><select aria-invalid={!!fieldErrors.tipo} className="select-field" onChange={(e) => { setCronogramaForm((c) => ({ ...c, tipo: e.target.value as TipoCronogramaEdital })); setFieldErrors((current) => ({ ...current, tipo: null })); }} value={cronogramaForm.tipo}>{tipoCronogramaEditalOptions.map((o) => <option key={o} value={o}>{getStatusLabel(o)}</option>)}</select>{fieldErrors.tipo ? <span className="field-error-text">{fieldErrors.tipo}</span> : null}</div>
              <div className="admin-eval-field"><label>Titulo</label><input aria-invalid={!!fieldErrors.titulo} onChange={(e) => { setCronogramaForm((c) => ({ ...c, titulo: e.target.value })); setFieldErrors((current) => ({ ...current, titulo: null })); }} required value={cronogramaForm.titulo} />{fieldErrors.titulo ? <span className="field-error-text">{fieldErrors.titulo}</span> : null}</div>
            </div>
            <div className="admin-eval-field"><label>Descricao</label><textarea aria-invalid={!!fieldErrors.descricao} className="text-area" onChange={(e) => { setCronogramaForm((c) => ({ ...c, descricao: e.target.value })); setFieldErrors((current) => ({ ...current, descricao: null })); }} style={{ minHeight: 60 }} value={cronogramaForm.descricao} />{fieldErrors.descricao ? <span className="field-error-text">{fieldErrors.descricao}</span> : null}</div>
            <div className="admin-form-row">
              <div className="admin-eval-field"><label>Inicio</label><input aria-invalid={!!fieldErrors.inicioEm} onChange={(e) => { setCronogramaForm((c) => ({ ...c, inicioEm: e.target.value })); setFieldErrors((current) => ({ ...current, inicioEm: null })); }} required type="datetime-local" value={cronogramaForm.inicioEm} />{fieldErrors.inicioEm ? <span className="field-error-text">{fieldErrors.inicioEm}</span> : null}</div>
              <div className="admin-eval-field"><label>Fim</label><input aria-invalid={!!fieldErrors.fimEm} onChange={(e) => { setCronogramaForm((c) => ({ ...c, fimEm: e.target.value })); setFieldErrors((current) => ({ ...current, fimEm: null })); }} required type="datetime-local" value={cronogramaForm.fimEm} />{fieldErrors.fimEm ? <span className="field-error-text">{fieldErrors.fimEm}</span> : null}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="admin-page-cta" disabled={busy} type="submit" style={{ fontSize: 13, padding: "8px 16px" }}>{editingCronogramaId ? "Salvar" : "Criar"}</button>
              <button className="admin-pub-btn-preview" onClick={() => { setShowCronogramaForm(false); setEditingCronogramaId(null); }} type="button">Cancelar</button>
            </div>
          </form>
        )}
      </div>

      {/* Temas de redacao */}
      <div className="admin-form-card">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 className="admin-form-card-title" style={{ flex: 1 }}>Temas de redacao</h2>
          <button className="admin-pub-btn-preview" onClick={() => { setShowTemaForm(true); setEditingTemaId(null); setTemaForm({ titulo: "", descricao: "", ordem: "0", ativo: true }); }} type="button">+ Adicionar</button>
        </div>

        {data.temasRedacao.map((t, i) => (
          <div className="admin-line-row" key={t.id} style={i % 2 === 0 ? { background: "#F8FAFC" } : undefined}>
            <span className="admin-line-name">{t.titulo}</span>
            <span className="admin-line-meta">Ordem: {t.ordem}</span>
            <StatusBadge variant={t.ativo ? "success" : "neutral"}>{t.ativo ? "Ativo" : "Inativo"}</StatusBadge>
            <button className="admin-line-edit" onClick={() => handleEditTema(t.id)} title="Editar" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z"/></svg>
            </button>
            <button className="admin-line-edit" onClick={() => wrap(async () => { await deleteTemaRedacaoAdmin(t.id, token!); setFeedback({ type: "success", text: "Tema removido." }); })} title="Remover" type="button" style={{ color: "#EF4444" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        ))}
        {!data.temasRedacao.length && <span style={{ fontSize: 13, color: "#94A3B8" }}>Nenhum tema cadastrado.</span>}

        {showTemaForm && (
          <form onSubmit={submitTema} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{editingTemaId ? "Editar tema" : "Novo tema"}</span>
            <div className="admin-form-row">
              <div className="admin-eval-field"><label>Titulo</label><input aria-invalid={!!fieldErrors.titulo} onChange={(e) => { setTemaForm((c) => ({ ...c, titulo: e.target.value })); setFieldErrors((current) => ({ ...current, titulo: null })); }} required value={temaForm.titulo} />{fieldErrors.titulo ? <span className="field-error-text">{fieldErrors.titulo}</span> : null}</div>
              <div className="admin-eval-field"><label>Ordem</label><input aria-invalid={!!fieldErrors.ordem} min={0} onChange={(e) => { setTemaForm((c) => ({ ...c, ordem: e.target.value })); setFieldErrors((current) => ({ ...current, ordem: null })); }} type="number" value={temaForm.ordem} />{fieldErrors.ordem ? <span className="field-error-text">{fieldErrors.ordem}</span> : null}</div>
              <div className="admin-eval-field"><label>Ativo</label><select aria-invalid={!!fieldErrors.ativo} className="select-field" onChange={(e) => { setTemaForm((c) => ({ ...c, ativo: e.target.value === "true" })); setFieldErrors((current) => ({ ...current, ativo: null })); }} value={String(temaForm.ativo)}><option value="true">Sim</option><option value="false">Nao</option></select>{fieldErrors.ativo ? <span className="field-error-text">{fieldErrors.ativo}</span> : null}</div>
            </div>
            <div className="admin-eval-field"><label>Descricao</label><textarea aria-invalid={!!fieldErrors.descricao} className="text-area" onChange={(e) => { setTemaForm((c) => ({ ...c, descricao: e.target.value })); setFieldErrors((current) => ({ ...current, descricao: null })); }} style={{ minHeight: 60 }} value={temaForm.descricao} />{fieldErrors.descricao ? <span className="field-error-text">{fieldErrors.descricao}</span> : null}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="admin-page-cta" disabled={busy} type="submit" style={{ fontSize: 13, padding: "8px 16px" }}>{editingTemaId ? "Salvar" : "Criar"}</button>
              <button className="admin-pub-btn-preview" onClick={() => { setShowTemaForm(false); setEditingTemaId(null); }} type="button">Cancelar</button>
            </div>
          </form>
        )}
      </div>

      {/* Danger zone */}
      <div className="admin-form-card" style={{ borderColor: "#FECACA" }}>
        <h2 className="admin-form-card-title" style={{ color: "#DC2626" }}>Zona de risco</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>A exclusao do edital remove permanentemente todas as inscricoes, cronogramas e publicacoes vinculadas.</p>
        {!confirmDelete ? (
          <button className="admin-pub-btn-preview" onClick={() => setConfirmDelete(true)} style={{ color: "#DC2626", borderColor: "#FECACA" }} type="button">Excluir edital</button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PageFeedback type="error" title="Confirmar exclusao" description="Esta acao e irreversivel. Deseja realmente excluir este edital?" />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="admin-pub-btn-publish" disabled={busy} onClick={() => wrap(async () => { await deleteAdminEdital(editalId!, token!); router.replace("/admin/editais"); })} style={{ background: "#DC2626" }} type="button">Confirmar exclusao</button>
              <button className="admin-pub-btn-preview" onClick={() => setConfirmDelete(false)} type="button">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
