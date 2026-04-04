"use client";

import type { ReactNode } from "react";

import { AppFrame } from "@/components/shared/app-frame";
import { RouteGuard } from "@/lib/auth/route-guard";
import { useSession } from "@/lib/auth/session-provider";

type CandidateLayoutProps = {
  children: ReactNode;
};

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  const session = useSession();

  return (
    <RouteGuard>
      <AppFrame
        title="Area do candidato"
        description="Modulo autenticado base para participacoes, inscricoes, publicacoes e acompanhamento por edital."
        navigation={[
          { href: "/candidato", label: "Painel" },
          { href: "/candidato/participacoes", label: "Participacoes" },
          { href: "/candidato/isencoes", label: "Isencoes" },
          { href: "/candidato/inscricoes", label: "Inscricoes" },
          { href: "/editais", label: "Editais" },
        ]}
        actions={
          <button className="secondary-button" onClick={session.signOut} type="button">
            Sair
          </button>
        }
      >
        {children}
      </AppFrame>
    </RouteGuard>
  );
}
