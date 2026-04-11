"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { getEditalById } from "@/modules/edital/api";
import type { EditalDetalhe } from "@/modules/edital/types";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { InscricaoEditor } from "@/modules/inscricao/components/inscricao-editor";

type CandidateInscricaoPageProps = {
  params: Promise<{ editalId: string }>;
};

export default function CandidateInscricaoPage({ params }: CandidateInscricaoPageProps) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [edital, setEdital] = useState<EditalDetalhe | null>(null);
  const [dashboard, setDashboard] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => { if (!cancelled) setEditalId(resolved.editalId); });
    return () => { cancelled = true; };
  }, [params]);

  useAbortableEffect(async (signal) => {
    if (!editalId || !token) {
      return;
    }

    try {
      const [editalResponse, dashboardResponse] = await Promise.all([getEditalById(editalId), getCandidateDashboard(token)]);
      if (signal.aborted) return;
      setEdital(editalResponse);
      setDashboard(dashboardResponse);
      setStatus("ready");
    } catch (error) {
      if (signal.aborted) return;
      if (isUnauthorizedError(error)) {
        signOut();
        return;
      }

      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [editalId, signOut, token]);

  const dashboardItem = useMemo(() => dashboard?.items.find((item) => item.edital.id === editalId) ?? null, [dashboard, editalId]);

  if (status === "loading") {
    return <LoadingState title="Carregando inscricao" description="Consultando o edital e o estado atual da inscricao do candidato." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar inscricao" description={message ?? undefined} />;
  }

  if (!edital) {
    return <EmptyState title="Edital indisponivel" description="Nao foi possivel carregar o edital informado." />;
  }

  if (!dashboardItem) {
    return (
      <div className="stack-layout">
        <PageFeedback
          type="warning"
          title="Participacao nao localizada para este edital"
          description="A area autenticada do candidato nao reconheceu uma participacao vinculada a este edital. Antes de editar a inscricao, confirme o vinculo correto na sua area de participacoes."
          action={<Link className="nav-link" href="/candidato/participacoes">Ver participacoes</Link>}
        />
        <EmptyState title="Inscricao indisponivel neste contexto" description="O editor de inscricao fica bloqueado enquanto a participacao deste edital nao estiver visivel no contexto autenticado do candidato." />
      </div>
    );
  }

  if (!dashboardItem.elegibilidade?.podeEditarInscricao && !dashboardItem.elegibilidade?.podeCancelarSubmissao) {
    return (
      <div className="stack-layout">
        <PageFeedback
          type="warning"
          title="Edicao da inscricao indisponivel"
          description={dashboardItem.elegibilidade?.motivoBloqueioInscricao ?? (dashboardItem.elegibilidade?.janelaInscricaoAberta ? "A inscricao atual nao pode mais ser editada nem cancelada para edicao no estado em que se encontra." : "A janela de inscricao deste edital esta encerrada, entao novas edicoes foram bloqueadas.")}
          action={<Link className="nav-link" href={`/candidato/editais/${dashboardItem.edital.id}`}>Voltar ao acompanhamento do edital</Link>}
        />
        <EmptyState title="Editor bloqueado" description="Os dados da inscricao permanecem preservados, mas o formulario nao pode mais ser alterado neste momento." />
      </div>
    );
  }

  return <InscricaoEditor dashboardItem={dashboardItem} edital={edital} />;
}
