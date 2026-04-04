"use client";

import { FormEvent, useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { getEspelhoEtapa2, liberarEspelhoEtapa2, listEtapa2, registrarEtapa2 } from "@/modules/admin-etapas/api";
import type { Etapa2AdminItem, Etapa2Espelho } from "@/modules/admin-etapas/types";

type Props = { params: Promise<{ inscricaoId: string }> };

export default function AdminEtapa2DetailPage({ params }: Props) {
  const session = useSession();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<Etapa2AdminItem | null>(null);
  const [espelho, setEspelho] = useState<Etapa2Espelho | null>(null);
  const [pontuacaoItensRaw, setPontuacaoItensRaw] = useState('{"titulo": 0}');
  const [pontuacaoBruta, setPontuacaoBruta] = useState(0);
  const [maiorPontuacaoBruta, setMaiorPontuacaoBruta] = useState(10);
  const [glosasRaw, setGlosasRaw] = useState("[]");
  const [espelhoCorrecao, setEspelhoCorrecao] = useState("");
  const [liberarEspelho, setLiberarEspelho] = useState(false);
  const [publicacao, setPublicacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { params.then((resolved) => setInscricaoId(resolved.inscricaoId)); }, [params]);

  useEffect(() => {
    if (!session.token || !inscricaoId) return;
    listEtapa2(session.token)
      .then((response) => {
        const found = response.items.find((entry) => entry.id === inscricaoId) ?? null;
        setItem(found);
        setPontuacaoItensRaw(JSON.stringify(found?.avaliacao?.pontuacaoItens ?? { titulo: 0 }, null, 2));
        setPontuacaoBruta(found?.avaliacao?.pontuacaoBruta ?? 0);
        setEspelhoCorrecao(found?.avaliacao?.espelhoCorrecao ?? "");
        setGlosasRaw(JSON.stringify(found?.avaliacao?.glosas ?? [], null, 2));
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

  async function loadEspelho() {
    if (!session.token || !inscricaoId) return;
    try {
      const response = await getEspelhoEtapa2(inscricaoId, session.token);
      setEspelho(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session.token || !inscricaoId) return;
    setBusy(true); setMessage(null);
    try {
      await registrarEtapa2(inscricaoId, {
        pontuacaoItens: JSON.parse(pontuacaoItensRaw),
        pontuacaoBruta,
        maiorPontuacaoBruta,
        glosas: JSON.parse(glosasRaw),
        espelhoCorrecao,
        liberarEspelho,
        publicacao,
      }, session.token);
      setMessage("Resultado da etapa 2 enviado ao backend.");
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function onLiberarEspelho() {
    if (!session.token || !inscricaoId) return;
    setBusy(true); setMessage(null);
    try {
      await liberarEspelhoEtapa2(inscricaoId, session.token);
      setMessage("Espelho da etapa 2 liberado.");
      await loadEspelho();
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando detalhe da etapa 2" description="Consultando a inscricao selecionada." />;
  if (status === "error") return <ErrorState title="Falha ao carregar etapa 2" description={message ?? undefined} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="A inscricao nao foi encontrada na fila atual da etapa 2." />;

  return (
    <div className="stack-layout">
      <SectionCard title={`Etapa 2 de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
        <div className="content-list">
          <small>E-mail: {item.candidato.email}</small>
          <small>Status: {item.status}</small>
          <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
          <small>Pontuacao atual: {item.avaliacao?.pontuacaoBruta ?? "sem avaliacao"}</small>
          <small>Nota atual: {item.avaliacao?.notaNormalizada ?? "sem avaliacao"}</small>
        </div>
      </SectionCard>
      <SectionCard title="Registro do resultado" description="Formulario operacional da etapa 2 baseado no payload do backend.">
        <form className="form-grid" onSubmit={onSubmit}>
          <label className="field-block"><span>Pontuacao por item (JSON)</span><textarea className="text-area" onChange={(e) => setPontuacaoItensRaw(e.target.value)} value={pontuacaoItensRaw} /></label>
          <label className="field-block"><span>Pontuacao bruta</span><input onChange={(e) => setPontuacaoBruta(Number(e.target.value) || 0)} type="number" value={pontuacaoBruta} /></label>
          <label className="field-block"><span>Maior pontuacao bruta</span><input onChange={(e) => setMaiorPontuacaoBruta(Number(e.target.value) || 0)} type="number" value={maiorPontuacaoBruta} /></label>
          <label className="field-block"><span>Glosas (JSON)</span><textarea className="text-area" onChange={(e) => setGlosasRaw(e.target.value)} value={glosasRaw} /></label>
          <label className="field-block"><span>Espelho de correcao</span><textarea className="text-area" onChange={(e) => setEspelhoCorrecao(e.target.value)} value={espelhoCorrecao} /></label>
          <label className="field-block"><span>Publicacao</span><select className="select-field" onChange={(e) => setPublicacao(e.target.value as "PRELIMINAR" | "FINAL")} value={publicacao}><option value="PRELIMINAR">PRELIMINAR</option><option value="FINAL">FINAL</option></select></label>
          <label className="field-inline"><input checked={liberarEspelho} onChange={(e) => setLiberarEspelho(e.target.checked)} type="checkbox" /><span>Liberar espelho junto do resultado</span></label>
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
