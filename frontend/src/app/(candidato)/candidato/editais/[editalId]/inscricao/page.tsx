"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { getEditalById } from "@/modules/edital/api";
import type { EditalDetalhe } from "@/modules/edital/types";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
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
    params.then((resolved) => setEditalId(resolved.editalId));
  }, [params]);

  useEffect(() => {
    if (!editalId || !token) {
      return;
    }

    Promise.all([getEditalById(editalId), getCandidateDashboard(token)])
      .then(([editalResponse, dashboardResponse]) => {
        setEdital(editalResponse);
        setDashboard(dashboardResponse);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          signOut();
          return;
        }

        setMessage(getErrorMessage(error));
        setStatus("error");
      });
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

  return <InscricaoEditor dashboardItem={dashboardItem} edital={edital} />;
}
