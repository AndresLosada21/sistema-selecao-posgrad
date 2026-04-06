"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

import { ActionButton } from "@/components/shared/action-button";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { SectionCard } from "@/components/shared/section-card";
import { getStatusLabel, getStatusVariant } from "@/components/shared/status-variant-map";
import { StatusBadge } from "@/components/shared/status-badge";
import { downloadAuthenticatedFile } from "@/lib/files/download";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { decidirIsencaoFinalAdmin, decidirIsencaoPreliminarAdmin, getAdminIsencaoById } from "@/modules/admin-isencao/api";
import type { AdminIsencaoItem } from "@/modules/admin-isencao/types";
import { formatIsoDate } from "@/modules/edital/formatters";

type Props = { params: Promise<{ pedidoIsencaoId: string }> };

export default function AdminIsencaoDetailPage({ params }: Props) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminIsencaoItem | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingComprovante, setDownloadingComprovante] = useState(false);
  const [preliminar, setPreliminar] = useState({ deferida: true, parecer: "" });
  const [finalDecision, setFinalDecision] = useState({ deferida: true, parecer: "" });

  useEffect(() => { params.then((resolved) => setPedidoId(resolved.pedidoIsencaoId)); }, [params]);

  const load = useCallback(async () => {
    if (!token || !pedidoId) return;
    const response = await getAdminIsencaoById(pedidoId, token);
    setItem(response);
    setPreliminar((current) => ({ ...current, parecer: response.parecerPreliminar ?? current.parecer }));
    setFinalDecision((current) => ({ ...current, parecer: response.parecerFinal ?? current.parecer }));
  }, [pedidoId, token]);

  useEffect(() => {
    if (!token || !pedidoId) return;
    load().then(() => setStatus("ready")).catch((error) => {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
      setStatus("error");
    });
  }, [load, pedidoId, signOut, token]);

  async function handlePreliminar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !pedidoId) return;
    setBusy(true); setMessage(null);
    try { await decidirIsencaoPreliminarAdmin(pedidoId, preliminar, token); await load(); setMessage({ type: "success", text: "Decisao preliminar registrada." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleFinal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !pedidoId) return;
    setBusy(true); setMessage(null);
    try { await decidirIsencaoFinalAdmin(pedidoId, finalDecision, token); await load(); setMessage({ type: "success", text: "Decisao final registrada." }); }
    catch (error) { if (isUnauthorizedError(error)) { signOut(); return; } setMessage({ type: "error", text: getErrorMessage(error) }); }
    finally { setBusy(false); }
  }

  async function handleDownloadComprovante() {
    if (!token || !item?.comprovanteUrl) return;
    setDownloadingComprovante(true);
    try {
      await downloadAuthenticatedFile(item.comprovanteUrl, token, item.comprovanteNomeArquivo ?? "comprovante.pdf");
    } catch (error) {
      if (isUnauthorizedError(error)) { signOut(); return; }
      setMessage({ type: "error", text: getErrorMessage(error) });
    } finally { setDownloadingComprovante(false); }
  }

  if (status === "loading") return <LoadingState title="Carregando pedido de isencao" description="Consultando o detalhe administrativo do pedido." />;
  if (status === "error") return <ErrorState title="Falha ao carregar pedido" description={message?.text} />;
  if (!item) return <EmptyState title="Pedido indisponivel" description="O pedido de isencao nao foi encontrado." />;

  return (
    <div className="stack-layout">
      {message ? <PageFeedback type={message.type} title="Retorno operacional" description={message.text} /> : null}
      <SectionCard title={`Isencao de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
        <div className="content-list">
          <div className="content-item-row"><small>Status</small><StatusBadge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</StatusBadge></div>
          <small>E-mail: {item.candidato.email}</small>
          <small>Curso: {getStatusLabel(item.cursoNivel)}</small>
          <small>CadUnico: {item.inscritoCadUnico ? "sim" : "nao"}</small>
          <small>NIS: {item.nis ?? "nao informado"}</small>
          <small>Criado em: {formatIsoDate(item.criadoEm)}</small>
          <small>Atualizado em: {formatIsoDate(item.atualizadoEm)}</small>
          <small>Justificativa: {item.justificativa ?? "nao informada"}</small>
          {item.comprovanteUrl ? <div className="content-item-links"><ActionButton disabled={downloadingComprovante} onClick={handleDownloadComprovante} size="sm" type="button" variant="secondary">{downloadingComprovante ? "Baixando..." : "Baixar comprovante"}</ActionButton></div> : null}
        </div>
      </SectionCard>

      <SectionCard title="Decisao preliminar" description="Registre o parecer preliminar do pedido de isencao.">
        <form className="form-grid" onSubmit={handlePreliminar}>
          <label className="field-inline"><input checked={preliminar.deferida} onChange={(e) => setPreliminar((c) => ({ ...c, deferida: e.target.checked }))} type="checkbox" /><span>Deferida na preliminar</span></label>
          <label className="field-block"><span>Parecer preliminar</span><textarea className="text-area" onChange={(e) => setPreliminar((c) => ({ ...c, parecer: e.target.value }))} value={preliminar.parecer} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Registrar preliminar</ActionButton>
        </form>
      </SectionCard>

      <SectionCard title="Decisao final" description="Registre o parecer final do pedido de isencao.">
        <form className="form-grid" onSubmit={handleFinal}>
          <label className="field-inline"><input checked={finalDecision.deferida} onChange={(e) => setFinalDecision((c) => ({ ...c, deferida: e.target.checked }))} type="checkbox" /><span>Deferida no resultado final</span></label>
          <label className="field-block"><span>Parecer final</span><textarea className="text-area" onChange={(e) => setFinalDecision((c) => ({ ...c, parecer: e.target.value }))} value={finalDecision.parecer} /></label>
          <ActionButton disabled={busy} loading={busy} type="submit">Registrar final</ActionButton>
        </form>
      </SectionCard>
    </div>
  );
}
