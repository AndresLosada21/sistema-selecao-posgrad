"use client";

import { useCallback, useState } from "react";

import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/page-states";
import { PageFeedback } from "@/components/shared/page-feedback";
import { PublicAccessCta } from "@/components/shared/public-access-cta";
import { getErrorMessage } from "@/lib/http/api-error";
import { useSession } from "@/lib/auth/session-provider";
import { useAbortableEffect } from "@/lib/react/use-abortable-effect";
import { EditalCard } from "@/modules/edital/components/edital-card";
import { listEditais } from "@/modules/edital/api";
import type { EditaisResponse } from "@/modules/edital/types";

function isTechnicalEdital(numero: string, titulo: string) {
  const n = numero.toUpperCase();
  const t = titulo.toLowerCase();
  return n.startsWith("SMK-") || n.startsWith("E2E-") || n.startsWith("PAF-") || t.includes("smoke") || t.includes("e2e");
}

export default function EditaisPage() {
  const session = useSession();
  const [data, setData] = useState<EditaisResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const loadEditais = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    const response = await listEditais();
    setData(response);
    setStatus("ready");
  }, []);

  useAbortableEffect(async (signal) => {
    try {
      await loadEditais();
    } catch (error) {
      if (signal.aborted) return;
      setMessage(getErrorMessage(error));
      setStatus("error");
    }
  }, [loadEditais]);

  if (status === "loading") {
    return <LoadingState description="Consultando os editais publicados..." title="Carregando editais" />;
  }

  if (status === "error") {
    return (
      <div className="stack-layout">
        <ErrorState description={message ?? undefined} title="Falha ao carregar editais" />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ActionButton onClick={loadEditais} type="button" variant="secondary">
            Tentar novamente
          </ActionButton>
        </div>
      </div>
    );
  }

  if (!data?.items.length) {
    return <EmptyState description="Nenhum edital foi disponibilizado no momento." title="Nenhum edital encontrado" />;
  }

  const operationalItems = data.items.filter((edital) => !isTechnicalEdital(edital.numero, edital.titulo));
  const technicalItems = data.items.filter((edital) => isTechnicalEdital(edital.numero, edital.titulo));
  const visibleItems = showTechnical ? data.items : operationalItems;

  return (
    <div className="stack-layout">
      <PageFeedback
        type="info"
        title="Consulta publica do processo seletivo"
        description={session.isAuthenticated
          ? "Acompanhe editais, cronogramas e publicacoes oficiais. Voce ja esta autenticado e pode seguir para sua area."
          : "Acompanhe editais, cronogramas e publicacoes oficiais. Para operar fluxos do candidato, entre com sua conta."}
        action={<PublicAccessCta />}
      />

      <PageHeader
        title="Editais publicados"
        description={`Exibindo ${visibleItems.length} edital(is) publico(s)${showTechnical ? ` de um total de ${data.total}` : ""}.`}
      />

      <div className="stack-layout">
        {visibleItems.map((edital) => (
          <EditalCard edital={edital} key={edital.id} />
        ))}
      </div>

      {session.hasRole("ADMIN") && technicalItems.length ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <ActionButton onClick={() => setShowTechnical((c) => !c)} type="button" variant="secondary">
            {showTechnical ? "Ocultar editais tecnicos" : `Exibir ${technicalItems.length} editais tecnicos`}
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
