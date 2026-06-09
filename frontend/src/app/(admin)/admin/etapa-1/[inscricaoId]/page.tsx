"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
import { getEspelhoEtapa1, getEtapa1Item, liberarEspelhoEtapa1, registrarEtapa1 } from "@/modules/admin-etapas/api";
import type { Etapa1AdminItem, Etapa1Espelho } from "@/modules/admin-etapas/types";

type Props = { params: Promise<{ inscricaoId: string }> };

const CRITERIOS = [
  { key: "adequacaoDominioTema", label: "Adequação e domínio do tema", peso: 50 },
  { key: "estrutura", label: "Estrutura", peso: 10 },
  { key: "organizacaoCoerencia", label: "Organização textual e coerência", peso: 15 },
  { key: "objetividadeSintese", label: "Objetividade e capacidade de síntese", peso: 15 },
  { key: "grafiaGramatica", label: "Grafia, acentuação e gramática", peso: 10 },
] as const;

type CriterioKey = (typeof CRITERIOS)[number]["key"];

type RubricaSnapshot = {
  criterios?: Partial<Record<CriterioKey, { notaAtribuida?: number; contribuicao?: number; observacao?: string | null }>>;
  observacoes?: Partial<Record<CriterioKey | "geral", string | null>> | null;
  notaFinal?: number;
  notaCalculadaSemPenalidadeIa?: number;
  usoIaComprovado?: boolean;
  fundamentoUsoIa?: string | null;
};

function normalizeObs(obs: Record<CriterioKey | "geral", string>) {
  return Object.fromEntries(Object.entries(obs).filter(([, v]) => v.trim().length >= 3));
}

export default function AdminEtapa1DetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<Etapa1AdminItem | null>(null);
  const [espelho, setEspelho] = useState<Etapa1Espelho | null>(null);

  const [rubrica, setRubrica] = useState<Record<CriterioKey, number>>({
    adequacaoDominioTema: 0, estrutura: 0, organizacaoCoerencia: 0, objetividadeSintese: 0, grafiaGramatica: 0,
  });
  const [observacoes, setObservacoes] = useState<Record<CriterioKey | "geral", string>>({
    adequacaoDominioTema: "", estrutura: "", organizacaoCoerencia: "", objetividadeSintese: "", grafiaGramatica: "", geral: "",
  });
  const [tema, setTema] = useState("");
  const [espelhoCorrecao, setEspelhoCorrecao] = useState("");
  const [fundamentoUsoIa, setFundamentoUsoIa] = useState("");
  const [publicacao, setPublicacao] = useState<"PRELIMINAR" | "FINAL">("PRELIMINAR");
  const [usoIaComprovado, setUsoIaComprovado] = useState(false);
  const [confirmLiberarEspelho, setConfirmLiberarEspelho] = useState(false);

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
    const found = await getEtapa1Item(inscricaoId, token);
    setItem(found);
    const rubricaSalva = (found?.avaliacao?.rubricaDetalhada as RubricaSnapshot | null) ?? null;
    const criterios = rubricaSalva?.criterios;
    const observacoesSalvas = rubricaSalva?.observacoes;

    setRubrica({
      adequacaoDominioTema: criterios?.adequacaoDominioTema?.notaAtribuida ?? 0,
      estrutura: criterios?.estrutura?.notaAtribuida ?? 0,
      organizacaoCoerencia: criterios?.organizacaoCoerencia?.notaAtribuida ?? 0,
      objetividadeSintese: criterios?.objetividadeSintese?.notaAtribuida ?? 0,
      grafiaGramatica: criterios?.grafiaGramatica?.notaAtribuida ?? 0,
    });
    setObservacoes({
      adequacaoDominioTema: observacoesSalvas?.adequacaoDominioTema ?? criterios?.adequacaoDominioTema?.observacao ?? "",
      estrutura: observacoesSalvas?.estrutura ?? criterios?.estrutura?.observacao ?? "",
      organizacaoCoerencia: observacoesSalvas?.organizacaoCoerencia ?? criterios?.organizacaoCoerencia?.observacao ?? "",
      objetividadeSintese: observacoesSalvas?.objetividadeSintese ?? criterios?.objetividadeSintese?.observacao ?? "",
      grafiaGramatica: observacoesSalvas?.grafiaGramatica ?? criterios?.grafiaGramatica?.observacao ?? "",
      geral: observacoesSalvas?.geral ?? "",
    });
    setTema(found?.avaliacao?.tema ?? found?.temaRedacao ?? "");
    setEspelhoCorrecao(found?.avaliacao?.espelhoCorrecao ?? "");
    setUsoIaComprovado(rubricaSalva?.usoIaComprovado ?? found?.avaliacao?.usoIaComprovado ?? false);
    setFundamentoUsoIa(rubricaSalva?.fundamentoUsoIa ?? found?.avaliacao?.fundamentoUsoIa ?? "");
    setPublicacao(found?.avaliacao?.status === "FINAL_PUBLICADA" ? "FINAL" : "PRELIMINAR");
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

  const notaPreview = useMemo(() => {
    let total = 0;
    for (const c of CRITERIOS) total += rubrica[c.key] * (c.peso / 100);
    return total;
  }, [rubrica]);

  const redacaoText = useMemo(() => {
    return item?.avaliacao?.textoSubmetido ?? item?.redacaoTexto ?? null;
  }, [item]);

  const charCount = redacaoText?.length ?? 0;

  async function loadEspelho() {
    if (!token || !inscricaoId) return;
    try {
      const r = await getEspelhoEtapa1(inscricaoId, token);
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
      if (notaPreview < 0 || notaPreview > 10) {
        setFeedback({ type: "warning", text: "A nota calculada da rubrica deve ficar entre 0 e 10." });
        return;
      }
      await registrarEtapa1(inscricaoId, {
        tema: tema || item?.temaRedacao || undefined,
        rubrica: { ...rubrica, observacoes: normalizeObs(observacoes) },
        usoIaComprovado,
        fundamentoUsoIa: usoIaComprovado ? fundamentoUsoIa : undefined,
        espelhoCorrecao,
        liberarEspelho: publicacao === "FINAL",
        publicacao,
      }, token);
      await loadItem();
      if (espelho) {
        await loadEspelho();
      }
      setFeedback({ type: "success", text: "Resultado da etapa 1 salvo." });
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFieldErrors(pickFirstFieldErrors(error, ["tema", "rubrica", "fundamentoUsoIa", "espelhoCorrecao", "publicacao"] as const));
      setFeedback({ type: "error", text: getFirstFormError(error) ?? getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  async function onLiberarEspelho() {
    if (!token || !inscricaoId) return;
    setBusy(true);
    setFeedback(null);
    try {
      await liberarEspelhoEtapa1(inscricaoId, token);
      await loadItem();
      setConfirmLiberarEspelho(false);
      setFeedback({ type: "success", text: "Espelho da etapa 1 liberado." });
      await loadEspelho();
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally { setBusy(false); }
  }

  if (pageStatus === "loading") return <LoadingState title="Carregando detalhe" description="Consultando a inscricao." />;
  if (pageStatus === "error") return <ErrorState title="Falha ao carregar" description={feedback?.text} />;
  if (!item) return <EmptyState title="Inscricao nao encontrada" description="Inscricao nao localizada na fila da etapa 1." />;

  const espelhoLiberado = !!item.avaliacao?.espelhoLiberadoEm;
  const avaliacaoStatus = item.avaliacao?.status ?? "SEM_AVALIACAO";
  const rubricaSnapshot = (item.avaliacao?.rubricaDetalhada as RubricaSnapshot | null) ?? null;
  const notaPersistida = item.avaliacao?.nota ?? rubricaSnapshot?.notaFinal ?? null;
  const editState = item.edicao;
  const podeSalvarResultado = publicacao === "FINAL" ? (editState?.podeSalvarFinal ?? true) : (editState?.podeSalvarPreliminar ?? true);
  const bloqueioResultado = publicacao === "FINAL" ? editState?.bloqueioSalvarFinal : editState?.bloqueioSalvarPreliminar;
  const podeAlternarPublicacao = Boolean(editState?.podeSalvarPreliminar || editState?.podeSalvarFinal);

  return (
    <div className="admin-main-inner" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback && <PageFeedback description={feedback.text} title={feedback.type === "success" ? "Etapa 1 atualizada" : feedback.type === "warning" ? "Atenção na etapa 1" : "Não foi possível salvar a etapa 1"} type={feedback.type} />}

      <AdminBreadcrumb items={[{ label: "Etapa 1", href: "/admin/etapa-1" }, { label: item.edital.numero }, { label: item.candidato.nomeCompleto }]} />

      {/* Header */}
      <div className="admin-detail-header">
        <h1>Etapa 1 — {item.candidato.nomeCompleto}</h1>
        <p>Edital {item.edital.numero} &middot; Avaliacao da redacao</p>
      </div>

      <div className="admin-summary-cards">
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Status da inscricao</span>
          <StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Status da avaliacao</span>
          <StatusBadge variant={getStatusVariant(avaliacaoStatus)}>{getStatusLabel(avaliacaoStatus)}</StatusBadge>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Nota registrada</span>
          <span className="admin-summary-card-value admin-summary-card-value--primary">{notaPersistida?.toFixed?.(2) ?? "—"}</span>
        </div>
        <div className="admin-summary-card">
          <span className="admin-summary-card-label">Espelho</span>
          <span style={{ fontSize: 13, color: "#475569" }}>{espelhoLiberado ? `Liberado em ${formatIsoDate(item.avaliacao?.espelhoLiberadoEm ?? null)}` : "Não liberado"}</span>
        </div>
      </div>

      {usoIaComprovado ? (
        <PageFeedback
          type="warning"
          title="Uso de IA marcado como comprovado"
          description="Conforme a regra da etapa 1, a nota final sera zerada enquanto esse marcador estiver ativo. Informe o fundamento no campo proprio antes de salvar."
        />
      ) : null}

      {!podeSalvarResultado && bloqueioResultado ? (
        <PageFeedback type="warning" title="Resultado bloqueado" description={bloqueioResultado} />
      ) : null}

      <div className="admin-etapa1-workbench">
        <div className="admin-form-card admin-etapa1-redacao-card">
          <h2 className="admin-form-card-title">Redacao do candidato</h2>
          <div className="admin-redacao-meta">
            <span>Tema: {tema || item.avaliacao?.tema || item.temaRedacao || "nao informado"}</span>
            <span className="admin-char-badge">{charCount} caracteres</span>
          </div>
          <div className="admin-redacao-box">
            {redacaoText ?? "Redacao nao disponivel."}
          </div>
        </div>

      {/* Rubrica e nota */}
      <form className="admin-form-card admin-etapa1-form-card" onSubmit={onSubmit}>
          <h2 className="admin-form-card-title">Rubrica e nota</h2>
          {fieldErrors.rubrica ? <PageFeedback type="error" title="Rubrica incompleta" description={fieldErrors.rubrica} /> : null}

        <div className="admin-eval-row">
          <div className="admin-eval-field">
            <label>Nota final *</label>
            <div className="eval-display">{notaPreview.toFixed(2)}</div>
          </div>
          <div className="admin-eval-field">
            <label>Uso de IA comprovado?</label>
            <select
              disabled={!podeSalvarResultado || busy}
              className="select-field"
              onChange={(e) => setUsoIaComprovado(e.target.value === "sim")}
              value={usoIaComprovado ? "sim" : "nao"}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
          <div className="admin-eval-field">
            <label>Espelho</label>
            <div className="admin-espelho-info">
              <StatusBadge variant={espelhoLiberado ? "success" : "warning"}>
                {espelhoLiberado ? "Liberado" : "Não liberado"}
              </StatusBadge>
            </div>
          </div>
        </div>

        {usoIaComprovado && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Fundamento do uso de IA</label>
            <textarea aria-invalid={!!fieldErrors.fundamentoUsoIa} disabled={!podeSalvarResultado || busy} className="text-area" onChange={(e) => { setFundamentoUsoIa(e.target.value); setFieldErrors((current) => ({ ...current, fundamentoUsoIa: null })); }} value={fundamentoUsoIa} />
            {fieldErrors.fundamentoUsoIa ? <span className="field-error-text">{fieldErrors.fundamentoUsoIa}</span> : null}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Tema base da avaliacao</label>
          <div style={{ minHeight: 44, borderRadius: 8, border: "1px solid #C7D2FE", background: "#EEF2FF", padding: "11px 14px", fontSize: 14, fontWeight: 600, color: "#312E81" }}>
            {tema || item.temaRedacao || "Tema nao informado na inscricao."}
          </div>
          <span style={{ fontSize: 12, color: "#64748B" }}>Tema escolhido na inscricao e usado como referencia principal da correcao.</span>
        </div>

        {/* Rubrica inputs per criterio */}
        {CRITERIOS.map((c) => (
          <div className="admin-form-row" key={c.key}>
            <div className="admin-eval-field" style={{ flex: 2 }}>
              <label>{c.label} ({c.peso}%)</label>
              <input
                disabled={!podeSalvarResultado || busy}
                max={10}
                min={0}
                onChange={(e) => setRubrica((prev) => ({ ...prev, [c.key]: Number(e.target.value) || 0 }))}
                step={0.1}
                type="number"
                value={rubrica[c.key]}
              />
            </div>
            <div className="admin-eval-field" style={{ flex: 3 }}>
              <label>Observacao</label>
              <input
                disabled={!podeSalvarResultado || busy}
                onChange={(e) => setObservacoes((prev) => ({ ...prev, [c.key]: e.target.value }))}
                placeholder="Opcional"
                value={observacoes[c.key]}
              />
            </div>
          </div>
        ))}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Observação geral</label>
          <textarea disabled={!podeSalvarResultado || busy} className="text-area" onChange={(e) => setObservacoes((prev) => ({ ...prev, geral: e.target.value }))} value={observacoes.geral} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>Espelho de correção</label>
          <textarea aria-invalid={!!fieldErrors.espelhoCorrecao} aria-label="Espelho de correção" disabled={!podeSalvarResultado || busy} className="text-area" onChange={(e) => { setEspelhoCorrecao(e.target.value); setFieldErrors((current) => ({ ...current, espelhoCorrecao: null })); }} value={espelhoCorrecao} />
          {fieldErrors.espelhoCorrecao ? <span className="field-error-text">{fieldErrors.espelhoCorrecao}</span> : null}
        </div>

        <div className="admin-form-row">
          <div className="admin-eval-field">
            <label>Publicação</label>
            <select aria-invalid={!!fieldErrors.publicacao} className="select-field" disabled={!podeAlternarPublicacao || busy} onChange={(e) => { setPublicacao(e.target.value as "PRELIMINAR" | "FINAL"); setFieldErrors((current) => ({ ...current, publicacao: null })); }} value={publicacao}>
              <option value="PRELIMINAR">Preliminar</option>
              <option value="FINAL">Final</option>
            </select>
            {fieldErrors.publicacao ? <span className="field-error-text">{fieldErrors.publicacao}</span> : null}
          </div>
          <div className="admin-eval-field" style={{ justifyContent: "flex-end" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>{publicacao === "FINAL" ? "Resultado final libera o espelho automaticamente." : "Para resultado preliminar, use a ação confirmada de liberação abaixo."}</span>
          </div>
        </div>

        <button className="admin-page-cta" disabled={busy || !podeSalvarResultado} style={{ width: 200 }} type="submit">
          Salvar avaliação
        </button>
      </form>
      </div>

      {/* Criterios da rubrica (readonly preview table) */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Critérios da rubrica</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Distribuição de notas por critério de avaliação.</p>

        <table className="admin-rubrica-table">
          <caption className="sr-only">Rubrica de correção da etapa 1</caption>
          <thead>
            <tr>
              <th scope="col">Criterio</th>
              <th scope="col" style={{ width: 80 }}>Peso</th>
              <th scope="col" style={{ width: 80 }}>Nota</th>
              <th scope="col" style={{ width: 100 }}>Contribuicao</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIOS.map((c) => {
              const nota = rubrica[c.key];
              const contrib = nota * (c.peso / 100);
              return (
                <tr key={c.key}>
                  <td style={{ fontWeight: 500, color: "#1E293B" }}>{c.label}</td>
                  <td className="rubrica-peso">{c.peso}%</td>
                  <td className="rubrica-nota">{nota.toFixed(1)}</td>
                  <td className="rubrica-contribuicao">{contrib.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td>100%</td>
              <td style={{ color: "#94A3B8" }}>—</td>
              <td className="rubrica-total-valor">{notaPreview.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Espelho section */}
      <div className="admin-form-card">
        <h2 className="admin-form-card-title">Espelho da avaliacao</h2>
        <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Gerencie a liberacao do espelho de avaliacao para o candidato.</p>

        <div className="admin-espelho-row">
          <div className="admin-espelho-status">
            <label>Status do espelho</label>
            <div className="admin-espelho-info">
              <StatusBadge variant={espelhoLiberado ? "success" : "warning"}>
                {espelhoLiberado ? "Liberado" : "Não liberado"}
              </StatusBadge>
              <span>{espelhoLiberado ? `Liberado em ${formatIsoDate(item.avaliacao?.espelhoLiberadoEm ?? null)}` : "O candidato ainda nao pode visualizar o espelho."}</span>
            </div>
          </div>
          {espelhoLiberado ? (
            <button className="admin-btn-disabled" disabled type="button">Ja liberado</button>
          ) : (
            <button className="admin-page-cta" disabled={busy || !(editState?.podeLiberarEspelho ?? true)} onClick={() => setConfirmLiberarEspelho(true)} type="button">
              Liberar espelho
            </button>
          )}
        </div>
        {!(editState?.podeLiberarEspelho ?? true) && editState?.bloqueioLiberarEspelho ? (
          <PageFeedback type="warning" title="Liberacao do espelho bloqueada" description={editState.bloqueioLiberarEspelho} />
        ) : null}

        {espelho && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16, background: "#F8FAFC", borderRadius: 6 }}>
            <small><strong>Tema:</strong> {espelho.tema ?? "—"}</small>
              <small><strong>Espelho de correção:</strong> {espelho.espelhoCorrecao ?? "—"}</small>
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
      <ConfirmModal
        confirmLabel="Liberar espelho"
        description="Esta acao torna o espelho da etapa 1 visivel ao candidato. Confirme apenas se o conteudo e o candidato estao corretos."
        details={[`Candidato: ${item.candidato.nomeCompleto}`, `Inscricao: ${item.id}`, "Fase: Etapa 1"]}
        disabled={busy}
        onCancel={() => setConfirmLiberarEspelho(false)}
        onConfirm={onLiberarEspelho}
        open={confirmLiberarEspelho}
        title="Confirmar liberacao de espelho"
      />
    </div>
  );
}
