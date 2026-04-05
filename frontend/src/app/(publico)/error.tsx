"use client";

import { ActionButton } from "@/components/shared/action-button";
import { ErrorState } from "@/components/shared/page-states";

type PublicErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PublicErrorPage({ reset }: PublicErrorPageProps) {
  return (
    <div className="stack-layout">
      <ErrorState
        title="Falha ao carregar a pagina publica"
        description="Nao foi possivel consultar este bloco do portal no momento. Tente novamente em instantes."
      />
      <div className="content-item-links">
        <ActionButton onClick={reset} type="button" variant="secondary">
          Tentar novamente
        </ActionButton>
      </div>
    </div>
  );
}
