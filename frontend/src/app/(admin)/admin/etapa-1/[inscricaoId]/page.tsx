"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StructuredPreview } from "@/components/shared/structured-preview";
import { getStatusLabel } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { getEspelhoEtapa1, getEtapa1Item, liberarEspelhoEtapa1, registrarEtapa1 } from "@/modules/admin-etapas/api";
import type { Etapa1AdminItem, Etapa1Espelho } from "@/modules/admin-etapas/types";

type Props = { params: Promise<{ inscricaoId: string }> };

function normalizeRubricaObservacoes(observacoes: {
  adequacaoDominioTema: string;
  estrutura: string;
  organizacaoCoerencia: string;
  objetividadeSintese: string;
  grafiaGramatica: string;
  geral: string;
}) {
  return Object.fromEntries(
    Object.entries(observacoes).filter(([, value]) => value.trim().length >= 3),
  );
}

export default function AdminEtapa1DetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<Etapa1AdminItem | null>(null);
  const [espelho, setEspelho] = useState<Etapa1Espelho | null>(null);
  const [tema, setTema] = useState("");
  const [espelhoCorrecao, setEspelhoCorrecao] = useState("");
  const [fundamentoUsoIa, setFundamentoUsoIa] = useState("");
  const [publicacao, setPublicacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [usoIaComprovado, setUsoIaComprovado] = useState(false);
  const [liberarEspelho, setLiberarEspelho] = useState(false);
  const [rubrica, setRubrica] = useState({ adequacaoDominioTema: 0, estrutura: 0, organizacaoCoerencia: 0, objetividadeSintese: 0, grafiaGramatica: 0, observacoes: { adequacaoDominioTema: "", estrutura: "", organizacaoCoerencia: "", objetividadeSintese: "", grafiaGramatica: "", geral: "" } });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    params.then((resolved) => setInscricaoId(resolved.inscricaoId));
  }, [params]);

  const loadItem = useCallback(async () => {
    if (!token || !inscricaoId) return;

    const found = await getEtapa1Item(inscricaoId, token);
    setItem(found);
    setTema(found?.avaliacao?.tema ?? "");
    setEspelhoCorrecao(found?.avaliacao?.espelhoCorrecao ?? "");
  }, [inscricaoId, token]);

  useEffect(() => {
    if (!token || !inscricaoId) return;

    loadItem()
      .then(() => setStatus("ready"))
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          signOut();
          return;
        }
        setMessage({ type: "error", text: getErrorMessage(error) });
        setStatus("error");
      });
  }, [inscricaoId, loadItem, signOut, token]);

  const notaPreview = useMemo(() => rubrica.adequacaoDominioTema * 0.5 + rubrica.estrutura * 0.1 + rubrica.organizacaoCoerencia * 0.15 + rubrica.objetividadeSintese * 0.15 + rubrica.grafiaGramatica * 0.1, [rubrica]);

  async function loadEspelho() {
    if (!token || !inscricaoId) return;
    try {
      const response = await getEspelhoEtapa1(inscricaoId, token);
      setEspelho(response);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setMessage({ type: "error", text: getErrorMessage(error) });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !inscricaoId) return;
    setBusy(true);
    setMessage(null);
    try {
      if (notaPreview < 0 || notaPreview > 10) {
        setMessage({ type: "warning", text: "A nota calculada da rubrica deve permanecer entre 0 e 10." });
        return;
      }

      await registrarEtapa1(inscricaoId, {
        tema: tema || undefined,
        rubrica: {
          ...rubrica,
          observacoes: normalizeRubricaObservacoes(rubrica.observacoes),
        },
        usoIaComprovado,
        fundamentoUsoIa: usoIaComprovado ? fundamentoUsoIa : undefined,
        espelhoCorrecao,
        liberarEspelho,
        publicacao,
      }, token);
      await loadItem();
      setMessage({ type: "success", text: "Resultado da etapa 1 enviado ao backend e estado recarregado." });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function onLiberarEspelho() {
    if (!token || !inscricaoId) return;
    setBusy(true);
    setMessage(null);
    try {
      await liberarEspelhoEtapa1(inscricaoId, token);
      await loadItem();
      setMessage({ type: "success", text: "Espelho da etapa 1 liberado e estado recarregado." });
      await loadEspelho();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <LoadingState title="Carregando detalhe da etapa 1" description="Consultando a inscricao selecionada." />;
  if (status === "error") return <ErrorState title="Falha ao carregar etapa 1" description={message?.text} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="A inscricao nao foi encontrada na fila atual da etapa 1." />;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback description={message.text} title="Retorno operacional" type={message.type} /> : null}

      <SectionCard title={`Etapa 1 de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
        <div className="content-list">
          <small>E-mail: {item.candidato.email}</small>
          <small>Status da inscricao: {getStatusLabel(item.status)}</small>
          <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
          <small>Nota registrada: {item.avaliacao?.nota ?? "sem nota"}</small>
          <small>Status da avaliacao: {getStatusLabel(item.avaliacao?.status ?? "SEM_AVALIACAO")}</small>
        </div>
      </SectionCard>

      <SectionCard title="Registro do resultado" description="Formulario operacional da etapa 1 baseado no payload do backend.">
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field-block"><span>Tema</span><input onChange={(e) => setTema(e.target.value)} value={tema} /></label>
          <label className="field-block"><span>Adequacao ao tema</span><input onChange={(e) => setRubrica((c) => ({ ...c, adequacaoDominioTema: Number(e.target.value) || 0 }))} type="number" value={rubrica.adequacaoDominioTema} /></label>
          <label className="field-block"><span>Estrutura</span><input onChange={(e) => setRubrica((c) => ({ ...c, estrutura: Number(e.target.value) || 0 }))} type="number" value={rubrica.estrutura} /></label>
          <label className="field-block"><span>Organizacao e coerencia</span><input onChange={(e) => setRubrica((c) => ({ ...c, organizacaoCoerencia: Number(e.target.value) || 0 }))} type="number" value={rubrica.organizacaoCoerencia} /></label>
          <label className="field-block"><span>Objetividade e sintese</span><input onChange={(e) => setRubrica((c) => ({ ...c, objetividadeSintese: Number(e.target.value) || 0 }))} type="number" value={rubrica.objetividadeSintese} /></label>
          <label className="field-block"><span>Grafia e gramatica</span><input onChange={(e) => setRubrica((c) => ({ ...c, grafiaGramatica: Number(e.target.value) || 0 }))} type="number" value={rubrica.grafiaGramatica} /></label>
          <label className="field-block"><span>Observacao - adequacao ao tema</span><textarea className="text-area" onChange={(e) => setRubrica((c) => ({ ...c, observacoes: { ...c.observacoes, adequacaoDominioTema: e.target.value } }))} value={rubrica.observacoes.adequacaoDominioTema} /></label>
          <label className="field-block"><span>Observacao - estrutura</span><textarea className="text-area" onChange={(e) => setRubrica((c) => ({ ...c, observacoes: { ...c.observacoes, estrutura: e.target.value } }))} value={rubrica.observacoes.estrutura} /></label>
          <label className="field-block"><span>Observacao - organizacao e coerencia</span><textarea className="text-area" onChange={(e) => setRubrica((c) => ({ ...c, observacoes: { ...c.observacoes, organizacaoCoerencia: e.target.value } }))} value={rubrica.observacoes.organizacaoCoerencia} /></label>
          <label className="field-block"><span>Observacao - objetividade e sintese</span><textarea className="text-area" onChange={(e) => setRubrica((c) => ({ ...c, observacoes: { ...c.observacoes, objetividadeSintese: e.target.value } }))} value={rubrica.observacoes.objetividadeSintese} /></label>
          <label className="field-block"><span>Observacao - grafia e gramatica</span><textarea className="text-area" onChange={(e) => setRubrica((c) => ({ ...c, observacoes: { ...c.observacoes, grafiaGramatica: e.target.value } }))} value={rubrica.observacoes.grafiaGramatica} /></label>
          <label className="field-block"><span>Observacao geral</span><textarea className="text-area" onChange={(e) => setRubrica((c) => ({ ...c, observacoes: { ...c.observacoes, geral: e.target.value } }))} value={rubrica.observacoes.geral} /></label>
          <label className="field-inline"><input checked={usoIaComprovado} onChange={(e) => setUsoIaComprovado(e.target.checked)} type="checkbox" /><span>Uso de IA comprovado</span></label>
          {usoIaComprovado ? <label className="field-block"><span>Fundamento do uso de IA</span><textarea className="text-area" onChange={(e) => setFundamentoUsoIa(e.target.value)} value={fundamentoUsoIa} /></label> : null}
          <label className="field-block"><span>Espelho de correcao</span><textarea className="text-area" onChange={(e) => setEspelhoCorrecao(e.target.value)} value={espelhoCorrecao} /></label>
          <label className="field-block"><span>Publicacao</span><select className="select-field" onChange={(e) => setPublicacao(e.target.value as "PRELIMINAR" | "FINAL")} value={publicacao}><option value="PRELIMINAR">PRELIMINAR</option><option value="FINAL">FINAL</option></select></label>
          <label className="field-inline"><input checked={liberarEspelho} onChange={(e) => setLiberarEspelho(e.target.checked)} type="checkbox" /><span>Liberar espelho junto do resultado</span></label>
          <small>Nota calculada pela rubrica: {notaPreview.toFixed(2)}</small>
          <ActionButton disabled={busy} loading={busy} type="submit">Registrar resultado</ActionButton>
          <ActionButton disabled={busy} onClick={onLiberarEspelho} type="button" variant="secondary">Liberar espelho</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Espelho administrativo" description="Leitura do espelho retornado pelo backend no contexto admin.">
        <div className="content-item-links"><ActionButton disabled={busy} onClick={loadEspelho} type="button" variant="secondary">Carregar espelho</ActionButton></div>
        {espelho ? <StructuredPreview data={espelho} /> : <EmptyState title="Espelho nao carregado" description="Use a acao acima para consultar o espelho administrativo." />}
      </SectionCard>
    </div>
  );
}
