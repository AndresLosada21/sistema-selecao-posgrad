"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { formatIsoDate } from "@/modules/edital/formatters";
import { solicitarEspelhoEtapa1, solicitarEspelhoEtapa2, getEspelhoEtapa1Candidate, getEspelhoEtapa2Candidate } from "@/modules/espelho/api";
import type { CandidateEtapa1Espelho, CandidateEtapa2Espelho } from "@/modules/espelho/types";

const iconFilePen = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10" /><path d="M14 2v6h6" /><path d="M10.4 21.9a2 2 0 1 1-3.8-1.2l1.4-4.3 4-1.4-1.6 6.9z" /></svg>;
const iconAward = (c: string) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>;
const iconArrowLeft = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>;

type Props = { params: Promise<{ editalId: string }> };

/* Maps backend keys to display labels */
const CRITERIA_LABELS: Record<string, string> = {
  adequacaoDominioTema: "Adequação e domínio do tema",
  estrutura: "Estrutura",
  organizacaoCoerencia: "Organização e coerência",
  objetividadeSintese: "Objetividade e síntese",
  grafiaGramatica: "Grafia e gramática",
};

type RubricaCriterio = { notaAtribuida: number; pesoPercentual: number; contribuicao: number; observacao?: string | null };
type RubricaDetalhada = {
  criterios?: Record<string, RubricaCriterio>;
  notaFinal?: number;
  notaCalculadaSemPenalidadeIa?: number;
  situacaoFinal?: string;
  observacoes?: Record<string, string>;
  usoIaComprovado?: boolean;
  fundamentoUsoIa?: string | null;
  regraEliminacao?: { notaMinima?: number; eliminadaPorNota?: boolean; eliminadaPorUsoIa?: boolean };
};

export default function CandidateEspelhosPage({ params }: Props) {
  const session = useSession();
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [espelho1, setEspelho1] = useState<CandidateEtapa1Espelho | null>(null);
  const [espelho2, setEspelho2] = useState<CandidateEtapa2Espelho | null>(null);
  const [soliciting, setSoliciting] = useState<string | null>(null);
  const [loadingEspelho, setLoadingEspelho] = useState<string | null>(null);

  useEffect(() => { let c = false; params.then((r) => { if (!c) setEditalId(r.editalId); }); return () => { c = true; }; }, [params]);

  useAbortableEffect(async (signal) => {
    if (!session.token || !editalId) return;
    try {
      const response = await getCandidateDashboard(session.token);
      if (signal.aborted) return;
      setData(response); setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error)); setStatus("error");
    }
  }, [editalId, session.signOut, session.token]);

  const item = useMemo(() => data?.items.find((e) => e.edital.id === editalId) ?? null, [data, editalId]);
  const inscricaoId = item?.inscricao?.id ?? null;
  const etapa1 = item?.inscricao?.etapa1 ?? null;
  const etapa2 = item?.inscricao?.etapa2 ?? null;
  const e1CanRequest = Boolean(item?.elegibilidade?.podeSolicitarEspelhoEtapa1);
  const e2CanRequest = Boolean(item?.elegibilidade?.podeSolicitarEspelhoEtapa2);
  const e1Released = Boolean(item?.elegibilidade?.podeVerEspelhoEtapa1);
  const e2Released = Boolean(item?.elegibilidade?.podeVerEspelhoEtapa2);

  async function handleSolicitar(etapa: "1" | "2") {
    if (!session.token || !inscricaoId) return;
    setSoliciting(etapa); setMessage(null);
    try {
      if (etapa === "1") await solicitarEspelhoEtapa1(inscricaoId, session.token);
      else await solicitarEspelhoEtapa2(inscricaoId, session.token);
      const response = await getCandidateDashboard(session.token);
      setData(response);
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setSoliciting(null); }
  }

  async function handleVerEspelho(etapa: "1" | "2") {
    if (!session.token || !inscricaoId) return;
    setLoadingEspelho(etapa); setMessage(null);
    try {
      if (etapa === "1") { const e = await getEspelhoEtapa1Candidate(inscricaoId, session.token); setEspelho1(e); }
      else { const e = await getEspelhoEtapa2Candidate(inscricaoId, session.token); setEspelho2(e); }
    } catch (error) {
      if (isUnauthorizedError(error)) { session.signOut(); return; }
      setMessage(getErrorMessage(error));
    } finally { setLoadingEspelho(null); }
  }

  if (status === "loading") return <LoadingState title="Carregando espelhos" description="Consultando o status das etapas e dos espelhos." />;
  if (status === "error") return <ErrorState title="Não foi possível carregar os espelhos" description={message ?? undefined} />;
  if (!item) return <EmptyState title="Edital não vinculado" description="Você ainda não entrou neste edital para consultar espelhos." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="part-header">
        <h1>Espelhos de correção</h1>
          <p>{item.edital.numero} — Solicite ou acompanhe a liberação dos espelhos das etapas 1 e 2.</p>
      </div>

      {message ? <div style={{ padding: "12px 16px", background: "#FEF2F2", borderRadius: 6, color: "#991B1B", fontSize: 13 }}>{message}</div> : null}

      {/* Etapa 1 card */}
      <div className="part-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px" }}>
          {iconFilePen}
          <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Etapa 1 — Redação</span>
          <StatusBadge variant={e1Released ? "success" : e1CanRequest ? "info" : "neutral"}>
              {e1Released ? "Liberado" : etapa1?.espelhoSolicitadoEm ? "Solicitação registrada" : "Ainda não solicitado"}
          </StatusBadge>
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {e1Released && espelho1 ? (
            (() => {
              const rubrica = espelho1.rubricaDetalhada as RubricaDetalhada | null;
              const criterios = rubrica?.criterios ?? {};
              const notaFinal = rubrica?.notaFinal ?? etapa1?.nota ?? null;
              const situacao = rubrica?.situacaoFinal ?? null;
              const entries = Object.entries(criterios);
              return (
                <>
                  {/* Situacao + nota */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#1E293B" }}>Nota final: {notaFinal ?? "—"}</span>
                    {situacao ? <StatusBadge variant={situacao === "APROVADA" ? "success" : "error"}>{situacao}</StatusBadge> : null}
                  </div>

                  {/* Tema */}
                  {espelho1.tema ? (
                    <div style={{ fontSize: 13, color: "#64748B" }}>
                      <strong style={{ color: "#334155" }}>Tema:</strong> {espelho1.tema}
                    </div>
                  ) : null}

                  {/* Rubric table */}
                  {entries.length > 0 ? (
                    <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ display: "flex", padding: "10px 16px", background: "#F8FAFC", fontSize: 12, fontWeight: 600, color: "#64748B" }}>
                        <span style={{ flex: 1 }}>Critério</span>
                        <span style={{ width: 60, textAlign: "center" }}>Peso</span>
                        <span style={{ width: 60, textAlign: "center" }}>Nota</span>
                        <span style={{ width: 80, textAlign: "center" }}>Contrib.</span>
                      </div>
                      {entries.map(([key, val], i) => (
                        <div key={key} style={{ display: "flex", flexDirection: "column", background: i % 2 === 0 ? "transparent" : "#F8FAFC", borderTop: "1px solid #F1F5F9" }}>
                          <div style={{ display: "flex", padding: "10px 16px", fontSize: 13 }}>
                            <span style={{ flex: 1, color: "#334155" }}>{CRITERIA_LABELS[key] ?? key}</span>
                            <span style={{ width: 60, textAlign: "center", color: "#64748B" }}>{val.pesoPercentual}%</span>
                            <span style={{ width: 60, textAlign: "center", fontWeight: 600, color: "#1E293B" }}>{val.notaAtribuida}</span>
                            <span style={{ width: 80, textAlign: "center", color: "#64748B" }}>{val.contribuicao}</span>
                          </div>
                          {val.observacao ? <div style={{ padding: "0 16px 8px", fontSize: 12, color: "#94A3B8" }}>Obs: {val.observacao}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* Espelho de correcao */}
                  {espelho1.espelhoCorrecao ? (
                    <div style={{ background: "#F8FAFC", borderRadius: 6, padding: "12px 16px", fontSize: 13, color: "#334155" }}>
                      <strong>Espelho de correção:</strong> {espelho1.espelhoCorrecao}
                    </div>
                  ) : null}

                  {/* IA warning */}
                  {rubrica?.usoIaComprovado ? (
                    <div style={{ background: "#FEF2F2", borderRadius: 6, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#991B1B" }}>
                        Uso de IA comprovado — nota penalizada conforme regras do edital.
                      </span>
                      {rubrica.notaCalculadaSemPenalidadeIa != null ? (
                        <span style={{ fontSize: 12, color: "#B91C1C" }}>
                          Nota calculada antes da penalidade: {rubrica.notaCalculadaSemPenalidadeIa}
                        </span>
                      ) : null}
                      {rubrica.fundamentoUsoIa ? (
                        <div style={{ background: "#FFF5F5", borderRadius: 6, border: "1px solid #FECACA", padding: "10px 12px", fontSize: 12, lineHeight: 1.6, color: "#7F1D1D", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                          <strong>Fundamento:</strong> {rubrica.fundamentoUsoIa}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Texto submetido */}
                  {espelho1.textoSubmetido ? (
                    <details style={{ fontSize: 13, color: "#64748B" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 500, color: "#334155" }}>Ver texto submetido</summary>
                      <div style={{ marginTop: 8, padding: 16, background: "#F8FAFC", borderRadius: 6, border: "1px solid #E2E8F0", fontSize: 13, lineHeight: 1.7, color: "#334155", whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                        {espelho1.textoSubmetido}
                      </div>
                    </details>
                  ) : null}

                  {/* Dates */}
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#94A3B8" }}>
                    <span>Solicitado: {formatIsoDate(etapa1?.espelhoSolicitadoEm ?? null)}</span>
                    <span>Liberado: {formatIsoDate(etapa1?.espelhoLiberadoEm ?? null)}</span>
                    {espelho1.resultadoFinalEm ? <span>Resultado final: {formatIsoDate(espelho1.resultadoFinalEm)}</span> : null}
                  </div>
                </>
              );
            })()
          ) : e1Released ? (
            <button type="button" onClick={() => handleVerEspelho("1")} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              {loadingEspelho ? "Carregando..." : "Ver espelho"}
            </button>
          ) : e1CanRequest ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1, fontSize: 13, color: "#64748B" }}>Você já pode registrar o pedido do espelho da etapa 1. A visualização fica disponível quando houver liberação administrativa.</span>
              <button type="button" onClick={() => handleSolicitar("1")} disabled={soliciting === "1"} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {soliciting === "1" ? "Solicitando..." : "Solicitar espelho"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#64748B" }}>
              <span>{etapa1?.espelhoSolicitadoEm ? "Seu pedido já foi registrado. Aguarde a liberação administrativa para visualizar o espelho." : "O espelho da etapa 1 ainda não pode ser consultado nesta fase."}</span>
              {item.elegibilidade?.motivoBloqueioEspelhoEtapa1 ? <span>{item.elegibilidade.motivoBloqueioEspelhoEtapa1}</span> : null}
              {item.acompanhamento?.proximoPasso ? <span>{item.acompanhamento.proximoPasso}</span> : null}
            </div>
          )}
        </div>
      </div>

      {/* Etapa 2 card */}
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px" }}>
          {iconAward(e2Released ? "#2563EB" : "#94A3B8")}
          <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Etapa 2 — Títulos</span>
          <StatusBadge variant={e2Released ? "success" : e2CanRequest ? "info" : "neutral"}>
              {e2Released ? "Liberado" : etapa2?.espelhoSolicitadoEm ? "Solicitação registrada" : "Ainda não solicitado"}
          </StatusBadge>
        </div>
        <div style={{ height: 1, background: "#F1F5F9" }} />
        <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {e2Released && espelho2 ? (
            <>
              <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
                <span>Pontuação bruta: <strong>{espelho2.pontuacaoBruta ?? "—"}</strong></span>
                <span>Nota normalizada: <strong>{espelho2.notaNormalizada ?? "—"}</strong></span>
              </div>
              <div style={{ fontSize: 12, color: "#64748B" }}>
                A nota normalizada da etapa 2 é calculada automaticamente por regra de três simples a partir da pontuação bruta e da maior pontuação bruta da etapa.
              </div>
              {espelho2.pontuacaoItens ? (
                <div style={{ border: "1px solid #E2E8F0", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ display: "flex", padding: "10px 16px", background: "#F8FAFC", fontSize: 12, fontWeight: 600, color: "#64748B" }}>
                    <span style={{ flex: 1 }}>Item</span>
                     <span style={{ width: 80, textAlign: "center" }}>Pontuação</span>
                  </div>
                  {Object.entries(espelho2.pontuacaoItens).map(([key, val], i) => (
                    <div key={key} style={{ display: "flex", padding: "10px 16px", background: i % 2 === 0 ? "transparent" : "#F8FAFC", borderTop: "1px solid #F1F5F9", fontSize: 13 }}>
                      <span style={{ flex: 1, color: "#334155" }}>{key}</span>
                      <span style={{ width: 80, textAlign: "center", fontWeight: 600, color: "#1E293B" }}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {/* Espelho de correcao */}
              {espelho2.espelhoCorrecao ? (
                <div style={{ background: "#F8FAFC", borderRadius: 6, padding: "12px 16px", fontSize: 13, color: "#334155" }}>
                  <strong>Espelho de correção:</strong> {espelho2.espelhoCorrecao}
                </div>
              ) : null}
              {/* Glosas */}
              {espelho2.glosas && espelho2.glosas.length > 0 ? (
                <div style={{ fontSize: 13, color: "#334155" }}>
                  <strong>Glosas aplicadas:</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                    {espelho2.glosas.map((g, i) => {
                      const glosa = g as Record<string, unknown>;
                      const item = glosa.item ?? glosa.descricao ?? "";
                      const pontos = glosa.pontosGlosados ?? glosa.pontos ?? "";
                      return (
                        <li key={i} style={{ color: "#64748B" }}>
                          {String(item)}{pontos ? ` (${pontos} pts glosados)` : ""}
                          {glosa.descricao && glosa.item ? <span style={{ color: "#94A3B8" }}> — {String(glosa.descricao)}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {/* Memoria de calculo */}
              {espelho2.memoriaCalculo ? (
                (() => {
                  const mc = espelho2.memoriaCalculo as Record<string, unknown>;
                  const formula = typeof mc.formula === "string" ? mc.formula : null;
                  const pBruta = mc.pontuacaoBruta;
                  const nNorm = mc.notaNormalizada;
                  const maiorPB = mc.maiorPontuacaoBruta;
                  const itens = mc.itensPontuados as Record<string, number> | null | undefined;
                  return (
                    <details style={{ fontSize: 13, color: "#64748B" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 500, color: "#334155" }}>Ver memória de cálculo</summary>
                      <div style={{ marginTop: 8, background: "#F8FAFC", borderRadius: 6, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                        {/* Formula */}
                        {formula ? (
                          <div style={{ padding: "10px 14px", background: "#EFF6FF", borderRadius: 6, border: "1px solid #DBEAFE", fontSize: 12, color: "#1E40AF", fontFamily: "monospace" }}>
                            {formula}
                          </div>
                        ) : null}
                        {/* Key values */}
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          {pBruta != null ? <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 14px", display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 11, color: "#94A3B8" }}>Pontuação bruta</span><strong style={{ fontSize: 14, color: "#1E293B" }}>{String(pBruta)}</strong></div> : null}
                          {maiorPB != null ? <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 14px", display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 11, color: "#94A3B8" }}>Maior pontuação bruta</span><strong style={{ fontSize: 14, color: "#1E293B" }}>{String(maiorPB)}</strong></div> : null}
                          {nNorm != null ? <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, padding: "8px 14px", display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 11, color: "#94A3B8" }}>Nota normalizada</span><strong style={{ fontSize: 14, color: "#1E293B" }}>{String(nNorm)}</strong></div> : null}
                        </div>
                        {/* Itens pontuados */}
                        {itens && Object.keys(itens).length > 0 ? (
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>Itens pontuados:</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                              {Object.entries(itens).map(([k, v]) => (
                                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 12px", background: "#fff", borderRadius: 4, border: "1px solid #F1F5F9" }}>
                                  <span style={{ color: "#334155" }}>{k}</span>
                                  <strong style={{ color: "#1E293B" }}>{v}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  );
                })()
              ) : null}
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#94A3B8" }}>
                <span>Solicitado: {formatIsoDate(etapa2?.espelhoSolicitadoEm ?? null)}</span>
                <span>Liberado: {formatIsoDate(etapa2?.espelhoLiberadoEm ?? null)}</span>
                {espelho2.resultadoFinalEm ? <span>Resultado final: {formatIsoDate(espelho2.resultadoFinalEm)}</span> : null}
              </div>
            </>
          ) : e2Released ? (
            <button type="button" onClick={() => handleVerEspelho("2")} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" }}>
              {loadingEspelho ? "Carregando..." : "Ver espelho"}
            </button>
          ) : e2CanRequest ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1, fontSize: 13, color: "#64748B" }}>Você já pode registrar o pedido do espelho da etapa 2. A visualização fica disponível quando houver liberação administrativa.</span>
              <button type="button" onClick={() => handleSolicitar("2")} disabled={soliciting === "2"} style={{ background: "#2563EB", color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {soliciting === "2" ? "Solicitando..." : "Solicitar espelho"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#64748B" }}>
              <span>{etapa2?.espelhoSolicitadoEm ? "Seu pedido já foi registrado. Aguarde a liberação administrativa para visualizar o espelho." : "O espelho da etapa 2 ainda não pode ser consultado nesta fase."}</span>
              {item.elegibilidade?.motivoBloqueioEspelhoEtapa2 ? <span>{item.elegibilidade.motivoBloqueioEspelhoEtapa2}</span> : null}
              {item.acompanhamento?.proximoPasso ? <span>{item.acompanhamento.proximoPasso}</span> : null}
            </div>
          )}
        </div>
      </div>

      {/* Back link */}
      <Link href={`/candidato/editais/${editalId}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#2563EB", textDecoration: "none" }}>
        {iconArrowLeft} Voltar ao edital
      </Link>
    </div>
  );
}
