"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { cursoNivelOptions, statusEditalOptions, type CursoNivel, type StatusEdital } from "@/lib/enums";
import { createAdminEdital, listAdminEditais } from "@/modules/admin-edital/api";
import { formatIsoDate } from "@/modules/edital/formatters";
import type { AdminEditaisResponse } from "@/modules/admin-edital/types";

export default function AdminEditaisPage() {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [data, setData] = useState<AdminEditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{
    numero: string;
    titulo: string;
    descricao: string;
    ano: string;
    semestre: string;
    cursoNivel: CursoNivel;
    status: StatusEdital;
    publicadoEm: string;
  }>({ numero: "", titulo: "", descricao: "", ano: String(new Date().getFullYear()), semestre: "1", cursoNivel: "MESTRADO", status: "RASCUNHO", publicadoEm: "" });

  const load = useCallback(async () => {
    if (!token) {
      return;
    }

    const response = await listAdminEditais(token, { page, pageSize: 20 });
    setData(response);
  }, [page, token]);

  useAbortableEffect(async (signal) => {
    if (!token) {
      return;
    }

    try {
      await load();
      if (signal.aborted) return;
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
      setStatus("error");
    }
  }, [load, signOut, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true); setMessage(null);
    try {
      await createAdminEdital({
        numero: form.numero,
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        ano: Number(form.ano),
        semestre: form.semestre ? Number(form.semestre) : undefined,
        cursoNivel: form.cursoNivel,
        status: form.status,
        publicadoEm: form.publicadoEm || undefined,
      }, token);
      await load();
      setForm({ numero: "", titulo: "", descricao: "", ano: String(new Date().getFullYear()), semestre: "1", cursoNivel: "MESTRADO", status: "RASCUNHO", publicadoEm: "" });
      setMessage({ type: "success", text: "Edital criado e lista atualizada." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando editais admin" description="Consultando os editais para manutencao administrativa." />;
  if (status === "error") return <ErrorState title="Falha ao carregar editais" description={message?.text} />;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Retorno operacional" description={message.text} /> : null}
      <PageFeedback type="info" title="Cadastro administrativo de editais" description="Use esta area para criar e manter editais, linhas e cronogramas sem depender de seed ou banco manual." />

      <SectionCard title="Novo edital" description="Formulario minimo para criacao administrativa do edital.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field-block"><span>Numero</span><input onChange={(e) => setForm((c) => ({ ...c, numero: e.target.value }))} required value={form.numero} /></label>
          <label className="field-block"><span>Titulo</span><input onChange={(e) => setForm((c) => ({ ...c, titulo: e.target.value }))} required value={form.titulo} /></label>
          <label className="field-block"><span>Descricao</span><textarea className="text-area" onChange={(e) => setForm((c) => ({ ...c, descricao: e.target.value }))} value={form.descricao} /></label>
          <label className="field-block"><span>Ano</span><input min="2024" onChange={(e) => setForm((c) => ({ ...c, ano: e.target.value }))} required type="number" value={form.ano} /></label>
          <label className="field-block"><span>Semestre</span><select className="select-field" onChange={(e) => setForm((c) => ({ ...c, semestre: e.target.value }))} value={form.semestre}><option value="1">1</option><option value="2">2</option></select></label>
          <label className="field-block"><span>Curso</span><select className="select-field" onChange={(e) => setForm((c) => ({ ...c, cursoNivel: e.target.value as CursoNivel }))} value={form.cursoNivel}>{cursoNivelOptions.map((option) => <option key={option} value={option}>{getStatusLabel(option)}</option>)}</select></label>
          <label className="field-block"><span>Status</span><select className="select-field" onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as StatusEdital }))} value={form.status}>{statusEditalOptions.map((option) => <option key={option} value={option}>{getStatusLabel(option)}</option>)}</select></label>
          <label className="field-block"><span>Publicado em (opcional)</span><input onChange={(e) => setForm((c) => ({ ...c, publicadoEm: e.target.value }))} type="datetime-local" value={form.publicadoEm} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Criar edital</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Editais cadastrados" description="Abertura rapida para manutencao de linhas e cronograma por edital.">
        {data?.items.length ? (
          <div className="content-list">
            {data.items.map((item) => (
              <article className="content-item" key={item.id}>
                <div className="content-item-row"><strong>{item.numero}</strong><StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge></div>
                <p>{item.titulo}</p>
                <small>Curso: {getStatusLabel(item.cursoNivel)}</small>
                <small>Publicado em: {formatIsoDate(item.publicadoEm)}</small>
                <div className="content-item-links">
                  <Link className="nav-link" href={`/admin/editais/${item.id}`}>Gerenciar edital</Link>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="Sem editais" description="Nenhum edital foi cadastrado ainda nesta base." />}
        <div className="content-item-links">
          <ActionButton disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="ghost">Pagina anterior</ActionButton>
          <small>{`Pagina ${data?.page ?? page}`}</small>
          <ActionButton disabled={(data?.page ?? page) * (data?.pageSize ?? 20) >= (data?.total ?? 0)} onClick={() => setPage((current) => current + 1)} type="button" variant="ghost">Proxima pagina</ActionButton>
        </div>
      </SectionCard>
    </div>
  );
}
