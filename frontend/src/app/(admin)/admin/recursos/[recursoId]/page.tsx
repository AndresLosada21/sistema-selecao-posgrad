"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { StatusBadge } from "@/components/shared/status-badge";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { useSession } from "@/lib/auth/session-provider";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { statusIsencaoOptions, type StatusIsencao } from "@/lib/enums";
import { getErrorMessage, getFirstFormError, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { formatIsoDate } from "@/modules/edital/formatters";
import { decidirRecursoAdmin, getAdminRecursoById } from "@/modules/admin-recursos/api";
import type { AdminRecursoItem } from "@/modules/admin-recursos/types";
import { resultadoPoliticasOptions } from "@/modules/admin-operacao/constants";

type Props = { params: Promise<{ recursoId: string }> };

export default function AdminRecursoDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [recursoId, setRecursoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminRecursoItem | null>(null);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deferido, setDeferido] = useState(false);
  const [decisao, setDecisao] = useState("");
  const [impactoResultado, setImpactoResultado] = useState(false);
  const [novoStatusIsencao, setNovoStatusIsencao] = useState<StatusIsencao | "">("");
  const [novoResultadoHomologacao, setNovoResultadoHomologacao] = useState<"HOMOLOGADA" | "NAO_HOMOLOGADA" | "">("");
  const [novaNotaEtapa1, setNovaNotaEtapa1] = useState("");
  const [novoEspelhoEtapa1, setNovoEspelhoEtapa1] = useState("");
  const [novaPontuacaoBrutaEtapa2, setNovaPontuacaoBrutaEtapa2] = useState("");
  const [novoEspelhoEtapa2, setNovoEspelhoEtapa2] = useState("");
  const [novoResultadoPoliticas, setNovoResultadoPoliticas] = useState<(typeof resultadoPoliticasOptions)[number] | "">("");
  const [novoParecerPoliticas, setNovoParecerPoliticas] = useState("");
  const [novosResultadosPoliticas, setNovosResultadosPoliticas] = useState<Record<string, { resultado: (typeof resultadoPoliticasOptions)[number] | ""; parecer: string }>>({});

  useEffect(() => { let c = false; params.then((r) => { if (!c) setRecursoId(r.recursoId); }); return () => { c = true; }; }, [params]);

  const loadItem = useCallback(async () => {
    if (!token || !recursoId) return;
    const found = await getAdminRecursoById(recursoId, token);
    setItem(found);
    setDeferido(found.status === "DEFERIDO");
    setDecisao(found.decisao ?? "");
    setImpactoResultado(found.status === "DEFERIDO" && found.fase !== "CLASSIFICACAO" ? found.impactoResultado : false);
    setNovoStatusIsencao("");
    setNovoResultadoHomologacao("");
    setNovaNotaEtapa1("");
    setNovoEspelhoEtapa1("");
    setNovaPontuacaoBrutaEtapa2("");
    setNovoEspelhoEtapa2("");
    setNovoResultadoPoliticas("");
    setNovoParecerPoliticas("");
    setNovosResultadosPoliticas(Object.fromEntries((found.contextoPoliticasAfirmativas ?? []).map((etapa) => [etapa.tipo, { resultado: "", parecer: etapa.parecerFinal ?? etapa.parecerPreliminar ?? "" }])));
  }, [recursoId, token]);

  useAbortableEffect(async (signal) => {
    if (!token || !recursoId) return;
    try { await loadItem(); if (signal.aborted) return; setPageStatus("ready"); }
    catch (e) { if (signal.aborted) return; if (isUnauthorizedError(e)) { signOut(); return; } setFeedback({ type: "error", text: getErrorMessage(e) }); setPageStatus("error"); }
  }, [loadItem, recursoId, signOut, token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !recursoId) return;
    setBusy(true); setFeedback(null);
    try {
      await decidirRecursoAdmin(recursoId, {
        deferido, decisao, impactoResultado,
        novoStatusIsencao: (novoStatusIsencao || undefined) as StatusIsencao | undefined,
        novoResultadoHomologacao: novoResultadoHomologacao || undefined,
        novaNotaEtapa1: novaNotaEtapa1 ? Number(novaNotaEtapa1) : undefined,
        novoEspelhoEtapa1: novoEspelhoEtapa1 || undefined,
        novaPontuacaoBrutaEtapa2: novaPontuacaoBrutaEtapa2 ? Number(novaPontuacaoBrutaEtapa2) : undefined,
        novoEspelhoEtapa2: novoEspelhoEtapa2 || undefined,
        novoResultadoFinalPoliticasAfirmativas: novoResultadoPoliticas || undefined,
        novoParecerFinalPoliticasAfirmativas: novoParecerPoliticas || undefined,
        novosResultadosFinaisPoliticasAfirmativas: isPoliticas
          ? Object.entries(novosResultadosPoliticas)
              .filter(([, value]) => value.resultado && value.parecer.trim())
              .filter(([tipo]) => !item?.tipoPoliticasAfirmativasReferencia || tipo === item.tipoPoliticasAfirmativasReferencia)
              .map(([tipo, value]) => ({ tipo, resultado: value.resultado as (typeof resultadoPoliticasOptions)[number], parecer: value.parecer }))
          : undefined,
      }, token);
      await loadItem();
      setFeedback({ type: "success", text: "Decisao registrada." });
    } catch (e) {
      if (isUnauthorizedError(e)) { signOut(); return; }
      setFeedback({ type: "error", text: getFirstFormError(e) ?? getErrorMessage(e) });
    } finally { setBusy(false); }
  }

  async function handleDownloadAnexo() {
    if (!token || !item?.anexoUrl) return;
    setBusy(true);
    setFeedback(null);
    try {
      await downloadAuthenticatedFile(item.anexoUrl, token, `recurso-${item.id}-anexo.pdf`);
    } catch (e) {
      if (isUnauthorizedError(e)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(e) });
    } finally { setBusy(false); }
  }

  if (pageStatus === "loading") return <LoadingState title="Carregando recurso" description="Consultando o recurso." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar" description={feedback?.text} />;
  if (!item) return <EmptyState title="Recurso nao encontrado" description="Recurso nao localizado." />;

  const isEtapa1 = item.fase === "ETAPA_1";
  const isEtapa2 = item.fase === "ETAPA_2";
  const isHomologacao = item.fase === "HOMOLOGACAO";
  const isIsencao = item.fase === "ISENCAO";
  const isPoliticas = item.fase === "POLITICAS_AFIRMATIVAS";
  const isClassificacao = item.fase === "CLASSIFICACAO";
  const recursoJaDecidido = item.status === "DEFERIDO" || item.status === "INDEFERIDO";
  const contextoPoliticasRecorridas = item.contextoPoliticasAfirmativas?.filter((etapa) => !item.tipoPoliticasAfirmativasReferencia || etapa.tipo === item.tipoPoliticasAfirmativasReferencia) ?? [];

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && <PageFeedback description={feedback.text} title="Retorno" type={feedback.type} />}

      <div className="admin-detail-header">
        <h1>Recurso — {getStatusLabel(item.fase)}</h1>
        <p>{item.candidato.nomeCompleto} &middot; Edital {item.edital.numero}{item.tipoPoliticasAfirmativasReferencia ? ` · ${item.tipoPoliticasAfirmativasReferencia === "PCD" ? "PCD" : "Heteroidentificacao"}` : ""}</p>
      </div>

      {isHomologacao ? (
        <PageFeedback
          type="info"
          title={`Recurso de homologacao ${item.faseHomologacaoReferencia?.toLowerCase() ?? ""}`}
          description={item.contextoHomologacao?.statusVigente ? `Estado homologatorio vigente: ${getStatusLabel(item.contextoHomologacao.statusVigente)}.` : "Sem contexto homologatorio vigente carregado."}
        />
      ) : null}

      {/* Impact warning */}
      {item.impactoResultado && (
        <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>Recurso com impacto no resultado</div>
            <div style={{ fontSize: 12, color: "#92400E" }}>O deferimento deste recurso disparara reprocessamento automatico da classificacao e republicacao das publicacoes derivadas.</div>
          </div>
        </div>
      )}

      {/* Fundamentacao readonly */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Fundamentacao do candidato</h2>
        <div style={{ background: "#F8FAFC", borderRadius: 6, border: "1px solid #F1F5F9", padding: 16, fontSize: 13, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {item.fundamentacao || "Sem fundamentacao registrada."}
        </div>
        {item.anexoUrl && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#2563EB", flexWrap: "wrap" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span>Anexo do candidato vinculado</span>
            <button type="button" onClick={handleDownloadAnexo} disabled={busy} style={{ border: "none", background: "none", color: "#2563EB", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              {busy ? "Baixando..." : "Baixar anexo"}
            </button>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "#64748B" }}>
          <span>Status: <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge></span>
          <span>Criado em: {formatIsoDate(item.criadoEm)}</span>
          {item.respondidoEm && <span>Respondido em: {formatIsoDate(item.respondidoEm)}</span>}
          {item.efeitoPraticoResumo && <span>Efeito pratico: {item.efeitoPraticoResumo}</span>}
        </div>
      </div>

      {/* Decisao form */}
      <form className="admin-form-card" onSubmit={onSubmit}>
        <h2 className="admin-form-card-title">Decisao administrativa</h2>
        {recursoJaDecidido ? <PageFeedback type="warning" title="Recurso ja decidido" description="Este recurso ja possui decisao final registrada. A tela permanece em modo somente leitura ate que exista um fluxo explicito de revisao." /> : null}
        <div className="admin-form-row">
          <div className="admin-eval-field">
            <label>Resultado *</label>
            <select disabled={recursoJaDecidido || busy} className="select-field" onChange={(e) => setDeferido(e.target.value === "DEFERIDO")} value={deferido ? "DEFERIDO" : "INDEFERIDO"}>
              <option value="DEFERIDO">Deferido</option>
              <option value="INDEFERIDO">Indeferido</option>
            </select>
          </div>
          <div className="admin-eval-field">
            <label>Impacto no resultado?</label>
            <select className="select-field" disabled={recursoJaDecidido || !deferido || isClassificacao} onChange={(e) => setImpactoResultado(e.target.value === "sim")} value={impactoResultado ? "sim" : "nao"}>
              <option value="nao">Nao</option>
              <option value="sim">Sim — reprocessar</option>
            </select>
          </div>
        </div>

        {isClassificacao ? (
          <PageFeedback type="warning" title="Classificacao" description="Esta tela ainda nao aceita mutacao direta do resultado de classificacao por recurso. O deferimento pode ser registrado sem impacto derivado automatico aqui." />
        ) : null}

        <div className="admin-eval-field">
          <label>Decisao *</label>
          <textarea disabled={recursoJaDecidido || busy} className="text-area" minLength={5} onChange={(e) => setDecisao(e.target.value)} placeholder="Recurso procedente. Documentacao..." required style={{ minHeight: 72 }} value={decisao} />
        </div>

        {deferido && impactoResultado && (
          <>
            {isIsencao ? (
              <div className="admin-eval-field">
                <label>Novo status da isencao</label>
                <select disabled={recursoJaDecidido || busy} className="select-field" onChange={(e) => setNovoStatusIsencao((e.target.value || "") as StatusIsencao | "")} value={novoStatusIsencao}>
                  <option value="">Nao alterar</option>
                  {statusIsencaoOptions.map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
                </select>
              </div>
            ) : null}
            {isHomologacao && (
              <div className="admin-eval-field">
                <label>Novo resultado da homologacao</label>
                <select disabled={recursoJaDecidido || busy} className="select-field" onChange={(e) => setNovoResultadoHomologacao((e.target.value || "") as "HOMOLOGADA" | "NAO_HOMOLOGADA" | "")} value={novoResultadoHomologacao}>
                  <option value="">Selecione</option>
                  <option value="HOMOLOGADA">Homologada</option>
                  <option value="NAO_HOMOLOGADA">Nao homologada</option>
                </select>
              </div>
            )}
            {isEtapa1 && (
              <div className="admin-form-row">
                <div className="admin-eval-field"><label>Nova nota etapa 1</label><input disabled={recursoJaDecidido || busy} max={10} min={0} onChange={(e) => setNovaNotaEtapa1(e.target.value)} step={0.1} type="number" value={novaNotaEtapa1} /></div>
                <div className="admin-eval-field"><label>Novo espelho etapa 1</label><textarea disabled={recursoJaDecidido || busy} className="text-area" onChange={(e) => setNovoEspelhoEtapa1(e.target.value)} style={{ minHeight: 60 }} value={novoEspelhoEtapa1} /></div>
              </div>
            )}
            {isEtapa2 && (
              <div className="admin-form-row">
                <div className="admin-eval-field"><label>Nova pontuacao bruta etapa 2</label><input disabled={recursoJaDecidido || busy} min={0} onChange={(e) => setNovaPontuacaoBrutaEtapa2(e.target.value)} step={0.1} type="number" value={novaPontuacaoBrutaEtapa2} /></div>
                <div className="admin-eval-field"><label>Novo espelho etapa 2</label><textarea disabled={recursoJaDecidido || busy} className="text-area" onChange={(e) => setNovoEspelhoEtapa2(e.target.value)} style={{ minHeight: 60 }} value={novoEspelhoEtapa2} /></div>
              </div>
            )}
            {isPoliticas ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {contextoPoliticasRecorridas.length ? contextoPoliticasRecorridas.map((etapa) => (
                  <div className="admin-form-row" key={etapa.tipo}>
                    <div className="admin-eval-field">
                      <label>Resultado {etapa.tipo === "PCD" ? "PCD" : "heteroidentificacao"}</label>
                      <select disabled={recursoJaDecidido || busy} className="select-field" onChange={(e) => setNovosResultadosPoliticas((current) => ({ ...current, [etapa.tipo]: { ...(current[etapa.tipo] ?? { resultado: "", parecer: "" }), resultado: (e.target.value || "") as (typeof resultadoPoliticasOptions)[number] | "" } }))} value={novosResultadosPoliticas[etapa.tipo]?.resultado ?? ""}>
                        <option value="">Selecione</option>
                        {resultadoPoliticasOptions.filter((v) => v !== "PENDENTE").map((v) => <option key={v} value={v}>{getStatusLabel(v)}</option>)}
                      </select>
                    </div>
                    <div className="admin-eval-field">
                      <label>Parecer {etapa.tipo === "PCD" ? "PCD" : "heteroidentificacao"}</label>
                      <textarea disabled={recursoJaDecidido || busy} className="text-area" onChange={(e) => setNovosResultadosPoliticas((current) => ({ ...current, [etapa.tipo]: { ...(current[etapa.tipo] ?? { resultado: "", parecer: "" }), parecer: e.target.value } }))} style={{ minHeight: 60 }} value={novosResultadosPoliticas[etapa.tipo]?.parecer ?? ""} />
                    </div>
                  </div>
                )) : <PageFeedback type="warning" title="Etapas de politicas nao encontradas" description="O recurso esta vinculado a politicas afirmativas, mas nenhuma etapa ativa foi carregada para a inscricao." />}
              </div>
            ) : null}
          </>
        )}

        <button className="admin-page-cta" disabled={busy || recursoJaDecidido} style={{ width: 200 }} type="submit">
          Registrar decisao
        </button>
      </form>
    </div>
  );
}
