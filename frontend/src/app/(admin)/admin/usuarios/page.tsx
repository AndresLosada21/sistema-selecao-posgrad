"use client";

import { useCallback, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { AdminEditalCombobox } from "@/components/shared/admin-edital-combobox";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { statusContaOptions, type StatusConta } from "@/lib/enums";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { listAllAdminEditais } from "@/modules/admin-edital/api";
import { listAdminUsuarios, updateAdminUsuarioEscopos, updateAdminUsuarioPerfis, updateAdminUsuarioStatus } from "@/modules/admin-usuarios/api";
import type { AdminUsuariosResponse } from "@/modules/admin-usuarios/types";
import type { EditalListItem } from "@/modules/edital/types";

const availableRoles = ["CANDIDATO", "AVALIADOR", "ADMIN"] as const;
type ScopeDraft = { editalId: string; linhaPesquisaId: string };

const iconSettings = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>;
const iconChevL = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>;
const iconChevR = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>;

export default function AdminUsuariosPage() {
  const session = useSession();
  const [data, setData] = useState<AdminUsuariosResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editais, setEditais] = useState<EditalListItem[]>([]);
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, ScopeDraft>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, StatusConta>>({});
  const [roleDrafts, setRoleDrafts] = useState<Record<string, Set<string>>>({});
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session.token) return;
    const [response, editaisResponse] = await Promise.all([listAdminUsuarios(session.token, { page, pageSize: 20 }), listAllAdminEditais(session.token)]);
    setData(response); setEditais(editaisResponse.items);
  }, [page, session.token]);

  useAbortableEffect(async (signal) => {
    try { await load(); if (signal.aborted) return; setStatus("ready"); }
    catch (error) { if (signal.aborted) return; if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); setStatus("error"); }
  }, [load, session.signOut]);

  async function handleStatus(usuarioId: string, statusConta: StatusConta) {
    if (!session.token) return;
    setBusyUserId(usuarioId); setMessage(null);
    try { await updateAdminUsuarioStatus(usuarioId, { statusConta }, session.token); await load(); setMessage({ type: "success", text: "Status atualizado." }); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusyUserId(null); }
  }

  async function handleRoleToggle(usuarioId: string, nextRoles: string[]) {
    if (!session.token) return;
    setBusyUserId(usuarioId); setMessage(null);
    try { await updateAdminUsuarioPerfis(usuarioId, { perfis: nextRoles }, session.token); await load(); setMessage({ type: "success", text: "Perfis atualizados." }); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusyUserId(null); }
  }

  async function handleEscopos(usuarioId: string, escopos: Array<{ editalId: string; linhaPesquisaId?: string | null }>) {
    if (!session.token) return;
    setBusyUserId(usuarioId); setMessage(null);
    try { await updateAdminUsuarioEscopos(usuarioId, { escopos }, session.token); await load(); setMessage({ type: "success", text: "Escopos atualizados." }); }
    catch (error) { if (isUnauthorizedError(error)) { session.signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusyUserId(null); }
  }

  function updateScopeDraft(usuarioId: string, next: Partial<ScopeDraft>) {
    setScopeDrafts((c) => ({ ...c, [usuarioId]: { editalId: c[usuarioId]?.editalId ?? "", linhaPesquisaId: c[usuarioId]?.linhaPesquisaId ?? "", ...next } }));
  }

  function getAvailableLinhas(editalId: string) { return editais.find((e) => e.id === editalId)?.linhasPesquisa ?? []; }

  async function handleAddEscopo(usuarioId: string, currentEscopos: Array<{ editalId: string; linhaPesquisaId: string | null }>) {
    const draft = scopeDrafts[usuarioId];
    if (!draft?.editalId) { setMessage({ type: "error", text: "Selecione um edital." }); return; }
    const nextEscopos = [...currentEscopos, { editalId: draft.editalId, linhaPesquisaId: draft.linhaPesquisaId || undefined }]
      .filter((e, i, a) => a.findIndex((c) => c.editalId === e.editalId && c.linhaPesquisaId === (e.linhaPesquisaId ?? null)) === i);
    await handleEscopos(usuarioId, nextEscopos);
    updateScopeDraft(usuarioId, { editalId: "", linhaPesquisaId: "" });
  }

  async function handleRemoveEscopo(usuarioId: string, currentEscopos: Array<{ editalId: string; linhaPesquisaId: string | null }>, toRemove: { editalId: string; linhaPesquisaId: string | null }) {
    await handleEscopos(usuarioId, currentEscopos.filter((e) => !(e.editalId === toRemove.editalId && e.linhaPesquisaId === toRemove.linhaPesquisaId)));
  }

  if (status === "loading") return <LoadingState title="Carregando usuarios" description="Consultando a base administrativa." />;
  if (status === "error") return <ErrorState title="Falha ao carregar usuarios" description={message?.text} />;

  const totalPages = Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {message ? <PageFeedback type={message.type} title={message.type === "success" ? "Sucesso" : "Erro"} description={message.text} /> : null}

      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <h1>Usuarios</h1>
          <p>Gestao de contas, perfis, bloqueios e escopos de avaliador.</p>
        </div>
      </div>

      {/* Table */}
      {data?.items.length ? (
        <div className="admin-table">
          <div className="admin-table-head">
            <span className="admin-table-cell admin-table-cell--grow">Nome</span>
            <span className="admin-table-cell" style={{ width: 240 }}>E-mail</span>
            <span className="admin-table-cell" style={{ width: 140 }}>Perfis</span>
            <span className="admin-table-cell admin-table-cell--center" style={{ width: 100 }}>Conta</span>
            <span className="admin-table-cell admin-table-cell--center" style={{ width: 80 }}>Acoes</span>
          </div>
          {data.items.map((item) => {
            const isExpanded = expandedUser === item.id;
            const currentRoles = new Set(item.perfis);
            return (
              <div key={item.id}>
                <div className="admin-table-row">
                  <span className="admin-table-cell admin-table-cell--grow admin-table-cell--bold">{item.nomeCompleto}</span>
                  <span className="admin-table-cell admin-table-cell--muted" style={{ width: 240 }}>{item.email}</span>
                  <span className="admin-table-cell admin-table-cell--muted" style={{ width: 140 }}>{item.perfis.map((r) => getStatusLabel(r)).join(", ")}</span>
                  <span className="admin-table-cell admin-table-cell--center" style={{ width: 100 }}>
                    <StatusBadge variant={getStatusVariant(item.statusConta)}>{getStatusLabel(item.statusConta)}</StatusBadge>
                  </span>
                  <span className="admin-table-cell admin-table-cell--center" style={{ width: 80 }}>
                    <button type="button" onClick={() => setExpandedUser(isExpanded ? null : item.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>{iconSettings}</button>
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded ? (
                  <div style={{ padding: "16px 24px", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Status */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Status da conta:</span>
                      <select style={{ height: 36, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 13 }} disabled={busyUserId === item.id} value={statusDrafts[item.id] ?? item.statusConta} onChange={(e) => setStatusDrafts((d) => ({ ...d, [item.id]: e.target.value as StatusConta }))}>
                        {statusContaOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
                      </select>
                      {statusDrafts[item.id] && statusDrafts[item.id] !== item.statusConta ? (
                        <ActionButton disabled={busyUserId === item.id} onClick={() => { const s = statusDrafts[item.id]; if (!s) return; handleStatus(item.id, s); setStatusDrafts((d) => { const n = { ...d }; delete n[item.id]; return n; }); }} size="sm" type="button">Confirmar</ActionButton>
                      ) : null}
                    </div>

                    {/* Perfis */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Perfis:</span>
                      {availableRoles.map((role) => {
                        const draftRoles = roleDrafts[item.id] ?? currentRoles;
                        return (
                          <label key={role} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                            <input type="checkbox" checked={draftRoles.has(role)} disabled={busyUserId === item.id} onChange={() => { setRoleDrafts((d) => { const next = new Set(d[item.id] ?? currentRoles); if (next.has(role)) next.delete(role); else next.add(role); return { ...d, [item.id]: next }; }); }} />
                            {getStatusLabel(role)}
                          </label>
                        );
                      })}
                      {roleDrafts[item.id] && [...roleDrafts[item.id]].sort().join(",") !== [...currentRoles].sort().join(",") ? (
                        <ActionButton disabled={busyUserId === item.id} onClick={() => { const r = roleDrafts[item.id]; if (!r) return; handleRoleToggle(item.id, [...r]); setRoleDrafts((d) => { const n = { ...d }; delete n[item.id]; return n; }); }} size="sm" type="button">Confirmar perfis</ActionButton>
                      ) : null}
                    </div>

                    {/* Escopos */}
                    {currentRoles.has("AVALIADOR") ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Escopos do avaliador:</span>
                        {item.escoposAvaliacao.length ? item.escoposAvaliacao.map((escopo) => {
                          const edital = editais.find((e) => e.id === escopo.editalId);
                          const linha = edital?.linhasPesquisa.find((l) => l.id === escopo.linhaPesquisaId);
                          return (
                            <div key={`${escopo.editalId}-${escopo.linhaPesquisaId ?? "all"}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#475569" }}>
                              <span>{edital ? edital.numero : escopo.editalId}{linha ? ` · ${linha.nome}` : " · Todas as linhas"}</span>
                              <ActionButton disabled={busyUserId === item.id} onClick={() => handleRemoveEscopo(item.id, item.escoposAvaliacao, escopo)} size="sm" type="button" variant="ghost">Remover</ActionButton>
                            </div>
                          );
                        }) : <span style={{ fontSize: 12, color: "#94A3B8" }}>Nenhum escopo configurado.</span>}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                          <div style={{ flex: 1 }}>
                            <AdminEditalCombobox allowEmpty={false} disabled={busyUserId === item.id} emptyLabel="Selecione o edital" label="" onChange={(v) => updateScopeDraft(item.id, { editalId: v, linhaPesquisaId: "" })} onSelectOption={(e) => setEditais((c) => c.some((x) => x.id === e.id) ? c : [...c, e])} token={session.token ?? ""} value={scopeDrafts[item.id]?.editalId ?? ""} />
                          </div>
                          <select style={{ height: 36, borderRadius: 6, border: "1px solid #CBD5E1", padding: "0 10px", fontSize: 13 }} disabled={busyUserId === item.id || !scopeDrafts[item.id]?.editalId} value={scopeDrafts[item.id]?.linhaPesquisaId ?? ""} onChange={(e) => updateScopeDraft(item.id, { linhaPesquisaId: e.target.value })}>
                            <option value="">Todas as linhas</option>
                            {getAvailableLinhas(scopeDrafts[item.id]?.editalId ?? "").map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                          </select>
                          <ActionButton disabled={busyUserId === item.id || !scopeDrafts[item.id]?.editalId} onClick={() => handleAddEscopo(item.id, item.escoposAvaliacao)} size="sm" type="button" variant="secondary">Adicionar</ActionButton>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Pagination */}
          <div className="admin-pagination">
            <span>Mostrando {((page - 1) * 20) + 1}-{Math.min(page * 20, data.total)} de {data.total} usuarios</span>
            <div className="admin-pagination-controls">
              <button type="button" className="admin-pagination-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{iconChevL}</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} type="button" className={`admin-pagination-btn${page === i + 1 ? " admin-pagination-btn--active" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{iconChevR}</button>
            </div>
          </div>
        </div>
      ) : <EmptyState title="Sem usuarios" description="Nenhum usuario encontrado." />}
    </div>
  );
}
