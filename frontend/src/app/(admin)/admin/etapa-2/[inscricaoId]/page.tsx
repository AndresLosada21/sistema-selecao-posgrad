"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AdminBreadcrumb } from "@/components/shared/admin-breadcrumb";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, getFirstFormError, pickFirstFieldErrors, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { getEspelhoEtapa2, getEtapa2Item, liberarEspelhoEtapa2, listEtapa2AnexoIiItems, registrarEtapa2 } from "@/modules/admin-etapas/api";
import type { AnexoIiItem, Etapa2AdminItem, Etapa2Espelho } from "@/modules/admin-etapas/types";

type Props = { params: Promise<{ inscricaoId: string }> };

type ItemDraft = { id: string; chave: string; valor: string };
type GlosaDraft = { id: string; item: string; descricao: string; pontosGlosados: string };

const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/* ícones inline (lucide) */
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14H7L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
);
const SaveIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
);
const ZapIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
);

export default function AdminEtapa2DetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<Etapa2AdminItem | null>(null);
  const [espelho, setEspelho] = useState<Etapa2Espelho | null>(null);
  const [anexoIiItems, setAnexoIiItems] = useState<AnexoIiItem[]>([]);

  const [itensDraft, setItensDraft] = useState<ItemDraft[]>([{ id: uid(), chave: "titulo", valor: "0" }]);
  const [glosasDraft, setGlosasDraft] = useState<GlosaDraft[]>([]);
  const [pontuacaoBruta, setPontuacaoBruta] = useState(0);
  const [maiorPontuacaoBruta, setMaiorPontuacaoBruta] = useState(10);
  const [espelhoCorrecao, setEspelhoCorrecao] = useState("");
  const [publicacao, setPublicacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [helperHint, setHelperHint] = useState<"liquido" | "referencia" | null>(null);
  const [confirmLiberarEspelho, setConfirmLiberarEspelho] = useState(false);

  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => { if (!cancelled) setInscricaoId(resolved.inscricaoId); });
    return () => { cancelled = true; };
  }, [params]);

  const loadItem = useCallback(async () => {
    if (!token || !inscricaoId) return;
    const [found, catalog] = await Promise.all([getEtapa2Item(inscricaoId, token), listEtapa2AnexoIiItems(token)]);
    setAnexoIiItems(catalog.items);
    const firstItemId = catalog.items[0]?.id ?? "titulo";
    setItem(found);
    setItensDraft(
      Object.entries(found?.avaliacao?.pontuacaoItens ?? { [firstItemId]: 0 }).map(([chave, valor]) => ({ id: uid(), chave, valor: String(valor) })),
    );
    setPontuacaoBruta(found?.avaliacao?.pontuacaoBruta ?? 0);
    setMaiorPontuacaoBruta(Math.max(found?.avaliacao?.pontuacaoBruta ?? 10, 10));
    setEspelhoCorrecao(found?.avaliacao?.espelhoCorrecao ?? "");
    setPublicacao(found?.avaliacao?.status === "FINAL_PUBLICADA" ? "FINAL" : "PRELIMINAR");
    setGlosasDraft(
      (found?.avaliacao?.glosas ?? []).map((glosa) => ({
        id: uid(),
        item: String((glosa as Record<string, unknown>).item ?? ""),
        descricao: String((glosa as Record<string, unknown>).descricao ?? ""),
        pontosGlosados: String((glosa as Record<string, unknown>).pontosGlosados ?? 0),
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
  }, [inscricaoId, loadItem, signOut, token]);

  const totalBruto = itensDraft.reduce((sum, entry) => sum + (Number(entry.valor) || 0), 0);
  const totalGlosa = glosasDraft.reduce((sum, entry) => sum + (Number(entry.pontosGlosados) || 0), 0);
  const totalLiquido = totalBruto - totalGlosa;
  const notaNormalizada = maiorPontuacaoBruta > 0 ? (pontuacaoBruta / maiorPontuacaoBruta) * 10 : 0;
  const notaCapped = Math.min(notaNormalizada, 10);
  const pontuacaoDivergente = Math.abs(pontuacaoBruta - totalLiquido) > 0.001;
  const referenciaMenorQueBruta = maiorPontuacaoBruta < pontuacaoBruta;
  const hasAvaliacao = Boolean(item?.avaliacao?.pontuacaoBruta != null);

  async function loadEspelho() {
    if (!token || !inscricaoId) return;
    try {
      const result = await getEspelhoEtapa2(inscricaoId, token);
      setEspelho(result);
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !inscricaoId) return;
    setBusy(true);
    setFeedback(null);
    setFieldErrors({});

    try {
      const pontuacaoItens = Object.fromEntries(
        itensDraft
          .filter((entry) => entry.chave.trim())
          .map((entry) => [entry.chave, Number(entry.valor) || 0]),
      );

      // Validação consolidada com fieldErrors
      const errors: Record<string, string> = {};

      if (!Object.keys(pontuacaoItens).length) {
        errors.pontuacaoItens = "Informe ao menos um item de pontuacao com nome preenchido.";
      }

      if (pontuacaoBruta < 0) {
        errors.pontuacaoBruta = "A pontuacao bruta nao pode ser negativa.";
      }

      if (maiorPontuacaoBruta <= 0) {
        errors.maiorPontuacaoBruta = "A maior pontuacao bruta deve ser maior que zero.";
      }

      if (!espelhoCorrecao.trim()) {
        errors.espelhoCorrecao = "O espelho de correcao e obrigatorio para salvar o resultado.";
      }

      const glosas = glosasDraft
        .filter((entry) => entry.item.trim() || entry.descricao.trim() || Number(entry.pontosGlosados) > 0)
        .map((entry) => ({
          item: entry.item.trim(),
          descricao: entry.descricao.trim(),
          pontosGlosados: Math.max(0, Number(entry.pontosGlosados) || 0),
        }));

      const glosaExcedente = glosas.find((g) => g.item && g.pontosGlosados > getItemValor(g.item));
      if (glosaExcedente) {
        errors.glosas = `A glosa do item "${getItemLabel(glosaExcedente.item)}" (${glosaExcedente.pontosGlosados}) excede o valor do item (${getItemValor(glosaExcedente.item)}).`;
      }

      const glosasSemItem = glosas.filter((g) => !g.item && (g.descricao || g.pontosGlosados > 0));
      if (glosasSemItem.length > 0) {
        errors.glosas = errors.glosas ?? "Selecione o item de referencia em todas as glosas antes de salvar.";
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        const msgs = Object.values(errors);
        setFeedback({ type: "warning", text: msgs.length === 1 ? msgs[0] : `Corrija ${msgs.length} campos antes de salvar: ${msgs.join(" · ")}` });
        return;
      }

      await registrarEtapa2(inscricaoId, {
        pontuacaoItens,
        pontuacaoBruta,
        maiorPontuacaoBruta,
        glosas,
        espelhoCorrecao,
        liberarEspelho: publicacao === "FINAL",
        publicacao,
      }, token);

      await loadItem();
      if (espelho) {
        await loadEspelho();
      }
      setFeedback({ type: "success", text: "Resultado da etapa 2 salvo." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFieldErrors(pickFirstFieldErrors(error, ["pontuacaoItens", "pontuacaoBruta", "maiorPontuacaoBruta", "glosas", "espelhoCorrecao", "publicacao"] as const));
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function onLiberarEspelho() {
    if (!token || !inscricaoId) return;
    setBusy(true);
    setFeedback(null);
    try {
      await liberarEspelhoEtapa2(inscricaoId, token);
      await loadItem();
      setConfirmLiberarEspelho(false);
      setFeedback({ type: "success", text: "Espelho da etapa 2 liberado." });
      await loadEspelho();
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function updateItem(index: number, field: keyof ItemDraft, value: string) {
    if (field === "valor") {
      const n = Number(value);
      if (!isNaN(n) && n < 0) value = "0";
    }
    setItensDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  }

  function getItemLabel(itemId: string): string {
    return anexoIiItems.find((it) => it.id === itemId)?.label ?? itemId;
  }

  function getItemValor(itemChave: string): number {
    const found = itensDraft.find((it) => it.chave === itemChave);
    return found ? (Number(found.valor) || 0) : Infinity;
  }

  function getAvailableItems(currentValue: string) {
    const selected = new Set(itensDraft.map((it) => it.chave).filter(Boolean));
    return anexoIiItems.filter((catalogItem) => catalogItem.id === currentValue || !selected.has(catalogItem.id));
  }

  function updateGlosa(index: number, field: keyof GlosaDraft, value: string) {
    if (field === "pontosGlosados") {
      const n = Number(value);
      if (!isNaN(n) && n < 0) value = "0";
    }
    setGlosasDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  }

  if (pageStatus === "loading") return <LoadingState title="Carregando detalhe" description="Consultando a inscricao da etapa 2." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar" description={feedback?.text} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="Inscricao nao localizada na fila da etapa 2." />;

  const espelhoLiberado = Boolean(item.avaliacao?.espelhoLiberadoEm);
  const espelhoSolicitado = Boolean(item.avaliacao?.espelhoSolicitadoEm) && !espelhoLiberado;
  const editState = item.edicao;
  const podeSalvarResultado = publicacao === "FINAL" ? (editState?.podeSalvarFinal ?? true) : (editState?.podeSalvarPreliminar ?? true);
  const bloqueioResultado = publicacao === "FINAL" ? editState?.bloqueioSalvarFinal : editState?.bloqueioSalvarPreliminar;

  const displayBruta = hasAvaliacao ? `${item.avaliacao?.pontuacaoBruta ?? pontuacaoBruta} pts` : "--";
  const displayRef = hasAvaliacao ? `${maiorPontuacaoBruta} pts` : "--";
  const displayNota = hasAvaliacao ? `${(item.avaliacao?.notaNormalizada ?? notaCapped).toFixed(2)} / 10` : "--";
  const maiorRefSugerida = Math.max(pontuacaoBruta, Number(totalLiquido.toFixed(2)), 0.1);

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && (
        <div style={{ position: "relative" }}>
          <PageFeedback description={feedback.text} title={feedback.type === "success" ? "Etapa 2 atualizada" : feedback.type === "warning" ? "Atenção na etapa 2" : "Não foi possível salvar a etapa 2"} type={feedback.type} />
          <button onClick={() => setFeedback(null)} type="button" style={{ position: "absolute", top: 12, right: 12, border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#64748B", lineHeight: 1 }} aria-label="Fechar">&times;</button>
        </div>
      )}

      <AdminBreadcrumb items={[{ label: "Etapa 2", href: "/admin/etapa-2" }, { label: item.edital.numero }, { label: item.candidato.nomeCompleto }]} />

      <div className="admin-page-header" style={{ alignItems: "flex-start" }}>
        <div className="admin-page-header-left">
          <h1>Etapa 2 — {item.candidato.nomeCompleto}</h1>
          <p>Edital {item.edital.numero} · {item.linhaPesquisa?.nome ?? "Linha nao definida"} · Pontuacao de titulos do Anexo II</p>
        </div>
        <StatusBadge variant={getStatusVariant(item.avaliacao?.status ?? item.status)}>{getStatusLabel(item.avaliacao?.status ?? item.status)}</StatusBadge>
      </div>

      {/* KPI cards: bruta, ref, nota, fórmula */}
      <div className="admin-kpi-row">
        <div className="admin-kpi-card admin-kpi-card--plain">
          <span className="admin-kpi-label">Pontuacao bruta</span>
          <span className="admin-kpi-value">{displayBruta}</span>
        </div>
        <div className="admin-kpi-card admin-kpi-card--plain">
          <span className="admin-kpi-label">Maior pontuacao (ref.)</span>
          <span className="admin-kpi-value">{displayRef}</span>
        </div>
        <div className="admin-kpi-card admin-kpi-card--primary">
          <span className="admin-kpi-label">Nota normalizada</span>
          <span className="admin-kpi-value admin-kpi-value--primary">{displayNota}</span>
        </div>
        <div className="admin-kpi-card admin-kpi-card--plain">
          <span className="admin-kpi-label">Formula</span>
          {hasAvaliacao ? (
            <span className="admin-kpi-value" style={{ fontFamily: "monospace", fontSize: 15 }}>
              ({item.avaliacao?.pontuacaoBruta ?? pontuacaoBruta} / {maiorPontuacaoBruta}) &times; 10 = {(item.avaliacao?.notaNormalizada ?? notaCapped).toFixed(2)}
            </span>
          ) : (
            <span className="admin-kpi-value">--</span>
          )}
          <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>Bruta / Maior ref. &times; 10</span>
        </div>
      </div>

      <form className="admin-stage-layout" onSubmit={onSubmit}>
        <div className="admin-stage-main">
          {/* Itens de pontuação */}
          <div className="admin-form-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="admin-page-header-left" style={{ gap: 2 }}>
                <h2 className="admin-form-card-title">Itens de pontuacao — Anexo II</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>Pontuacao e glosas por item do Anexo II.</p>
              </div>
              <button className="admin-pagination-btn" onClick={() => setItensDraft((current) => [...current, { id: uid(), chave: getAvailableItems("")[0]?.id ?? "", valor: "0" }])} disabled={!podeSalvarResultado || busy || getAvailableItems("").length === 0} style={{ width: "auto", padding: "8px 16px", fontSize: 13 }} type="button">
                + Adicionar item
              </button>
            </div>
            {fieldErrors.pontuacaoItens ? <PageFeedback type="error" title="Itens de pontuacao invalidos" description={fieldErrors.pontuacaoItens} /> : null}

            <table className="admin-pont-table">
              <caption className="sr-only">Pontuacao por item do Anexo II</caption>
              <thead>
                <tr>
                  <th scope="col">Item do Anexo II</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Glosa</th>
                  <th scope="col">Liquido</th>
                  <th scope="col" style={{ width: 60 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {itensDraft.map((entry, index) => {
                  const valor = Number(entry.valor) || 0;
                  const glosaForItem = glosasDraft
                    .filter((glosa) => glosa.item === entry.chave)
                    .reduce((sum, glosa) => sum + (Number(glosa.pontosGlosados) || 0), 0);
                  const liquido = valor - glosaForItem;

                  return (
                    <tr key={entry.id}>
                      <td>
                         <select disabled={!podeSalvarResultado || busy} onChange={(e) => updateItem(index, "chave", e.target.value)} style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, fontWeight: 500, color: "#1E293B" }} value={entry.chave}>
                           <option value="">Selecione o item...</option>
                           {getAvailableItems(entry.chave).map((catalogItem) => <option key={catalogItem.id} value={catalogItem.id}>{catalogItem.label}</option>)}
                         </select>
                      </td>
                      <td className="pont-valor">
                        <input disabled={!podeSalvarResultado || busy} min={0} onChange={(e) => updateItem(index, "valor", e.target.value)} step={0.1} style={{ width: 60, textAlign: "center", border: "none", background: "transparent", fontWeight: 700 }} type="number" value={entry.valor} />
                      </td>
                      <td className={glosaForItem > 0 ? "pont-glosa" : "pont-zero"}>{glosaForItem}</td>
                      <td className="pont-valor">{liquido}</td>
                      <td>
                        {itensDraft.length > 1 ? (
                          <button onClick={() => setItensDraft((current) => current.filter((_, currentIndex) => currentIndex !== index))} style={{ border: "none", background: "none", color: "#EF4444", cursor: "pointer", display: "flex", alignItems: "center" }} type="button">
                            <TrashIcon />
                          </button>
                        ) : null}
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
          </div>

          {/* Glosas — cards individuais */}
          <div className="admin-form-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="admin-page-header-left" style={{ gap: 2 }}>
                <h2 className="admin-form-card-title">Glosas aplicadas</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>Itens nao comprovados ou parcialmente validos.</p>
              </div>
              <button className="admin-glosa-add-btn" onClick={() => setGlosasDraft((current) => [...current, { id: uid(), item: "", descricao: "", pontosGlosados: "0" }])} disabled={!podeSalvarResultado || busy} type="button">
                + Adicionar glosa
              </button>
            </div>
            {fieldErrors.glosas ? <PageFeedback type="error" title="Glosas invalidas" description={fieldErrors.glosas} /> : null}

            {glosasDraft.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {glosasDraft.map((entry, index) => (
                  <div className="admin-glosa-card" key={entry.id}>
                    {(() => {
                      const maxVal = getItemValor(entry.item);
                      const excede = entry.item.trim() && Number(entry.pontosGlosados) > maxVal;
                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <select
                              disabled={!podeSalvarResultado || busy}
                              onChange={(e) => updateGlosa(index, "item", e.target.value)}
                              value={entry.item}
                              style={{ flex: 1, border: "1px solid #FECACA", background: "#fff", fontWeight: 600, fontSize: 13, color: "#991B1B", borderRadius: 4, padding: "4px 8px" }}
                            >
                              <option value="">Selecione o item...</option>
                              {itensDraft.filter((it) => it.chave).map((it) => (
                                <option key={it.id} value={it.chave}>{getItemLabel(it.chave)}</option>
                              ))}
                            </select>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, color: "#991B1B", fontWeight: 600, whiteSpace: "nowrap" }}>-{entry.pontosGlosados} pts</span>
                              <input disabled={!podeSalvarResultado || busy} min={0} max={maxVal === Infinity ? undefined : maxVal} onChange={(e) => updateGlosa(index, "pontosGlosados", e.target.value)} step={0.1} type="number" value={entry.pontosGlosados} style={{ width: 70, textAlign: "center", fontSize: 13, border: `1px solid ${excede ? "#EF4444" : "#FECACA"}`, borderRadius: 4, padding: "2px 4px", background: "#fff" }} />
                              <button onClick={() => setGlosasDraft((current) => current.filter((_, currentIndex) => currentIndex !== index))} disabled={!podeSalvarResultado || busy} style={{ border: "none", background: "none", color: "#991B1B", cursor: "pointer", display: "flex", alignItems: "center" }} type="button"><TrashIcon /></button>
                            </div>
                          </div>
                          {excede && <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 500 }}>Glosa ({entry.pontosGlosados}) excede o valor do item ({maxVal}).</span>}
                          <textarea disabled={!podeSalvarResultado || busy} onChange={(e) => updateGlosa(index, "descricao", e.target.value)} placeholder="Descricao da glosa" value={entry.descricao} style={{ width: "100%", border: "none", background: "transparent", fontSize: 13, color: "#7F1D1D", resize: "vertical", minHeight: 36 }} />
                        </>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-soft-note">Nenhuma glosa registrada. Se a avaliacao nao tiver reducoes, voce pode seguir sem preencher este bloco.</div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="admin-stage-side">
          {/* Cálculo e controles */}
          <div className="admin-form-card" style={{ gap: 12 }}>
            <h2 className="admin-form-card-title">Calculo e controles</h2>
            <div className="admin-calc-summary">
              <div className="admin-calc-summary-row"><span>Total bruto dos itens:</span><strong>{totalBruto}</strong></div>
              <div className="admin-calc-summary-row"><span>Total de glosas:</span><strong>-{totalGlosa}</strong></div>
              <hr style={{ border: "none", borderTop: "1px solid #E2E8F0", margin: "4px 0" }} />
              <div className="admin-calc-summary-row"><span>Total liquido calculado:</span><strong>{totalLiquido}</strong></div>
            </div>

            {pontuacaoDivergente && (
              <PageFeedback type="warning" title="Pontuacao bruta diferente do total liquido" description={`Total liquido da tabela e ${totalLiquido}, mas o campo de pontuacao bruta esta com ${pontuacaoBruta}.`}>
                <div className="admin-calc-summary" style={{ marginTop: 8, fontSize: 12 }}>
                  <div className="admin-calc-summary-row"><span>Bruto dos itens:</span><strong>{totalBruto}</strong></div>
                  <div className="admin-calc-summary-row"><span>Glosas:</span><strong>-{totalGlosa}</strong></div>
                  <div className="admin-calc-summary-row"><span>Liquido calculado:</span><strong>{totalLiquido}</strong></div>
                  <div className="admin-calc-summary-row"><span>Bruta informada:</span><strong style={{ color: "#A16207" }}>{pontuacaoBruta}</strong></div>
                </div>
              </PageFeedback>
            )}

            {referenciaMenorQueBruta && (
              <PageFeedback type="error" title="Referencia menor que a pontuacao do candidato" description={`Com referencia ${maiorPontuacaoBruta} e bruta ${pontuacaoBruta}, a nota resultante seria ${notaNormalizada.toFixed(2)} — acima de 10.`} />
            )}

            {!podeSalvarResultado && bloqueioResultado && (
              <PageFeedback type="error" title="Resultado bloqueado" description={bloqueioResultado} />
            )}

            <div className="admin-eval-field">
              <span>Pontuacao bruta</span>
              <input aria-invalid={!!fieldErrors.pontuacaoBruta} disabled={!podeSalvarResultado || busy} min={0} onChange={(e) => { setPontuacaoBruta(Math.max(0, Number(e.target.value) || 0)); setFieldErrors((current) => ({ ...current, pontuacaoBruta: null })); }} type="number" value={pontuacaoBruta} />
              {fieldErrors.pontuacaoBruta ? <span className="field-error-text">{fieldErrors.pontuacaoBruta}</span> : null}
            </div>
            <div className="admin-eval-field">
              <span>Maior pontuacao bruta (referencia)</span>
              <input aria-invalid={!!fieldErrors.maiorPontuacaoBruta} disabled={!podeSalvarResultado || busy} min={0.1} onChange={(e) => { setMaiorPontuacaoBruta(Math.max(0.1, Number(e.target.value) || 0.1)); setFieldErrors((current) => ({ ...current, maiorPontuacaoBruta: null })); }} step={0.1} type="number" value={maiorPontuacaoBruta} />
              {fieldErrors.maiorPontuacaoBruta ? <span className="field-error-text">{fieldErrors.maiorPontuacaoBruta}</span> : null}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button className="admin-shortcut-btn" onClick={() => setPontuacaoBruta(Number(totalLiquido.toFixed(2)))} disabled={!podeSalvarResultado || busy} type="button">
                  <ZapIcon /> Usar total liquido calculado
                </button>
                <button type="button" onClick={() => setHelperHint((current) => current === "liquido" ? null : "liquido")} className="admin-inline-help" aria-label="Explicar uso do total liquido calculado">?</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button className="admin-shortcut-btn" onClick={() => setMaiorPontuacaoBruta(maiorRefSugerida)} disabled={!podeSalvarResultado || busy} type="button">
                  <ZapIcon /> Usar maior referencia compativel ({maiorRefSugerida})
                </button>
                <button type="button" onClick={() => setHelperHint((current) => current === "referencia" ? null : "referencia")} className="admin-inline-help" aria-label="Explicar uso da maior referencia compativel">?</button>
              </div>
            </div>

            {helperHint === "liquido" ? <PageFeedback type="info" title="Usar total liquido calculado" description="Aplica o total da tabela (itens - glosas) como pontuacao bruta." /> : null}
            {helperHint === "referencia" ? <PageFeedback type="info" title="Usar maior referencia compativel" description="Ajusta a referencia para nao ficar menor que a pontuacao bruta usada no calculo." /> : null}
          </div>

          {/* Espelho de correção */}
          <div className="admin-form-card" style={{ gap: 12 }}>
            <h2 className="admin-form-card-title">Espelho de correcao</h2>
            <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>Visivel ao candidato apos liberacao do espelho.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea aria-invalid={!!fieldErrors.espelhoCorrecao} disabled={!podeSalvarResultado || busy} className="text-area" onChange={(e) => { setEspelhoCorrecao(e.target.value); setFieldErrors((current) => ({ ...current, espelhoCorrecao: null })); }} value={espelhoCorrecao} />
              {fieldErrors.espelhoCorrecao ? <span className="field-error-text">{fieldErrors.espelhoCorrecao}</span> : null}
            </div>

            <div className="admin-eval-field">
              <span>Tipo de publicacao</span>
              <select aria-invalid={!!fieldErrors.publicacao} className="select-field" disabled={busy} onChange={(e) => { setPublicacao(e.target.value as "PRELIMINAR" | "FINAL"); setFieldErrors((current) => ({ ...current, publicacao: null })); }} value={publicacao}>
                <option value="PRELIMINAR">Preliminar</option>
                <option value="FINAL">Final</option>
              </select>
              {fieldErrors.publicacao ? <span className="field-error-text">{fieldErrors.publicacao}</span> : null}
            </div>

            <span style={{ fontSize: 12, color: "#64748B" }}>{publicacao === "FINAL" ? "Resultado final libera o espelho automaticamente." : "Para resultado preliminar, use a acao confirmada de liberacao abaixo."}</span>
          </div>

          {/* Espelho do candidato */}
          <div className="admin-form-card" style={{ gap: 12 }}>
            <h2 className="admin-form-card-title">Espelho do candidato</h2>

            {espelhoSolicitado && (
              <PageFeedback type="warning" title="Espelho solicitado" description="Espelho solicitado pelo candidato, aguardando liberacao." />
            )}

            <div className="admin-espelho-row">
              <div className="admin-espelho-status">
                <span>Status do espelho</span>
                <div className="admin-espelho-info">
                  <StatusBadge variant={espelhoLiberado ? "success" : espelhoSolicitado ? "warning" : "neutral"}>
                    {espelhoLiberado ? "Liberado" : espelhoSolicitado ? "Solicitado" : "Não solicitado"}
                  </StatusBadge>
                  <span>
                    {espelhoLiberado
                      ? `em ${formatIsoDate(item.avaliacao?.espelhoLiberadoEm ?? null)}`
                      : espelhoSolicitado
                        ? `em ${formatIsoDate(item.avaliacao?.espelhoSolicitadoEm ?? null)}`
                        : "O candidato ainda nao pediu o espelho desta etapa."}
                  </span>
                </div>
              </div>
              {espelhoLiberado ? (
                <button className="admin-btn-disabled" disabled type="button">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Ja liberado
                </button>
              ) : (
                <button className="admin-page-cta" disabled={busy || !(editState?.podeLiberarEspelho ?? true)} onClick={() => setConfirmLiberarEspelho(true)} type="button">
                  {espelhoSolicitado ? "Liberar espelho" : "Liberar proativamente"}
                </button>
              )}
            </div>
            {!(editState?.podeLiberarEspelho ?? true) && editState?.bloqueioLiberarEspelho ? <PageFeedback type="warning" title="Liberacao do espelho bloqueada" description={editState.bloqueioLiberarEspelho} /> : null}

            {espelho && (
              <div className="admin-soft-note" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span><strong>Espelho de correcao:</strong> {espelho.espelhoCorrecao ?? "—"}</span>
                <span><strong>Pontuacao bruta:</strong> {espelho.pontuacaoBruta ?? "—"}</span>
                <span><strong>Nota normalizada:</strong> {espelho.notaNormalizada ?? "—"}</span>
                <span><strong>Solicitado:</strong> {formatIsoDate(espelho.espelhoSolicitadoEm)}</span>
                <span><strong>Liberado:</strong> {formatIsoDate(espelho.espelhoLiberadoEm)}</span>
              </div>
            )}
          </div>

          <button className="admin-page-cta" disabled={busy || !podeSalvarResultado} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} type="submit">
            <SaveIcon /> Salvar avaliacao
          </button>
        </div>
      </form>
      <ConfirmModal
        confirmLabel="Liberar espelho"
        description="Esta acao torna o espelho da etapa 2 visivel ao candidato. Confirme apenas se o conteudo e o candidato estao corretos."
        details={[`Candidato: ${item.candidato.nomeCompleto}`, `Inscricao: ${item.id}`, "Fase: Etapa 2"]}
        disabled={busy}
        onCancel={() => setConfirmLiberarEspelho(false)}
        onConfirm={onLiberarEspelho}
        open={confirmLiberarEspelho}
        title="Confirmar liberacao de espelho"
      />
    </div>
  );
}
