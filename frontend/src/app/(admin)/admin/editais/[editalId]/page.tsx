"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { cursoNivelOptions, statusEditalOptions, tipoCronogramaEditalOptions, type CursoNivel, type StatusEdital, type TipoCronogramaEdital } from "@/lib/enums";
import {
  createCronogramaAdmin,
  createLinhaPesquisaAdmin,
  deleteCronogramaAdmin,
  deleteLinhaPesquisaAdmin,
  deleteAdminEdital,
  getAdminEditalById,
  updateCronogramaAdmin,
  updateAdminEdital,
  updateLinhaPesquisaAdmin,
} from "@/modules/admin-edital/api";
import type { AdminEditalDetalhe } from "@/modules/admin-edital/types";

type Props = { params: Promise<{ editalId: string }> };

export default function AdminEditalDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<AdminEditalDetalhe | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editalForm, setEditalForm] = useState<{
    numero: string;
    titulo: string;
    descricao: string;
    ano: string;
    semestre: string;
    cursoNivel: CursoNivel;
    status: StatusEdital;
    publicadoEm: string;
  }>({ numero: "", titulo: "", descricao: "", ano: "", semestre: "1", cursoNivel: "MESTRADO", status: "RASCUNHO", publicadoEm: "" });
  const [editingLinhaId, setEditingLinhaId] = useState<string | null>(null);
  const [linhaForm, setLinhaForm] = useState({ nome: "", descricao: "", vagasAmplaConcorrencia: "0", vagasAcoesAfirmativas: "0", vagasPcd: "0" });
  const [editingCronogramaId, setEditingCronogramaId] = useState<string | null>(null);
  const [cronogramaForm, setCronogramaForm] = useState<{
    tipo: TipoCronogramaEdital;
    titulo: string;
    descricao: string;
    inicioEm: string;
    fimEm: string;
  }>({ tipo: "INSCRICAO", titulo: "", descricao: "", inicioEm: "", fimEm: "" });

  useEffect(() => { params.then((resolved) => setEditalId(resolved.editalId)); }, [params]);

  const load = useCallback(async () => {
    if (!editalId || !token) return;
    const response = await getAdminEditalById(editalId, token);
    setData(response);
    setEditalForm({
      numero: response.numero,
      titulo: response.titulo,
      descricao: response.descricao ?? "",
      ano: String(response.ano),
      semestre: String(response.semestre ?? 1),
      cursoNivel: response.cursoNivel as CursoNivel,
      status: response.status as StatusEdital,
      publicadoEm: response.publicadoEm ?? "",
    });
  }, [editalId, token]);

  useEffect(() => {
    if (!editalId || !token) return;
    load()
      .then(() => setStatus("ready"))
      .catch((error) => {
        if (isUnauthorizedError(error)) { signOut(); return; }
        setMessage({ type: "error", text: getErrorMessage(error) });
        setStatus("error");
      });
  }, [editalId, load, signOut, token]);

  async function submitEdital(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      await updateAdminEdital(editalId, {
        numero: editalForm.numero,
        titulo: editalForm.titulo,
        descricao: editalForm.descricao || undefined,
        ano: Number(editalForm.ano),
        semestre: editalForm.semestre ? Number(editalForm.semestre) : undefined,
        cursoNivel: editalForm.cursoNivel,
        status: editalForm.status,
        publicadoEm: editalForm.publicadoEm || undefined,
      }, token);
      await load();
      setMessage({ type: "success", text: "Edital atualizado." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function submitLinha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      const payload = {
        nome: linhaForm.nome,
        descricao: linhaForm.descricao || undefined,
        vagasAmplaConcorrencia: Number(linhaForm.vagasAmplaConcorrencia),
        vagasAcoesAfirmativas: Number(linhaForm.vagasAcoesAfirmativas),
        vagasPcd: Number(linhaForm.vagasPcd),
      };

      if (editingLinhaId) {
        await updateLinhaPesquisaAdmin(editingLinhaId, payload, token);
      } else {
        await createLinhaPesquisaAdmin(editalId, payload, token);
      }

      setEditingLinhaId(null);
      setLinhaForm({ nome: "", descricao: "", vagasAmplaConcorrencia: "0", vagasAcoesAfirmativas: "0", vagasPcd: "0" });
      await load();
      setMessage({ type: "success", text: editingLinhaId ? "Linha de pesquisa atualizada." : "Linha de pesquisa criada." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function submitCronograma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try {
      const payload = {
        tipo: cronogramaForm.tipo,
        titulo: cronogramaForm.titulo,
        descricao: cronogramaForm.descricao || undefined,
        inicioEm: new Date(cronogramaForm.inicioEm).toISOString(),
        fimEm: new Date(cronogramaForm.fimEm).toISOString(),
      };

      if (editingCronogramaId) {
        await updateCronogramaAdmin(editingCronogramaId, payload, token);
      } else {
        await createCronogramaAdmin(editalId, payload, token);
      }

      setEditingCronogramaId(null);
      setCronogramaForm({ tipo: "INSCRICAO", titulo: "", descricao: "", inicioEm: "", fimEm: "" });
      await load();
      setMessage({ type: "success", text: editingCronogramaId ? "Cronograma atualizado." : "Cronograma criado." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function handleDeleteLinha(id: string) {
    if (!token) return;
    setBusy(true); setMessage(null);
    try {
      await deleteLinhaPesquisaAdmin(id, token);
      if (editingLinhaId === id) {
        setEditingLinhaId(null);
        setLinhaForm({ nome: "", descricao: "", vagasAmplaConcorrencia: "0", vagasAcoesAfirmativas: "0", vagasPcd: "0" });
      }
      await load();
      setMessage({ type: "success", text: "Linha removida." });
    }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  function handleEditLinha(id: string) {
    const linha = data?.linhasPesquisa.find((item) => item.id === id);
    if (!linha) return;

    setEditingLinhaId(id);
    setLinhaForm({
      nome: linha.nome,
      descricao: linha.descricao ?? "",
      vagasAmplaConcorrencia: String(linha.vagasAmplaConcorrencia),
      vagasAcoesAfirmativas: String(linha.vagasAcoesAfirmativas),
      vagasPcd: String(linha.vagasPcd),
    });
  }

  async function handleDeleteCronograma(id: string) {
    if (!token) return;
    setBusy(true); setMessage(null);
    try {
      await deleteCronogramaAdmin(id, token);
      if (editingCronogramaId === id) {
        setEditingCronogramaId(null);
        setCronogramaForm({ tipo: "INSCRICAO", titulo: "", descricao: "", inicioEm: "", fimEm: "" });
      }
      await load();
      setMessage({ type: "success", text: "Cronograma removido." });
    }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  function handleEditCronograma(id: string) {
    const cronograma = data?.cronogramas.find((item) => item.id === id);
    if (!cronograma) return;

    setEditingCronogramaId(id);
    setCronogramaForm({
      tipo: cronograma.tipo as TipoCronogramaEdital,
      titulo: cronograma.titulo,
      descricao: cronograma.descricao ?? "",
      inicioEm: cronograma.inicioEm.slice(0, 16),
      fimEm: cronograma.fimEm.slice(0, 16),
    });
  }

  async function handleDeleteEdital() {
    if (!token || !editalId) return;
    setBusy(true); setMessage(null);
    try { await deleteAdminEdital(editalId, token); setMessage({ type: "success", text: "Edital removido. Volte para a listagem administrativa." }); setData(null); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando edital admin" description="Consultando detalhe do edital para manutencao." />;
  if (status === "error") return <ErrorState title="Falha ao carregar edital" description={message?.text} />;
  if (!data) return <EmptyState title="Edital indisponivel" description="O edital nao esta mais disponivel para manutencao nesta rota." />;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Retorno operacional" description={message.text} /> : null}
      <SectionCard title={`Editar edital ${data.numero}`} description={data.titulo}>
        <form className="form-grid" onSubmit={submitEdital}>
          <label className="field-block"><span>Numero</span><input onChange={(e) => setEditalForm((c) => ({ ...c, numero: e.target.value }))} value={editalForm.numero} /></label>
          <label className="field-block"><span>Titulo</span><input onChange={(e) => setEditalForm((c) => ({ ...c, titulo: e.target.value }))} value={editalForm.titulo} /></label>
          <label className="field-block"><span>Descricao</span><textarea className="text-area" onChange={(e) => setEditalForm((c) => ({ ...c, descricao: e.target.value }))} value={editalForm.descricao} /></label>
          <label className="field-block"><span>Ano</span><input onChange={(e) => setEditalForm((c) => ({ ...c, ano: e.target.value }))} type="number" value={editalForm.ano} /></label>
          <label className="field-block"><span>Semestre</span><select className="select-field" onChange={(e) => setEditalForm((c) => ({ ...c, semestre: e.target.value }))} value={editalForm.semestre}><option value="1">1</option><option value="2">2</option></select></label>
          <label className="field-block"><span>Curso</span><select className="select-field" onChange={(e) => setEditalForm((c) => ({ ...c, cursoNivel: e.target.value as CursoNivel }))} value={editalForm.cursoNivel}>{cursoNivelOptions.map((option) => <option key={option} value={option}>{option === "MESTRADO" ? "Mestrado" : "Doutorado"}</option>)}</select></label>
          <label className="field-block"><span>Status</span><select className="select-field" onChange={(e) => setEditalForm((c) => ({ ...c, status: e.target.value as StatusEdital }))} value={editalForm.status}>{statusEditalOptions.map((option) => <option key={option} value={option}>{option.replace(/_/g, " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase())}</option>)}</select></label>
          <label className="field-block"><span>Publicado em (opcional)</span><input onChange={(e) => setEditalForm((c) => ({ ...c, publicadoEm: e.target.value }))} placeholder="2026-04-05T12:00:00.000Z" value={editalForm.publicadoEm} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Salvar edital</ActionButton>
          <ActionButton disabled={busy} onClick={handleDeleteEdital} type="button" variant="ghost">Excluir edital</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Linhas de pesquisa" description="Cadastro e leitura das linhas vinculadas ao edital.">
        <form className="form-grid" onSubmit={submitLinha}>
          <label className="field-block"><span>Nome</span><input onChange={(e) => setLinhaForm((c) => ({ ...c, nome: e.target.value }))} value={linhaForm.nome} /></label>
          <label className="field-block"><span>Descricao</span><textarea className="text-area" onChange={(e) => setLinhaForm((c) => ({ ...c, descricao: e.target.value }))} value={linhaForm.descricao} /></label>
          <label className="field-block"><span>Ampla concorrencia</span><input min="0" onChange={(e) => setLinhaForm((c) => ({ ...c, vagasAmplaConcorrencia: e.target.value }))} type="number" value={linhaForm.vagasAmplaConcorrencia} /></label>
          <label className="field-block"><span>Acoes afirmativas</span><input min="0" onChange={(e) => setLinhaForm((c) => ({ ...c, vagasAcoesAfirmativas: e.target.value }))} type="number" value={linhaForm.vagasAcoesAfirmativas} /></label>
          <label className="field-block"><span>PCD</span><input min="0" onChange={(e) => setLinhaForm((c) => ({ ...c, vagasPcd: e.target.value }))} type="number" value={linhaForm.vagasPcd} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">{editingLinhaId ? "Salvar linha" : "Adicionar linha"}</ActionButton>
          {editingLinhaId ? <ActionButton disabled={busy} onClick={() => { setEditingLinhaId(null); setLinhaForm({ nome: "", descricao: "", vagasAmplaConcorrencia: "0", vagasAcoesAfirmativas: "0", vagasPcd: "0" }); }} type="button" variant="ghost">Cancelar edicao</ActionButton> : null}
        </form>
        <div className="content-list">
          {data.linhasPesquisa.map((linha) => <article className="content-item" key={linha.id}><strong>{linha.nome}</strong><small>Total de vagas: {linha.totalVagas}</small><div className="content-item-links"><ActionButton disabled={busy} onClick={() => handleEditLinha(linha.id)} size="sm" type="button" variant="secondary">Editar</ActionButton><ActionButton disabled={busy} onClick={() => handleDeleteLinha(linha.id)} size="sm" type="button" variant="ghost">Excluir</ActionButton></div></article>)}
        </div>
      </SectionCard>

      <SectionCard title="Cronograma" description="Cadastro e leitura das fases operacionais do edital.">
        <form className="form-grid" onSubmit={submitCronograma}>
          <label className="field-block"><span>Tipo</span><select className="select-field" onChange={(e) => setCronogramaForm((c) => ({ ...c, tipo: e.target.value as TipoCronogramaEdital }))} value={cronogramaForm.tipo}>{tipoCronogramaEditalOptions.map((option) => <option key={option} value={option}>{option.replace(/_/g, " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase())}</option>)}</select></label>
          <label className="field-block"><span>Titulo</span><input onChange={(e) => setCronogramaForm((c) => ({ ...c, titulo: e.target.value }))} value={cronogramaForm.titulo} /></label>
          <label className="field-block"><span>Descricao</span><textarea className="text-area" onChange={(e) => setCronogramaForm((c) => ({ ...c, descricao: e.target.value }))} value={cronogramaForm.descricao} /></label>
          <label className="field-block"><span>Inicio</span><input onChange={(e) => setCronogramaForm((c) => ({ ...c, inicioEm: e.target.value }))} type="datetime-local" value={cronogramaForm.inicioEm} /></label>
          <label className="field-block"><span>Fim</span><input onChange={(e) => setCronogramaForm((c) => ({ ...c, fimEm: e.target.value }))} type="datetime-local" value={cronogramaForm.fimEm} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">{editingCronogramaId ? "Salvar fase" : "Adicionar fase"}</ActionButton>
          {editingCronogramaId ? <ActionButton disabled={busy} onClick={() => { setEditingCronogramaId(null); setCronogramaForm({ tipo: "INSCRICAO", titulo: "", descricao: "", inicioEm: "", fimEm: "" }); }} type="button" variant="ghost">Cancelar edicao</ActionButton> : null}
        </form>
        <div className="content-list">
          {data.cronogramas.map((cronograma) => <article className="content-item" key={cronograma.id}><strong>{cronograma.titulo}</strong><small>{cronograma.tipo}</small><small>{cronograma.inicioEm} {'->'} {cronograma.fimEm}</small><div className="content-item-links"><ActionButton disabled={busy} onClick={() => handleEditCronograma(cronograma.id)} size="sm" type="button" variant="secondary">Editar</ActionButton><ActionButton disabled={busy} onClick={() => handleDeleteCronograma(cronograma.id)} size="sm" type="button" variant="ghost">Excluir</ActionButton></div></article>)}
        </div>
      </SectionCard>
    </div>
  );
}
