"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { StructuredPreview } from "@/components/shared/structured-preview";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { getEspelhoEtapa2, getEtapa2Item, liberarEspelhoEtapa2, registrarEtapa2 } from "@/modules/admin-etapas/api";
import type { Etapa2AdminItem, Etapa2Espelho } from "@/modules/admin-etapas/types";

type Props = { params: Promise<{ inscricaoId: string }> };

type PontuacaoItemDraft = { id: string; chave: string; valor: string };
type GlosaDraft = { id: string; item: string; descricao: string; pontosGlosados: string };

const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const emptyPontuacaoItem = (): PontuacaoItemDraft => ({ id: uid(), chave: "", valor: "0" });
const emptyGlosa = (): GlosaDraft => ({ id: uid(), item: "", descricao: "", pontosGlosados: "0" });

export default function AdminEtapa2DetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<Etapa2AdminItem | null>(null);
  const [espelho, setEspelho] = useState<Etapa2Espelho | null>(null);
  const [pontuacaoItensDraft, setPontuacaoItensDraft] = useState<PontuacaoItemDraft[]>([emptyPontuacaoItem()]);
  const [pontuacaoBruta, setPontuacaoBruta] = useState(0);
  const [maiorPontuacaoBruta, setMaiorPontuacaoBruta] = useState(10);
  const [glosasDraft, setGlosasDraft] = useState<GlosaDraft[]>([]);
  const [espelhoCorrecao, setEspelhoCorrecao] = useState("");
  const [liberarEspelho, setLiberarEspelho] = useState(false);
  const [publicacao, setPublicacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { let cancelled = false; params.then((resolved) => { if (!cancelled) setInscricaoId(resolved.inscricaoId); }); return () => { cancelled = true; }; }, [params]);

  const loadItem = useCallback(async () => {
    if (!token || !inscricaoId) return;

    const found = await getEtapa2Item(inscricaoId, token);
    setItem(found);
    setPontuacaoItensDraft(
      Object.entries(found?.avaliacao?.pontuacaoItens ?? { titulo: 0 }).map(([chave, valor]) => ({ id: uid(), chave, valor: String(valor) })),
    );
    setPontuacaoBruta(found?.avaliacao?.pontuacaoBruta ?? 0);
    setMaiorPontuacaoBruta(Math.max(found?.avaliacao?.pontuacaoBruta ?? 10, 10));
    setEspelhoCorrecao(found?.avaliacao?.espelhoCorrecao ?? "");
    setGlosasDraft(
      (found?.avaliacao?.glosas ?? []).map((glosa) => ({
        id: uid(),
        item: String(glosa.item ?? ""),
        descricao: String(glosa.descricao ?? ""),
        pontosGlosados: String(glosa.pontosGlosados ?? 0),
      })),
    );
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
  }, [loadItem, inscricaoId, signOut, token]);

  async function loadEspelho() {
    if (!token || !inscricaoId) return;
    try {
      const response = await getEspelhoEtapa2(inscricaoId, token);
      setEspelho(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !inscricaoId) return;
    setBusy(true); setMessage(null);
    try {
      const pontuacaoItens = Object.fromEntries(
        pontuacaoItensDraft
          .filter((entry) => entry.chave.trim())
          .map((entry) => [entry.chave.trim(), Number(entry.valor) || 0]),
      );

      if (!Object.keys(pontuacaoItens).length) {
        setMessage({ type: "warning", text: "Informe ao menos um item de pontuacao antes do envio." });
        return;
      }

      const glosas = glosasDraft
        .filter((entry) => entry.item.trim() || entry.descricao.trim() || Number(entry.pontosGlosados) > 0)
        .map((entry) => ({
          item: entry.item.trim(),
          descricao: entry.descricao.trim(),
          pontosGlosados: Number(entry.pontosGlosados) || 0,
        }));

      if (maiorPontuacaoBruta <= 0) {
        setMessage({ type: "warning", text: "A maior pontuacao bruta deve ser maior que zero." });
        return;
      }

      if (pontuacaoBruta < 0) {
        setMessage({ type: "warning", text: "A pontuacao bruta nao pode ser negativa." });
        return;
      }

      await registrarEtapa2(inscricaoId, {
        pontuacaoItens,
        pontuacaoBruta,
        maiorPontuacaoBruta,
        glosas,
        espelhoCorrecao,
        liberarEspelho,
        publicacao,
      }, token);
      await loadItem();
      setMessage({ type: "success", text: "Resultado da etapa 2 enviado ao backend e estado recarregado." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function onLiberarEspelho() {
    if (!token || !inscricaoId) return;
    setBusy(true); setMessage(null);
    try {
      await liberarEspelhoEtapa2(inscricaoId, token);
      await loadItem();
      setMessage({ type: "success", text: "Espelho da etapa 2 liberado e estado recarregado." });
      await loadEspelho();
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando detalhe da etapa 2" description="Consultando a inscricao selecionada." />;
  if (status === "error") return <ErrorState title="Falha ao carregar etapa 2" description={message?.text} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="A inscricao nao foi encontrada na fila atual da etapa 2." />;

  function updatePontuacaoItem(index: number, field: keyof PontuacaoItemDraft, value: string) {
    setPontuacaoItensDraft((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, [field]: value } : entry));
  }

  function updateGlosa(index: number, field: keyof GlosaDraft, value: string) {
    setGlosasDraft((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, [field]: value } : entry));
  }

  return (
    <div className="stack-layout">
      {message ? <PageFeedback description={message.text} title="Retorno operacional" type={message.type} /> : null}

      <SectionCard title={`Etapa 2 de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
        <div className="content-list">
          <small>E-mail: {item.candidato.email}</small>
          <div className="content-item-row"><small>Status da inscricao: {getStatusLabel(item.status)}</small><StatusBadge variant={getStatusVariant(item.avaliacao?.status ?? item.status)}>{getStatusLabel(item.avaliacao?.status ?? item.status)}</StatusBadge></div>
          <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
          <small>Pontuacao atual: {item.avaliacao?.pontuacaoBruta ?? "sem avaliacao"}</small>
          <small>Nota atual: {item.avaliacao?.notaNormalizada ?? "sem avaliacao"}</small>
        </div>
      </SectionCard>
      <SectionCard title="Registro do resultado" description="Formulario operacional da etapa 2 baseado no payload do backend.">
        <form className="form-grid" onSubmit={onSubmit}>
          <div className="field-block">
            <span>Pontuacao por item</span>
            <div className="content-list">
              {pontuacaoItensDraft.map((entry, index) => (
                <div className="content-item-row" key={entry.id}>
                  <input onChange={(e) => updatePontuacaoItem(index, "chave", e.target.value)} placeholder="criterio" value={entry.chave} />
                  <input min="0" onChange={(e) => updatePontuacaoItem(index, "valor", e.target.value)} placeholder="0" step="0.1" type="number" value={entry.valor} />
                  <ActionButton disabled={busy || pontuacaoItensDraft.length <= 1} onClick={() => setPontuacaoItensDraft((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button" variant="ghost">Remover</ActionButton>
                </div>
              ))}
              <ActionButton disabled={busy} onClick={() => setPontuacaoItensDraft((current) => [...current, emptyPontuacaoItem()])} type="button" variant="secondary">Adicionar item</ActionButton>
            </div>
          </div>
          <label className="field-block"><span>Pontuacao bruta</span><input min="0" onChange={(e) => setPontuacaoBruta(Number(e.target.value) || 0)} type="number" value={pontuacaoBruta} /></label>
          <label className="field-block"><span>Maior pontuacao bruta</span><input min="0.1" onChange={(e) => setMaiorPontuacaoBruta(Number(e.target.value) || 0)} step="0.1" type="number" value={maiorPontuacaoBruta} /></label>
          <div className="field-block">
            <span>Glosas</span>
            <div className="content-list">
              {glosasDraft.map((entry, index) => (
                <div className="content-item" key={entry.id}>
                  <input onChange={(e) => updateGlosa(index, "item", e.target.value)} placeholder="item" value={entry.item} />
                  <textarea className="text-area" onChange={(e) => updateGlosa(index, "descricao", e.target.value)} placeholder="descricao da glosa" value={entry.descricao} />
                  <input min="0" onChange={(e) => updateGlosa(index, "pontosGlosados", e.target.value)} placeholder="0" step="0.1" type="number" value={entry.pontosGlosados} />
                  <ActionButton disabled={busy} onClick={() => setGlosasDraft((current) => current.filter((_, currentIndex) => currentIndex !== index))} type="button" variant="ghost">Remover glosa</ActionButton>
                </div>
              ))}
              <ActionButton disabled={busy} onClick={() => setGlosasDraft((current) => [...current, emptyGlosa()])} type="button" variant="secondary">Adicionar glosa</ActionButton>
            </div>
          </div>
          <label className="field-block"><span>Espelho de correcao</span><textarea className="text-area" onChange={(e) => setEspelhoCorrecao(e.target.value)} value={espelhoCorrecao} /></label>
          <label className="field-block"><span>Publicacao</span><select className="select-field" onChange={(e) => setPublicacao(e.target.value as "PRELIMINAR" | "FINAL")} value={publicacao}><option value="PRELIMINAR">PRELIMINAR</option><option value="FINAL">FINAL</option></select></label>
          <label className="field-inline"><input checked={liberarEspelho} onChange={(e) => setLiberarEspelho(e.target.checked)} type="checkbox" /><span>Liberar espelho junto do resultado</span></label>
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
