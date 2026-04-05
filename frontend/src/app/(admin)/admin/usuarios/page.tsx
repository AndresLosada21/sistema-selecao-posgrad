"use client";

import { useCallback, useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";
import { listAdminUsuarios, updateAdminUsuarioEscopos, updateAdminUsuarioPerfis, updateAdminUsuarioStatus } from "@/modules/admin-usuarios/api";
import type { AdminUsuariosResponse } from "@/modules/admin-usuarios/types";

const availableRoles = ["CANDIDATO", "AVALIADOR", "ADMIN"] as const;
const accountStatusOptions = ["CRIADA", "ATIVA", "BLOQUEADA"] as const;

export default function AdminUsuariosPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<AdminUsuariosResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!token) return;
    const response = await listAdminUsuarios(token, { page, pageSize: 20 });
    setData(response);
  }, [page, token]);

  useEffect(() => {
    load().then(() => setStatus("ready")).catch((error) => {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
      setStatus("error");
    });
  }, [load, signOut]);

  async function handleStatus(usuarioId: string, statusConta: string) {
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

  async function handleEscopos(usuarioId: string, raw: string) {
    if (!token) return;
    const escopos = raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((scope) => {
        const [editalId, linhaPesquisaId] = scope.split(":").map((value) => value.trim());
        return { editalId, linhaPesquisaId: linhaPesquisaId || undefined };
      });
    setBusyUserId(usuarioId); setMessage(null);
    try { await updateAdminUsuarioEscopos(usuarioId, { escopos }, token); await load(); setMessage({ type: "success", text: "Escopos do avaliador atualizados." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusyUserId(null); }
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

                  <label className="field-block"><span>Status da conta</span><select className="select-field" disabled={busyUserId === item.id} onChange={(event) => handleStatus(item.id, event.target.value)} value={item.statusConta}>{accountStatusOptions.map((value) => <option key={value} value={value}>{getStatusLabel(value)}</option>)}</select></label>

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
                    <label className="field-block">
                      <span>Escopos do avaliador (editalId ou editalId:linhaPesquisaId, separados por virgula)</span>
                      <input defaultValue={item.escoposAvaliacao.map((escopo) => escopo.linhaPesquisaId ? `${escopo.editalId}:${escopo.linhaPesquisaId}` : escopo.editalId).join(", ")} disabled={busyUserId === item.id} onBlur={(event) => handleEscopos(item.id, event.target.value)} />
                    </label>
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
