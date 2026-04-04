"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { getEspelhoEtapa1, liberarEspelhoEtapa1, listEtapa1, registrarEtapa1 } from "@/modules/admin-etapas/api";
import type { Etapa1AdminItem, Etapa1Espelho } from "@/modules/admin-etapas/types";

type Props = { params: Promise<{ inscricaoId: string }> };

export default function AdminEtapa1DetailPage({ params }: Props) {
  const session = useSession();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<Etapa1AdminItem | null>(null);
  const [espelho, setEspelho] = useState<Etapa1Espelho | null>(null);
  const [tema, setTema] = useState("");
  const [espelhoCorrecao, setEspelhoCorrecao] = useState("");
  const [fundamentoUsoIa, setFundamentoUsoIa] = useState("");
  const [publicacao, setPublicacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [usoIaComprovado, setUsoIaComprovado] = useState(false);
  const [liberarEspelho, setLiberarEspelho] = useState(false);
  const [rubrica, setRubrica] = useState({ adequacaoDominioTema: 0, estrutura: 0, organizacaoCoerencia: 0, objetividadeSintese: 0, grafiaGramatica: 0, observacoes: { geral: "" } });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    params.then((resolved) => setInscricaoId(resolved.inscricaoId));
  }, [params]);

  useEffect(() => {
    if (!session.token || !inscricaoId) return;

    listEtapa1(session.token)
      .then((response) => {
        const found = response.items.find((entry) => entry.id === inscricaoId) ?? null;
        setItem(found);
        setTema(found?.avaliacao?.tema ?? "");
        setEspelhoCorrecao(found?.avaliacao?.espelhoCorrecao ?? "");
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          session.signOut();
          return;
        }
        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [inscricaoId, session]);

  const notaPreview = useMemo(() => rubrica.adequacaoDominioTema * 0.5 + rubrica.estrutura * 0.1 + rubrica.organizacaoCoerencia * 0.15 + rubrica.objetividadeSintese * 0.15 + rubrica.grafiaGramatica * 0.1, [rubrica]);

  async function loadEspelho() {
    if (!session.token || !inscricaoId) return;
    try {
      const response = await getEspelhoEtapa1(inscricaoId, session.token);
      setEspelho(response);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        session.signOut();
        return;
      }
      setMessage(getErrorMessage(error));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.token || !inscricaoId) return;
    setBusy(true);
    setMessage(null);
    try {
      await registrarEtapa1(inscricaoId, { tema: tema || undefined, rubrica, usoIaComprovado, fundamentoUsoIa: usoIaComprovado ? fundamentoUsoIa : undefined, espelhoCorrecao, liberarEspelho, publicacao }, session.token);
      setMessage("Resultado da etapa 1 enviado ao backend.");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        session.signOut();
        return;
      }
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function onLiberarEspelho() {
    if (!session.token || !inscricaoId) return;
    setBusy(true);
    setMessage(null);
    try {
      await liberarEspelhoEtapa1(inscricaoId, session.token);
      setMessage("Espelho da etapa 1 liberado.");
      await loadEspelho();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        session.signOut();
        return;
      }
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") return <LoadingState title="Carregando detalhe da etapa 1" description="Consultando a inscricao selecionada." />;
  if (status === "error") return <ErrorState title="Falha ao carregar etapa 1" description={message ?? undefined} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="A inscricao nao foi encontrada na fila atual da etapa 1." />;

  return (
    <div className="stack-layout">
      <SectionCard title={`Etapa 1 de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
        <div className="content-list">
          <small>E-mail: {item.candidato.email}</small>
          <small>Status da inscricao: {item.status}</small>
          <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
          <small>Nota registrada: {item.avaliacao?.nota ?? "sem nota"}</small>
          <small>Status da avaliacao: {item.avaliacao?.status ?? "sem avaliacao"}</small>
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
          <label className="field-block"><span>Observacao geral</span><textarea className="text-area" onChange={(e) => setRubrica((c) => ({ ...c, observacoes: { geral: e.target.value } }))} value={rubrica.observacoes.geral} /></label>
          <label className="field-inline"><input checked={usoIaComprovado} onChange={(e) => setUsoIaComprovado(e.target.checked)} type="checkbox" /><span>Uso de IA comprovado</span></label>
          {usoIaComprovado ? <label className="field-block"><span>Fundamento do uso de IA</span><textarea className="text-area" onChange={(e) => setFundamentoUsoIa(e.target.value)} value={fundamentoUsoIa} /></label> : null}
          <label className="field-block"><span>Espelho de correcao</span><textarea className="text-area" onChange={(e) => setEspelhoCorrecao(e.target.value)} value={espelhoCorrecao} /></label>
          <label className="field-block"><span>Publicacao</span><select className="select-field" onChange={(e) => setPublicacao(e.target.value as "PRELIMINAR" | "FINAL")} value={publicacao}><option value="PRELIMINAR">PRELIMINAR</option><option value="FINAL">FINAL</option></select></label>
          <label className="field-inline"><input checked={liberarEspelho} onChange={(e) => setLiberarEspelho(e.target.checked)} type="checkbox" /><span>Liberar espelho junto do resultado</span></label>
          <small>Nota calculada pela rubrica: {notaPreview.toFixed(2)}</small>
          <button className="action-button" disabled={busy} type="submit">Registrar resultado</button>
          <button className="secondary-button" disabled={busy} onClick={onLiberarEspelho} type="button">Liberar espelho</button>
        </form>
      </SectionCard>

      <SectionCard title="Espelho administrativo" description="Leitura do espelho retornado pelo backend no contexto admin.">
        <div className="content-item-links"><button className="secondary-button" disabled={busy} onClick={loadEspelho} type="button">Carregar espelho</button></div>
        {espelho ? <pre className="preformatted-block">{JSON.stringify(espelho, null, 2)}</pre> : <EmptyState title="Espelho nao carregado" description="Use a acao acima para consultar o espelho administrativo." />}
      </SectionCard>

      {message ? <ErrorState title="Retorno operacional" description={message} /> : null}
    </div>
  );
}
