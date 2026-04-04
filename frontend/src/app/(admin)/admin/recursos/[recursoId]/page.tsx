"use client";

import { FormEvent, useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { decidirRecursoAdmin, listRecursosAdmin } from "@/modules/admin-recursos/api";
import type { AdminRecursoItem } from "@/modules/admin-recursos/types";
import { resultadoPoliticasOptions } from "@/modules/admin-operacao/constants";

type Props = { params: Promise<{ recursoId: string }> };

export default function AdminRecursoDetailPage({ params }: Props) {
  const session = useSession();
  const [recursoId, setRecursoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminRecursoItem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deferido, setDeferido] = useState(false);
  const [decisao, setDecisao] = useState("");
  const [impactoResultado, setImpactoResultado] = useState(false);
  const [novoStatusIsencao, setNovoStatusIsencao] = useState("");
  const [novoStatusInscricao, setNovoStatusInscricao] = useState("");
  const [novaNotaEtapa1, setNovaNotaEtapa1] = useState("");
  const [novoEspelhoEtapa1, setNovoEspelhoEtapa1] = useState("");
  const [novaPontuacaoBrutaEtapa2, setNovaPontuacaoBrutaEtapa2] = useState("");
  const [novaNotaNormalizadaEtapa2, setNovaNotaNormalizadaEtapa2] = useState("");
  const [novoEspelhoEtapa2, setNovoEspelhoEtapa2] = useState("");
  const [novoResultadoPoliticas, setNovoResultadoPoliticas] = useState<(typeof resultadoPoliticasOptions)[number]>(resultadoPoliticasOptions[0]);
  const [novoParecerPoliticas, setNovoParecerPoliticas] = useState("");

  useEffect(() => { params.then((resolved) => setRecursoId(resolved.recursoId)); }, [params]);

  useEffect(() => {
    if (!session.token || !recursoId) return;
    listRecursosAdmin(session.token)
      .then((response) => { setItem(response.items.find((entry) => entry.id === recursoId) ?? null); setStatus("ready"); })
      .catch((error) => {
        if (isUnauthorizedError(error)) { session.signOut(); return; }
        setMessage(getErrorMessage(error)); setStatus("error");
      });
  }, [recursoId, session]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.token || !recursoId) return;
    setBusy(true); setMessage(null);
    try {
      await decidirRecursoAdmin(recursoId, {
        deferido,
        decisao,
        impactoResultado,
        novoStatusIsencao: novoStatusIsencao || undefined,
        novoStatusInscricao: novoStatusInscricao || undefined,
        novaNotaEtapa1: novaNotaEtapa1 ? Number(novaNotaEtapa1) : undefined,
        novoEspelhoEtapa1: novoEspelhoEtapa1 || undefined,
        novaPontuacaoBrutaEtapa2: novaPontuacaoBrutaEtapa2 ? Number(novaPontuacaoBrutaEtapa2) : undefined,
        novaNotaNormalizadaEtapa2: novaNotaNormalizadaEtapa2 ? Number(novaNotaNormalizadaEtapa2) : undefined,
        novoEspelhoEtapa2: novoEspelhoEtapa2 || undefined,
        novoResultadoFinalPoliticasAfirmativas: novoResultadoPoliticas || undefined,
        novoParecerFinalPoliticasAfirmativas: novoParecerPoliticas || undefined,
      }, session.token);
      setMessage("Decisao do recurso enviada ao backend.");
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando recurso" description="Consultando o recurso selecionado." />;
  if (status === "error") return <ErrorState title="Falha ao carregar recurso" description={message ?? undefined} />;
  if (!item) return <EmptyState title="Recurso nao encontrado" description="O recurso nao foi encontrado na fila administrativa atual." />;

  return (
    <div className="stack-layout">
      <SectionCard title={`Recurso de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · fase ${item.fase}`}>
        <div className="content-list">
          <small>Status: {item.status}</small>
          <small>Impacto em resultado: {item.impactoResultado ? "sim" : "nao"}</small>
          <small>Fundamentacao: {item.fundamentacao}</small>
          <small>Anexo: {item.anexoUrl ?? "nao informado"}</small>
        </div>
      </SectionCard>
      <SectionCard title="Decisao do recurso" description="Formulario administrativo generico cobrindo os campos opcionais de impacto retornados pelo backend.">
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field-inline"><input checked={deferido} onChange={(e) => setDeferido(e.target.checked)} type="checkbox" /><span>Deferido</span></label>
          <label className="field-inline"><input checked={impactoResultado} onChange={(e) => setImpactoResultado(e.target.checked)} type="checkbox" /><span>Impacta o resultado</span></label>
          <label className="field-block"><span>Decisao</span><textarea className="text-area" onChange={(e) => setDecisao(e.target.value)} value={decisao} /></label>
          <label className="field-block"><span>Novo status da isencao</span><input onChange={(e) => setNovoStatusIsencao(e.target.value)} value={novoStatusIsencao} /></label>
          <label className="field-block"><span>Novo status da inscricao</span><input onChange={(e) => setNovoStatusInscricao(e.target.value)} value={novoStatusInscricao} /></label>
          <label className="field-block"><span>Nova nota etapa 1</span><input onChange={(e) => setNovaNotaEtapa1(e.target.value)} type="number" value={novaNotaEtapa1} /></label>
          <label className="field-block"><span>Novo espelho etapa 1</span><textarea className="text-area" onChange={(e) => setNovoEspelhoEtapa1(e.target.value)} value={novoEspelhoEtapa1} /></label>
          <label className="field-block"><span>Nova pontuacao bruta etapa 2</span><input onChange={(e) => setNovaPontuacaoBrutaEtapa2(e.target.value)} type="number" value={novaPontuacaoBrutaEtapa2} /></label>
          <label className="field-block"><span>Nova nota normalizada etapa 2</span><input onChange={(e) => setNovaNotaNormalizadaEtapa2(e.target.value)} type="number" value={novaNotaNormalizadaEtapa2} /></label>
          <label className="field-block"><span>Novo espelho etapa 2</span><textarea className="text-area" onChange={(e) => setNovoEspelhoEtapa2(e.target.value)} value={novoEspelhoEtapa2} /></label>
          <label className="field-block"><span>Novo resultado final de politicas afirmativas</span><select className="select-field" onChange={(e) => setNovoResultadoPoliticas(e.target.value as (typeof resultadoPoliticasOptions)[number])} value={novoResultadoPoliticas}>{resultadoPoliticasOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="field-block"><span>Novo parecer final de politicas afirmativas</span><textarea className="text-area" onChange={(e) => setNovoParecerPoliticas(e.target.value)} value={novoParecerPoliticas} /></label>
          <button className="action-button" disabled={busy} type="submit">Registrar decisao</button>
        </form>
      </SectionCard>
      {message ? <ErrorState title="Retorno operacional" description={message} /> : null}
    </div>
  );
}
