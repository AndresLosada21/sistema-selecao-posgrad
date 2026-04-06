"use client";

import { ActionButton } from "@/components/shared/action-button";
import { ErrorState } from "@/components/shared/page-states";

type EditalPublicErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function EditalPublicErrorPage({ reset }: EditalPublicErrorPageProps) {
  return (
    <div className="stack-layout">
      <ErrorState
        title="Falha ao carregar o edital"
        description="Nao foi possivel consultar este bloco publico do edital agora. Tente novamente em instantes."
      />
      <div className="content-item-links">
        <ActionButton onClick={reset} type="button" variant="secondary">
          Tentar novamente
        </ActionButton>
      </div>
    </div>
  );
}
