"use client";

import { useCallback, useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { statusContaOptions, type StatusConta } from "@/lib/enums";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listAdminEditais } from "@/modules/admin-edital/api";
import { listAdminUsuarios, updateAdminUsuarioEscopos, updateAdminUsuarioPerfis, updateAdminUsuarioStatus } from "@/modules/admin-usuarios/api";
import type { AdminUsuariosResponse } from "@/modules/admin-usuarios/types";
import type { EditalListItem } from "@/modules/edital/types";

const availableRoles = ["CANDIDATO", "AVALIADOR", "ADMIN"] as const;
type ScopeDraft = {
  editalId: string;
  linhaPesquisaId: string;
};

export default function AdminUsuariosPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<AdminUsuariosResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editais, setEditais] = useState<EditalListItem[]>([]);
  const [scopeDrafts, setScopeDrafts] = useState<Record<string, ScopeDraft>>({});

  const load = useCallback(async () => {
    if (!token) return;
    const [response, editaisResponse] = await Promise.all([
      listAdminUsuarios(token, { page, pageSize: 20 }),
      listAdminEditais(token),
    ]);
    setData(response);
    setEditais(editaisResponse.items);
  }, [page, token]);

  useEffect(() => {
    load().then(() => setStatus("ready")).catch((error) => {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
      setStatus("error");
    });
  }, [load, signOut]);

  async function handleStatus(usuarioId: string, statusConta: StatusConta) {
    if (!token) return;
    setBusyUserId(usuarioId); setMessage(null);
    try { await updateAdminUsuarioStatus(usuarioId, { statusConta }, token); await load(); setMessage({ type: "success", text: "Status da conta atualizado." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusyUserId(null); }
  }

  async function handleRoleToggle(usuarioId: string, nextRoles: string[]) {
    if (!token) return;
    setBusyUserId(usuarioId); setMessage(null);
    try { await updateAdminUsuarioPerfis(usuarioId, { perfis: nextRoles }, token); await load(); setMessage({ type: "success", text: "Perfis atualizados." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusyUserId(null); }
  }

  async function handleEscopos(usuarioId: string, escopos: Array<{ editalId: string; linhaPesquisaId?: string | null }>) {
    if (!token) return;
    setBusyUserId(usuarioId); setMessage(null);
    try { await updateAdminUsuarioEscopos(usuarioId, { escopos }, token); await load(); setMessage({ type: "success", text: "Escopos do avaliador atualizados." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusyUserId(null); }
  }

  function updateScopeDraft(usuarioId: string, nextDraft: Partial<ScopeDraft>) {
    setScopeDrafts((current) => ({
      ...current,
      [usuarioId]: {
        editalId: current[usuarioId]?.editalId ?? "",
        linhaPesquisaId: current[usuarioId]?.linhaPesquisaId ?? "",
        ...nextDraft,
      },
    }));
  }

  function getAvailableLinhas(editalId: string) {
    return editais.find((edital) => edital.id === editalId)?.linhasPesquisa ?? [];
  }

  async function handleAddEscopo(usuarioId: string, currentEscopos: Array<{ editalId: string; linhaPesquisaId: string | null }>) {
    const draft = scopeDrafts[usuarioId];

    if (!draft?.editalId) {
      setMessage({ type: "error", text: "Selecione um edital antes de adicionar um escopo." });
      return;
    }

    const nextEscopos = [
      ...currentEscopos,
      {
        editalId: draft.editalId,
        linhaPesquisaId: draft.linhaPesquisaId || undefined,
      },
    ].filter((escopo, index, array) => array.findIndex((current) => current.editalId === escopo.editalId && current.linhaPesquisaId === (escopo.linhaPesquisaId ?? null)) === index);

    await handleEscopos(usuarioId, nextEscopos);
    updateScopeDraft(usuarioId, { editalId: "", linhaPesquisaId: "" });
  }

  async function handleRemoveEscopo(usuarioId: string, currentEscopos: Array<{ editalId: string; linhaPesquisaId: string | null }>, escopoToRemove: { editalId: string; linhaPesquisaId: string | null }) {
    const nextEscopos = currentEscopos.filter((escopo) => !(escopo.editalId === escopoToRemove.editalId && escopo.linhaPesquisaId === escopoToRemove.linhaPesquisaId));
    await handleEscopos(usuarioId, nextEscopos);
  }

  if (status === "loading") return <LoadingState title="Carregando usuarios" description="Consultando a base administrativa de usuarios e perfis." />;
  if (status === "error") return <ErrorState title="Falha ao carregar usuarios" description={message?.text} />;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Retorno operacional" description={message.text} /> : null}
      <PageFeedback type="info" title="Gestao administrativa de usuarios" description="Altere status de conta e perfis operacionais sem depender de seed ou banco manual." />

      <SectionCard title="Usuarios cadastrados" description={`Foram encontrados ${data?.total ?? 0} usuario(s) na base.`}>
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => {
              const currentRoles = new Set(item.perfis);
              return (
                <article className="content-item" key={item.id}>
                  <div className="content-item-row"><strong>{item.nomeCompleto}</strong><StatusBadge variant={getStatusVariant(item.statusConta)}>{getStatusLabel(item.statusConta)}</StatusBadge></div>
                  <small>Email: {item.email}</small>
                  <small>CPF: {item.cpf ?? "nao informado"}</small>
                  <small>Telefone: {item.telefone ?? "nao informado"}</small>
                  <small>E-mail verificado em: {formatIsoDate(item.emailVerificadoEm)}</small>
                  <small>Perfis atuais: {item.perfis.map((role) => getStatusLabel(role)).join(", ")}</small>
                  <small>Escopos de avaliacao: {item.escoposAvaliacao.length ? item.escoposAvaliacao.map((escopo) => escopo.linhaPesquisaId ? `${escopo.editalId}:${escopo.linhaPesquisaId}` : escopo.editalId).join(", ") : "nenhum"}</small>
                  <small>Criado em: {formatIsoDate(item.criadoEm)}</small>

                  <label className="field-block"><span>Status da conta</span><select className="select-field" disabled={busyUserId === item.id} onChange={(event) => handleStatus(item.id, event.target.value as StatusConta)} value={item.statusConta}>{statusContaOptions.map((value) => <option key={value} value={value}>{getStatusLabel(value)}</option>)}</select></label>

                  <div className="content-list">
                    {availableRoles.map((role) => {
                      const checked = currentRoles.has(role);
                      const nextRoles = checked ? item.perfis.filter((itemRole) => itemRole !== role) : [...item.perfis, role];
                      return (
                        <label className="field-inline" key={role}>
                          <input checked={checked} disabled={busyUserId === item.id} onChange={() => handleRoleToggle(item.id, nextRoles)} type="checkbox" />
                          <span>{getStatusLabel(role)}</span>
                        </label>
                      );
                    })}
                  </div>
                  {currentRoles.has("AVALIADOR") ? (
                    <div className="field-block">
                      <span>Escopos do avaliador</span>
                      <div className="content-list">
                        {item.escoposAvaliacao.length ? item.escoposAvaliacao.map((escopo) => {
                          const edital = editais.find((current) => current.id === escopo.editalId);
                          const linha = edital?.linhasPesquisa.find((current) => current.id === escopo.linhaPesquisaId);
                          return (
                            <div className="content-item-row" key={`${escopo.editalId}-${escopo.linhaPesquisaId ?? "all"}`}>
                              <small>{edital ? `${edital.numero}` : escopo.editalId}{linha ? ` · ${linha.nome}` : " · Todas as linhas"}</small>
                              <ActionButton disabled={busyUserId === item.id} onClick={() => handleRemoveEscopo(item.id, item.escoposAvaliacao, escopo)} size="sm" type="button" variant="ghost">Remover</ActionButton>
                            </div>
                          );
                        }) : <small>Nenhum escopo configurado.</small>}
                        <div className="content-item-row">
                          <select className="select-field" disabled={busyUserId === item.id} onChange={(event) => updateScopeDraft(item.id, { editalId: event.target.value, linhaPesquisaId: "" })} value={scopeDrafts[item.id]?.editalId ?? ""}>
                            <option value="">Selecione o edital</option>
                            {editais.map((edital) => <option key={edital.id} value={edital.id}>{`${edital.numero} · ${edital.titulo}`}</option>)}
                          </select>
                          <select className="select-field" disabled={busyUserId === item.id || !(scopeDrafts[item.id]?.editalId ?? "")} onChange={(event) => updateScopeDraft(item.id, { linhaPesquisaId: event.target.value })} value={scopeDrafts[item.id]?.linhaPesquisaId ?? ""}>
                            <option value="">Todas as linhas</option>
                            {getAvailableLinhas(scopeDrafts[item.id]?.editalId ?? "").map((linha) => <option key={linha.id} value={linha.id}>{linha.nome}</option>)}
                          </select>
                          <ActionButton disabled={busyUserId === item.id || !(scopeDrafts[item.id]?.editalId ?? "")} onClick={() => handleAddEscopo(item.id, item.escoposAvaliacao)} size="sm" type="button" variant="secondary">Adicionar escopo</ActionButton>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {busyUserId === item.id ? <ActionButton disabled loading type="button">Atualizando...</ActionButton> : null}
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="Sem usuarios" description="Nenhum usuario foi retornado pela base administrativa." />}
        <div className="content-item-links">
          <ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="ghost">Pagina anterior</ActionButton>
          <small>{`Pagina ${data?.page ?? page}`}</small>
          <ActionButton disabled={(data?.page ?? page) * (data?.pageSize ?? 20) >= (data?.total ?? 0)} onClick={() => setPage((current) => current + 1)} type="button" variant="ghost">Proxima pagina</ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}
