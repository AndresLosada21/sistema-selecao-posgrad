"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { IsencaoForm } from "@/modules/isencao/components/isencao-form";

type NewIsencaoPageProps = {
  params: Promise<{ editalId: string }>;
};

export default function NewIsencaoPage({ params }: NewIsencaoPageProps) {
  const session = useSession();
  const token = session.token;
  const signOut = session.signOut;
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => { if (!cancelled) setEditalId(resolved.editalId); });
    return () => { cancelled = true; };
  }, [params]);

  useAbortableEffect(async (signal) => {
    if (!token || !editalId) {
      return;
    }

    try {
      const response = await getCandidateDashboard(token);
      if (signal.aborted) return;
      setData(response);
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

  const item = useMemo(() => data?.items.find((entry) => entry.edital.id === editalId) ?? null, [data, editalId]);

  if (status === "loading") {
    return <LoadingState title="Carregando edital para isencao" description="Consultando o edital vinculado ao candidato." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar edital" description={message ?? undefined} />;
  }

  if (!item) {
    return (
      <div className="stack-layout">
        <EmptyState title="Edital nao encontrado" description="Nao foi encontrada participacao do candidato para o edital informado." />
        <div className="content-item-links">
          <Link className="nav-link" href="/candidato/participacoes">
            Voltar para participacoes
          </Link>
        </div>
      </div>
    );
  }

  if (item.isencao) {
    return (
      <div className="stack-layout">
        <PageFeedback
          type="warning"
          title="Ja existe pedido de isencao vinculado a este edital"
          description="Esta rota permanece restrita a novos pedidos. Para acompanhar o pedido existente, volte ao edital ou consulte o historico de isencoes da conta."
          action={<Link className="nav-link" href={`/candidato/editais/${item.edital.id}`}>Abrir acompanhamento</Link>}
        />
        <div className="content-item-links">
          <Link className="nav-link" href="/candidato/isencoes">
            Ver historico de isencoes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <IsencaoForm cursoNivel={item.edital.cursoNivel as "MESTRADO" | "DOUTORADO"} editalId={item.edital.id} editalNumero={item.edital.numero} />
  );
}
