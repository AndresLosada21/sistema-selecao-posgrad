"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useSession } from "@/lib/auth/session-provider";
import { getFilenameFromDispositionHeader, triggerBrowserDownload } from "@/lib/files/download";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { formatIsoDate } from "@/modules/edital/formatters";

import {
  atualizarConfirmacaoReserva,
  baixarAnexoIvAdmin,
  baixarAnexoIvFlattenAdmin,
  getPacoteDocumentalAdmin,
  listFundamentosHomologacao,
  listInscricoesParaHomologacao,
  registrarHomologacaoFinal,
  registrarHomologacaoPreliminar,
} from "@/modules/admin-homologacao/api";
import type { AdminInscricaoHomologacao, HomologacaoFundamento } from "@/modules/admin-homologacao/types";

type AdminHomologacaoDetailProps = {
  params: Promise<{ inscricaoId: string }>;
};

const confirmacaoReservaOptions = ["PENDENTE", "CONFIRMADA", "NAO_CONFIRMADA", "NAO_SE_APLICA"] as const;

export default function AdminHomologacaoDetailPage({ params }: AdminHomologacaoDetailProps) {
  const session = useSession();
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [item, setItem] = useState<AdminInscricaoHomologacao | null>(null);
  const [fundamentos, setFundamentos] = useState<HomologacaoFundamento[]>([]);
  const [message, setMessage] = useState<{ title: string; description: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [preliminarParecer, setPreliminarParecer] = useState("");
  const [finalParecer, setFinalParecer] = useState("");
  const [preliminarHomologada, setPreliminarHomologada] = useState(true);
  const [finalHomologada, setFinalHomologada] = useState(true);
  const [selectedMotivoCodigo, setSelectedMotivoCodigo] = useState("");
  const [motivosPreliminar, setMotivosPreliminar] = useState<HomologacaoFundamento[]>([]);
  const [motivosFinal, setMotivosFinal] = useState<HomologacaoFundamento[]>([]);
  const [confirmacaoAcoesAfirmativas, setConfirmacaoAcoesAfirmativas] = useState<string>(confirmacaoReservaOptions[0]);
  const [confirmacaoPcd, setConfirmacaoPcd] = useState<string>(confirmacaoReservaOptions[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    params.then((resolved) => setInscricaoId(resolved.inscricaoId));
  }, [params]);

  useEffect(() => {
    if (!session.token || !inscricaoId) {
      return;
    }

    Promise.all([listInscricoesParaHomologacao(session.token), listFundamentosHomologacao(session.token)])
      .then(([inscricoes, fundamentosResponse]) => {
        const found = inscricoes.items.find((entry) => entry.id === inscricaoId) ?? null;
        setItem(found);
        setFundamentos(fundamentosResponse.items);
        setSelectedMotivoCodigo(fundamentosResponse.items[0]?.codigo ?? "");
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          session.signOut();
          return;
        }

        setMessage({ title: "Falha ao carregar inscricao", description: getErrorMessage(error) });
        setStatus("error");
      });
  }, [inscricaoId, session]);

  useEffect(() => {
    if (!item) {
      return;
    }

    setConfirmacaoAcoesAfirmativas(item.confirmacaoAcoesAfirmativas);
    setConfirmacaoPcd(item.confirmacaoPcd);
    setPreliminarParecer(item.homologacao?.parecerPreliminar ?? "");
    setFinalParecer(item.homologacao?.parecerFinal ?? "");
    setMotivosPreliminar(item.homologacao?.motivosPreliminar ?? []);
    setMotivosFinal(item.homologacao?.motivosFinal ?? []);
  }, [item]);

  const selectedFundamento = useMemo(
    () => fundamentos.find((fundamento) => fundamento.codigo === selectedMotivoCodigo) ?? null,
    [fundamentos, selectedMotivoCodigo],
  );

  function handleUnauthorized(error: unknown) {
    if (isUnauthorizedError(error)) {
      session.signOut();
      return true;
    }

    return false;
  }

  function addMotivo(target: "preliminar" | "final") {
    if (!selectedFundamento) {
      return;
    }

    if (target === "preliminar") {
      setMotivosPreliminar((current) => (current.some((item) => item.codigo === selectedFundamento.codigo) ? current : [...current, selectedFundamento]));
      return;
    }

    setMotivosFinal((current) => (current.some((item) => item.codigo === selectedFundamento.codigo) ? current : [...current, selectedFundamento]));
  }

  async function handleDownload(kind: "formulario" | "flatten") {
    if (!session.token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result =
        kind === "formulario"
          ? await baixarAnexoIvAdmin(item.id, session.token)
          : await baixarAnexoIvFlattenAdmin(item.id, session.token);

      triggerBrowserDownload(result.blob, getFilenameFromDispositionHeader(result.disposition, kind === "formulario" ? "anexo-iv.pdf" : "anexo-iv-flatten.pdf"));
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha ao baixar Anexo IV", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handlePacote() {
    if (!session.token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const pacote = await getPacoteDocumentalAdmin(item.id, session.token);
      setMessage({
        title: "Pacote documental carregado",
        description: `Arquivo: ${pacote.pacoteDocumental.nomeArquivo ?? "sem nome"} · Gerado em: ${formatIsoDate(pacote.pacoteDocumental.geradoEm)}`,
      });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha ao carregar pacote documental", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handlePreliminar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session.token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await registrarHomologacaoPreliminar(item.id, {
        homologada: preliminarHomologada,
        parecer: preliminarParecer,
        motivos: motivosPreliminar,
      }, session.token);

      setMessage({ title: "Homologacao preliminar registrada", description: "O parecer preliminar foi aceito pelo backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha na homologacao preliminar", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleFinal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session.token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await registrarHomologacaoFinal(item.id, {
        homologada: finalHomologada,
        parecer: finalParecer,
        motivos: motivosFinal,
      }, session.token);

      setMessage({ title: "Homologacao final registrada", description: "O parecer final foi aceito pelo backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha na homologacao final", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmacaoReserva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session.token || !item) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await atualizarConfirmacaoReserva(item.id, {
        confirmacaoAcoesAfirmativas,
        confirmacaoPcd,
      }, session.token);

      setMessage({ title: "Confirmacao de reserva atualizada", description: "A confirmacao operacional foi enviada ao backend." });
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      setMessage({ title: "Falha na confirmacao de reserva", description: getErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <LoadingState title="Carregando detalhe de homologacao" description="Consultando a inscricao, os documentos e os fundamentos operacionais." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar detalhe" description={message?.description} />;
  }

  if (!item) {
    return <EmptyState title="Inscricao nao encontrada" description="Nao foi encontrada inscricao correspondente para a fila de homologacao." />;
  }

  return (
    <div className="stack-layout">
      <SectionCard title={`Homologacao de ${item.candidato.nomeCompleto}`} description={`Edital ${item.edital.numero} · ${item.edital.titulo}`}>
        <div className="content-list">
          <small>E-mail do candidato: {item.candidato.email}</small>
          <small>Modalidade: {item.modalidadeConcorrencia}</small>
          <small>Status da inscricao: {item.status}</small>
          <small>Status do pagamento: {item.statusPagamento}</small>
          <small>Submetida em: {formatIsoDate(item.submetidaEm)}</small>
          <small>Linha: {item.linhaPesquisa?.nome ?? "nao definida"}</small>
          <div className="content-item-links">
            <button className="secondary-button" disabled={busy} onClick={() => handleDownload("formulario")} type="button">
              Baixar Anexo IV formulario
            </button>
            <button className="secondary-button" disabled={busy} onClick={() => handleDownload("flatten")} type="button">
              Baixar Anexo IV flattened
            </button>
            <button className="secondary-button" disabled={busy} onClick={handlePacote} type="button">
              Ler pacote documental
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Documentos apresentados" description="Leitura dos documentos e de seus metadados de validacao no contexto admin.">
        <div className="content-list">
          {item.documentos.map((documento) => (
            <article className="content-item" key={documento.id}>
              <div className="content-item-row">
                <strong>{documento.tipo}</strong>
                <StatusBadge>{documento.statusValidacao ?? "SEM_VALIDACAO"}</StatusBadge>
              </div>
              <small>Nome: {documento.nome}</small>
              <small>Arquivo: {documento.nomeArquivo ?? "nao informado"}</small>
              <small>Obrigatorio: {documento.obrigatorio ? "sim" : "nao"}</small>
              <small>Observacao: {documento.observacaoValidacao ?? "sem observacao"}</small>
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Fundamentos disponiveis" description="Catalogo de fundamentos fornecido pelo backend para composicao dos pareceres.">
        <div className="field-block">
          <span>Fundamento selecionado</span>
          <select className="select-field" onChange={(event) => setSelectedMotivoCodigo(event.target.value)} value={selectedMotivoCodigo}>
            {fundamentos.map((fundamento) => (
              <option key={fundamento.codigo} value={fundamento.codigo}>
                {fundamento.codigo} · {fundamento.titulo}
              </option>
            ))}
          </select>
          <div className="content-item-links">
            <button className="secondary-button" onClick={() => addMotivo("preliminar")} type="button">
              Adicionar na preliminar
            </button>
            <button className="secondary-button" onClick={() => addMotivo("final")} type="button">
              Adicionar na final
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Homologacao preliminar" description="Registro do parecer preliminar e dos motivos objetivos quando houver indeferimento.">
        <form className="form-grid" onSubmit={handlePreliminar}>
          <label className="field-inline">
            <input checked={preliminarHomologada} onChange={(event) => setPreliminarHomologada(event.target.checked)} type="checkbox" />
            <span>Homologada na preliminar</span>
          </label>
          <label className="field-block">
            <span>Parecer preliminar</span>
            <textarea className="text-area" onChange={(event) => setPreliminarParecer(event.target.value)} value={preliminarParecer} />
          </label>
          <div className="content-list">
            {motivosPreliminar.map((motivo) => (
              <article className="content-item" key={`pre-${motivo.codigo}`}>
                <strong>{motivo.codigo}</strong>
                <small>{motivo.titulo}</small>
                <small>{motivo.itemEdital}</small>
              </article>
            ))}
          </div>
          <button className="action-button" disabled={busy} type="submit">
            Registrar preliminar
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Confirmacao operacional de reserva" description="Atualizacao do estado operacional das reservas por inscricao.">
        <form className="form-grid" onSubmit={handleConfirmacaoReserva}>
          <label className="field-block">
            <span>Acoes afirmativas</span>
            <select className="select-field" onChange={(event) => setConfirmacaoAcoesAfirmativas(event.target.value)} value={confirmacaoAcoesAfirmativas}>
              {confirmacaoReservaOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span>PCD</span>
            <select className="select-field" onChange={(event) => setConfirmacaoPcd(event.target.value)} value={confirmacaoPcd}>
              {confirmacaoReservaOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" disabled={busy} type="submit">
            Atualizar confirmacao
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Homologacao final" description="Registro do parecer final da inscricao com base na situacao consolidada.">
        <form className="form-grid" onSubmit={handleFinal}>
          <label className="field-inline">
            <input checked={finalHomologada} onChange={(event) => setFinalHomologada(event.target.checked)} type="checkbox" />
            <span>Homologada no resultado final</span>
          </label>
          <label className="field-block">
            <span>Parecer final</span>
            <textarea className="text-area" onChange={(event) => setFinalParecer(event.target.value)} value={finalParecer} />
          </label>
          <div className="content-list">
            {motivosFinal.map((motivo) => (
              <article className="content-item" key={`final-${motivo.codigo}`}>
                <strong>{motivo.codigo}</strong>
                <small>{motivo.titulo}</small>
                <small>{motivo.itemEdital}</small>
              </article>
            ))}
          </div>
          <button className="action-button" disabled={busy} type="submit">
            Registrar final
          </button>
        </form>
      </SectionCard>

      {message ? <ErrorState title={message.title} description={message.description} /> : null}
    </div>
  );
}
