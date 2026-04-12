"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, getFirstFormError, pickFirstFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { getEspelhoEtapa2, getEtapa2Item, liberarEspelhoEtapa2, registrarEtapa2 } from "@/modules/admin-etapas/api";
import type { Etapa2AdminItem, Etapa2Espelho } from "@/modules/admin-etapas/types";

type Props = { params: Promise<{ inscricaoId: string }> };

type ItemDraft = { id: string; chave: string; valor: string };
type GlosaDraft = { id: string; item: string; descricao: string; pontosGlosados: string };

const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function AdminEtapa2DetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<Etapa2AdminItem | null>(null);
  const [espelho, setEspelho] = useState<Etapa2Espelho | null>(null);

  const [itensDraft, setItensDraft] = useState<ItemDraft[]>([{ id: uid(), chave: "", valor: "0" }]);
  const [glosasDraft, setGlosasDraft] = useState<GlosaDraft[]>([]);
  const [pontuacaoBruta, setPontuacaoBruta] = useState(0);
  const [maiorPontuacaoBruta, setMaiorPontuacaoBruta] = useState(10);
  const [espelhoCorrecao, setEspelhoCorrecao] = useState("");
  const [liberarEspelhoFlag, setLiberarEspelhoFlag] = useState(false);
  const [publicacao, setPublicacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [helperHint, setHelperHint] = useState<"liquido" | "referencia" | null>(null);

  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    params.then((r) => { if (!cancelled) setInscricaoId(r.inscricaoId); });
    return () => { cancelled = true; };
  }, [params]);

  const loadItem = useCallback(async () => {
    if (!token || !inscricaoId) return;
    const found = await getEtapa2Item(inscricaoId, token);
    setItem(found);
    setItensDraft(
      Object.entries(found?.avaliacao?.pontuacaoItens ?? { titulo: 0 }).map(([chave, valor]) => ({ id: uid(), chave, valor: String(valor) })),
    );
    setPontuacaoBruta(found?.avaliacao?.pontuacaoBruta ?? 0);
    setMaiorPontuacaoBruta(Math.max(found?.avaliacao?.pontuacaoBruta ?? 10, 10));
    setEspelhoCorrecao(found?.avaliacao?.espelhoCorrecao ?? "");
    setPublicacao(found?.avaliacao?.status === "FINAL_PUBLICADA" ? "FINAL" : "PRELIMINAR");
    setLiberarEspelhoFlag(Boolean(found?.avaliacao?.espelhoLiberadoEm));
    setGlosasDraft(
      (found?.avaliacao?.glosas ?? []).map((g) => ({
        id: uid(),
        item: String((g as Record<string, unknown>).item ?? ""),
        descricao: String((g as Record<string, unknown>).descricao ?? ""),
        pontosGlosados: String((g as Record<string, unknown>).pontosGlosados ?? 0),
      })),
    );
  }, [inscricaoId, token]);

  useAbortableEffect(async (signal) => {
    if (!token || !inscricaoId) return;
    try {
      await loadItem();
      if (signal.aborted) return;
      setPageStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
      setPageStatus("error");
    }
  }, [loadItem, inscricaoId, signOut, token]);

  // Computed totals
  const totalBruto = itensDraft.reduce((sum, entry) => sum + (Number(entry.valor) || 0), 0);
  const totalGlosa = glosasDraft.reduce((sum, entry) => sum + (Number(entry.pontosGlosados) || 0), 0);
  const totalLiquido = totalBruto - totalGlosa;
  const notaNormalizada = maiorPontuacaoBruta > 0 ? (pontuacaoBruta / maiorPontuacaoBruta) * 10 : 0;
  const pontuacaoDivergente = Math.abs(pontuacaoBruta - totalLiquido) > 0.001;
  const referenciaMenorQueBruta = maiorPontuacaoBruta < pontuacaoBruta;

  async function loadEspelho() {
    if (!token || !inscricaoId) return;
    try {
      const r = await getEspelhoEtapa2(inscricaoId, token);
      setEspelho(r);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !inscricaoId) return;
    setBusy(true);
    setFeedback(null); setFieldErrors({});
    try {
      const pontuacaoItens = Object.fromEntries(
        itensDraft.filter((entry) => entry.chave.trim()).map((entry) => [entry.chave.trim(), Number(entry.valor) || 0]),
      );
      if (!Object.keys(pontuacaoItens).length) {
        setFeedback({ type: "warning", text: "Informe ao menos um item de pontuacao." });
        return;
      }
      const glosas = glosasDraft
        .filter((entry) => entry.item.trim() || entry.descricao.trim() || Number(entry.pontosGlosados) > 0)
        .map((entry) => ({ item: entry.item.trim(), descricao: entry.descricao.trim(), pontosGlosados: Number(entry.pontosGlosados) || 0 }));
      if (maiorPontuacaoBruta <= 0) {
        setFeedback({ type: "warning", text: "A maior pontuacao bruta deve ser maior que zero." });
        return;
      }
      if (pontuacaoBruta < 0) {
        setFeedback({ type: "warning", text: "A pontuacao bruta nao pode ser negativa." });
        return;
      }
      await registrarEtapa2(inscricaoId, { pontuacaoItens, pontuacaoBruta, maiorPontuacaoBruta, glosas, espelhoCorrecao, liberarEspelho: liberarEspelhoFlag, publicacao }, token);
      await loadItem();
      if (espelho) {
        await loadEspelho();
      }
      setFeedback({ type: "success", text: "Resultado da etapa 2 salvo." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFieldErrors(pickFirstFieldErrors(error, ["pontuacaoItens", "pontuacaoBruta", "maiorPontuacaoBruta", "glosas", "espelhoCorrecao", "publicacao"] as const));
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function onLiberarEspelho() {
    if (!token || !inscricaoId) return;
    setBusy(true);
    setFeedback(null);
    try {
      await liberarEspelhoEtapa2(inscricaoId, token);
      await loadItem();
      setFeedback({ type: "success", text: "Espelho da etapa 2 liberado." });
      await loadEspelho();
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (pageStatus === "loading") return <LoadingState title="Carregando detalhe" description="Consultando a inscricao." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar" description={feedback?.text} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="Inscricao nao localizada na fila da etapa 2." />;

  const espelhoLiberado = !!item.avaliacao?.espelhoLiberadoEm;
  const editState = item.edicao;
  const podeSalvarResultado = publicacao === "FINAL" ? (editState?.podeSalvarFinal ?? true) : (editState?.podeSalvarPreliminar ?? true);
  const bloqueioResultado = publicacao === "FINAL" ? editState?.bloqueioSalvarFinal : editState?.bloqueioSalvarPreliminar;

  function updateItem(index: number, field: keyof ItemDraft, value: string) {
    setItensDraft((cur) => cur.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  }
  function updateGlosa(index: number, field: keyof GlosaDraft, value: string) {
    setGlosasDraft((cur) => cur.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  }

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && <PageFeedback description={feedback.text} title={feedback.type === "success" ? "Etapa 2 atualizada" : feedback.type === "warning" ? "Atencao na etapa 2" : "Nao foi possivel salvar a etapa 2"} type={feedback.type} />}

      {/* Header */}
      <div className="admin-detail-header">
        <h1>Etapa 2 — {item.candidato.nomeCompleto}</h1>
        <p>Edital {item.edital.numero} &middot; Pontuacao de titulos do Anexo II</p>
      </div>

      {/* Summary cards */}
      <div className="admin-summary-cards">
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Pontuacao bruta</span>
          <span className="admin-summary-card-value">{item.avaliacao?.pontuacaoBruta ?? "—"}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Maior pontuacao</span>
          <span className="admin-summary-card-value">{maiorPontuacaoBruta}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Nota normalizada</span>
          <span className="admin-summary-card-value admin-summary-card-value--primary">
            {item.avaliacao?.notaNormalizada ?? notaNormalizada.toFixed(1)}
          </span>
        </div>
      </div>

      <div className="admin-form-card" style={{ gap: 10 }}>
        <h2 className="admin-form-card-title">Leitura operacional</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "#475569" }}>
          <span>Total bruto dos itens: <strong style={{ color: "#1E293B" }}>{totalBruto}</strong></span>
          <span>Total de glosas: <strong style={{ color: "#B45309" }}>{totalGlosa}</strong></span>
          <span>Total liquido calculado: <strong style={{ color: "#1E293B" }}>{totalLiquido}</strong></span>
          <span>Formula do edital: <strong style={{ color: "#1E293B" }}>({pontuacaoBruta} / {maiorPontuacaoBruta || 0}) * 10 = {notaNormalizada.toFixed(2)}</strong></span>
        </div>
        {pontuacaoDivergente ? (
          <PageFeedback
            type="warning"
            title="Pontuacao bruta diferente do total liquido"
            description="A tabela soma um total liquido diferente da pontuacao bruta informada. Revise a digitacao ou use o atalho para aplicar o total calculado."
          />
        ) : null}
      {referenciaMenorQueBruta ? (
          <PageFeedback
            type="warning"
            title="Maior pontuacao de referencia menor que a pontuacao do candidato"
            description="A referencia usada para normalizacao ficou menor que a pontuacao bruta informada. Ajuste a referencia para evitar nota acima de 10."
          />
      ) : null}

      {!podeSalvarResultado && bloqueioResultado ? (
        <PageFeedback type="warning" title="Resultado bloqueado" description={bloqueioResultado} />
      ) : null}
      </div>

      {/* Itens de pontuacao */}
      <form className="admin-form-card" onSubmit={onSubmit}>
        <h2 className="admin-form-card-title">Itens de pontuacao</h2>
        {fieldErrors.pontuacaoItens ? <PageFeedback type="error" title="Itens de pontuacao invalidos" description={fieldErrors.pontuacaoItens} /> : null}
        {fieldErrors.glosas ? <PageFeedback type="error" title="Glosas invalidas" description={fieldErrors.glosas} /> : null}
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Adicione os itens do Anexo II com pontuacao e glosas quando aplicavel.</p>

        <table className="admin-pont-table">
          <thead>
            <tr>
              <th>Item do Anexo II</th>
              <th>Valor</th>
              <th>Glosa</th>
              <th>Liquido</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {itensDraft.map((entry, index) => {
              const valor = Number(entry.valor) || 0;
              const glosaForItem = glosasDraft
                .filter((g) => g.item.trim().toLowerCase() === entry.chave.trim().toLowerCase())
                .reduce((sum, g) => sum + (Number(g.pontosGlosados) || 0), 0);
              const liquido = valor - glosaForItem;

              return (
                <tr key={entry.id}>
                  <td>
                      <input
                        disabled={!podeSalvarResultado || busy}
                        onChange={(e) => updateItem(index, "chave", e.target.value)}
                      placeholder="Nome do item"
                      style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, fontWeight: 500, color: "#1E293B" }}
                      value={entry.chave}
                    />
                  </td>
                  <td className="pont-valor">
                      <input
                        disabled={!podeSalvarResultado || busy}
                        min={0}
                      onChange={(e) => updateItem(index, "valor", e.target.value)}
                      step={0.1}
                      style={{ width: 60, textAlign: "center", border: "none", background: "transparent", fontWeight: 700 }}
                      type="number"
                      value={entry.valor}
                    />
                  </td>
                  <td className={glosaForItem > 0 ? "pont-glosa" : "pont-zero"}>{glosaForItem}</td>
                  <td className="pont-valor">{liquido}</td>
                  <td>
                    {itensDraft.length > 1 && (
                      <button
                        onClick={() => setItensDraft((cur) => cur.filter((_, i) => i !== index))}
                        style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", fontSize: 16 }}
                        type="button"
                      >
                        &times;
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td className="pont-valor">{totalBruto}</td>
              <td className="pont-glosa">{totalGlosa}</td>
              <td className="pont-total-liq">{totalLiquido}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <button
          className="admin-pagination-btn"
          onClick={() => setItensDraft((cur) => [...cur, { id: uid(), chave: "", valor: "0" }])}
          disabled={!podeSalvarResultado || busy}
          style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
          type="button"
        >
          + Adicionar item
        </button>

        {/* Glosas */}
        {glosasDraft.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Glosas aplicadas</label>
            {glosasDraft.map((g, index) => (
              <div className="admin-form-row" key={g.id}>
                <div className="admin-eval-field">
                  <input disabled={!podeSalvarResultado || busy} onChange={(e) => updateGlosa(index, "item", e.target.value)} placeholder="Item glosado" value={g.item} />
                </div>
                <div className="admin-eval-field" style={{ flex: 2 }}>
                  <input disabled={!podeSalvarResultado || busy} onChange={(e) => updateGlosa(index, "descricao", e.target.value)} placeholder="Descricao da glosa" value={g.descricao} />
                </div>
                <div className="admin-eval-field" style={{ maxWidth: 100 }}>
                  <input disabled={!podeSalvarResultado || busy} min={0} onChange={(e) => updateGlosa(index, "pontosGlosados", e.target.value)} step={0.1} type="number" value={g.pontosGlosados} />
                </div>
                <button
                  onClick={() => setGlosasDraft((cur) => cur.filter((_, i) => i !== index))}
                  disabled={!podeSalvarResultado || busy}
                  style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", fontSize: 16, alignSelf: "center" }}
                  type="button"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="admin-pagination-btn"
          onClick={() => setGlosasDraft((cur) => [...cur, { id: uid(), item: "", descricao: "", pontosGlosados: "0" }])}
          disabled={!podeSalvarResultado || busy}
          style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
          type="button"
        >
          + Adicionar glosa
        </button>

        {/* Pontuacao bruta e maior */}
        <div className="admin-form-row">
          <div className="admin-eval-field">
            <label>Pontuacao bruta</label>
            <input aria-invalid={!!fieldErrors.pontuacaoBruta} disabled={!podeSalvarResultado || busy} min={0} onChange={(e) => { setPontuacaoBruta(Number(e.target.value) || 0); setFieldErrors((current) => ({ ...current, pontuacaoBruta: null })); }} type="number" value={pontuacaoBruta} />
            {fieldErrors.pontuacaoBruta ? <span className="field-error-text">{fieldErrors.pontuacaoBruta}</span> : null}
          </div>
          <div className="admin-eval-field">
            <label>Maior pontuacao bruta</label>
            <input aria-invalid={!!fieldErrors.maiorPontuacaoBruta} disabled={!podeSalvarResultado || busy} min={0.1} onChange={(e) => { setMaiorPontuacaoBruta(Number(e.target.value) || 0); setFieldErrors((current) => ({ ...current, maiorPontuacaoBruta: null })); }} step={0.1} type="number" value={maiorPontuacaoBruta} />
            {fieldErrors.maiorPontuacaoBruta ? <span className="field-error-text">{fieldErrors.maiorPontuacaoBruta}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              className="admin-pagination-btn"
              onClick={() => setPontuacaoBruta(Number(totalLiquido.toFixed(2)))}
              disabled={!podeSalvarResultado || busy}
              style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
              type="button"
            >
              Usar total liquido calculado
            </button>
            <button
              type="button"
              onClick={() => setHelperHint((current) => current === "liquido" ? null : "liquido")}
              className="admin-inline-help"
              aria-label="Explicar uso do total liquido calculado"
            >
              ?
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              className="admin-pagination-btn"
              onClick={() => setMaiorPontuacaoBruta(Math.max(pontuacaoBruta, Number(totalLiquido.toFixed(2)), 0.1))}
              disabled={!podeSalvarResultado || busy}
              style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
              type="button"
            >
              Usar maior referencia compativel
            </button>
            <button
              type="button"
              onClick={() => setHelperHint((current) => current === "referencia" ? null : "referencia")}
              className="admin-inline-help"
              aria-label="Explicar uso da maior referencia compativel"
            >
              ?
            </button>
          </div>
        </div>
        {helperHint === "liquido" ? (
          <PageFeedback
            type="info"
            title="Usar total liquido calculado"
            description="Copia para o campo de pontuacao bruta o total dos itens menos as glosas. Use quando a pontuacao final do candidato deve ser exatamente o resultado da tabela acima."
          />
        ) : null}
        {helperHint === "referencia" ? (
          <PageFeedback
            type="info"
            title="Usar maior referencia compativel"
            description="Ajusta a maior pontuacao de referencia para nao ficar menor que a pontuacao usada no calculo. Isso evita nota normalizada acima de 10 por erro operacional."
          />
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Espelho de correcao</label>
          <textarea aria-invalid={!!fieldErrors.espelhoCorrecao} disabled={!podeSalvarResultado || busy} className="text-area" onChange={(e) => { setEspelhoCorrecao(e.target.value); setFieldErrors((current) => ({ ...current, espelhoCorrecao: null })); }} value={espelhoCorrecao} />
          {fieldErrors.espelhoCorrecao ? <span className="field-error-text">{fieldErrors.espelhoCorrecao}</span> : null}
        </div>

        <div className="admin-form-row">
          <div className="admin-eval-field">
            <label>Publicacao</label>
            <select aria-invalid={!!fieldErrors.publicacao} className="select-field" disabled={busy} onChange={(e) => { setPublicacao(e.target.value as "PRELIMINAR" | "FINAL"); setFieldErrors((current) => ({ ...current, publicacao: null })); }} value={publicacao}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
            {fieldErrors.publicacao ? <span className="field-error-text">{fieldErrors.publicacao}</span> : null}
          </div>
          <div className="admin-eval-field" style={{ justifyContent: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input checked={publicacao === "FINAL" ? true : liberarEspelhoFlag} disabled={!podeSalvarResultado || publicacao === "FINAL"} onChange={(e) => setLiberarEspelhoFlag(e.target.checked)} type="checkbox" />
              {publicacao === "FINAL" ? "Espelho liberado automaticamente no resultado final" : "Liberar espelho junto do resultado"}
            </label>
          </div>
        </div>

        <button className="admin-page-cta" disabled={busy || !podeSalvarResultado} style={{ width: 200 }} type="submit">
          Salvar avaliacao
        </button>
      </form>

      {/* Espelho section */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Espelho da avaliacao</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Gerencie a liberacao do espelho de avaliacao para o candidato.</p>

        <div className="admin-espelho-row">
          <div className="admin-espelho-status">
            <label>Status do espelho</label>
            <div className="admin-espelho-info">
              <StatusBadge variant={espelhoLiberado ? "success" : "warning"}>
                {espelhoLiberado ? "Liberado" : "Nao liberado"}
              </StatusBadge>
              <span>{espelhoLiberado ? `Liberado em ${formatIsoDate(item.avaliacao?.espelhoLiberadoEm ?? null)}` : "O candidato ainda nao pode visualizar o espelho."}</span>
            </div>
          </div>
          <button className="admin-page-cta" disabled={busy || !(editState?.podeLiberarEspelho ?? true)} onClick={onLiberarEspelho} type="button">
            Liberar espelho
          </button>
        </div>
        {!(editState?.podeLiberarEspelho ?? true) && editState?.bloqueioLiberarEspelho ? (
          <PageFeedback type="warning" title="Liberacao do espelho bloqueada" description={editState.bloqueioLiberarEspelho} />
        ) : null}

        {espelho && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: "#F8FAFC", borderRadius: 6 }}>
            <small><strong>Espelho de correcao:</strong> {espelho.espelhoCorrecao ?? "—"}</small>
            <small><strong>Pontuacao bruta:</strong> {espelho.pontuacaoBruta ?? "—"}</small>
            <small><strong>Nota normalizada:</strong> {espelho.notaNormalizada ?? "—"}</small>
            <small><strong>Solicitado em:</strong> {formatIsoDate(espelho.espelhoSolicitadoEm)}</small>
            <small><strong>Liberado em:</strong> {formatIsoDate(espelho.espelhoLiberadoEm)}</small>
            <small><strong>Resultado preliminar em:</strong> {formatIsoDate(espelho.resultadoPreliminarEm)}</small>
            <small><strong>Resultado final em:</strong> {formatIsoDate(espelho.resultadoFinalEm)}</small>
          </div>
        )}

        {!espelho && (
          <button
            className="admin-pagination-btn"
            disabled={busy}
            onClick={loadEspelho}
            style={{ width: "auto", padding: "8px 16px", fontSize: 13 }}
            type="button"
          >
            Carregar espelho administrativo
          </button>
        )}
      </div>
    </div>
  );
}
