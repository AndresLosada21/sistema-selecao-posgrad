"use client";

import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { useSession } from "@/lib/auth/session-provider";
import { getErrorMessage, isUnauthorizedError } from "@/lib/http/api-error";
import { getCandidateDashboard } from "@/modules/candidato/api";
import type { CandidateDashboardResponse } from "@/modules/candidato/types";
import { IsencaoForm } from "@/modules/isencao/components/isencao-form";

type NewIsencaoPageProps = {
  params: Promise<{ editalId: string }>;
};

export default function NewIsencaoPage({ params }: NewIsencaoPageProps) {
  const session = useSession();
  const [editalId, setEditalId] = useState<string | null>(null);
  const [data, setData] = useState<CandidateDashboardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    params.then((resolved) => setEditalId(resolved.editalId));
  }, [params]);

  useEffect(() => {
    if (!session.token || !editalId) {
      return;
    }

    getCandidateDashboard(session.token)
      .then((response) => {
        setData(response);
        setStatus("ready");
      })
      .catch((error) => {
        if (isUnauthorizedError(error)) {
          session.signOut();
          return;
        }

        setMessage(getErrorMessage(error));
        setStatus("error");
      });
  }, [editalId, session]);

  const item = useMemo(() => data?.items.find((entry) => entry.edital.id === editalId) ?? null, [data, editalId]);

  if (status === "loading") {
    return <LoadingState title="Carregando edital para isencao" description="Consultando o edital vinculado ao candidato." />;
  }

  if (status === "error") {
    return <ErrorState title="Falha ao carregar edital" description={message ?? undefined} />;
  }

  if (!item) {
    return <EmptyState title="Edital nao encontrado" description="Nao foi encontrada participacao do candidato para o edital informado." />;
  }

  return <IsencaoForm cursoNivel={item.edital.cursoNivel as "MESTRADO" | "DOUTORADO"} editalId={item.edital.id} />;
}
