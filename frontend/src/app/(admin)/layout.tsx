"use client";

import type { ReactNode } from "react";

import { AppFrame } from "@/components/shared/app-frame";
import { RouteGuard } from "@/lib/auth/route-guard";
import { useSession } from "@/lib/auth/session-provider";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const session = useSession();

  return (
    <RouteGuard requiredRole="ADMIN">
      <AppFrame
        title="Area administrativa"
        description="Base protegida para os modulos operacionais de homologacao, etapas, recursos, classificacao e publicacoes."
        navigation={[
          { href: "/admin", label: "Inicio admin" },
          { href: "/admin/homologacao", label: "Homologacao" },
          { href: "/admin/etapa-1", label: "Etapa 1" },
          { href: "/admin/etapa-2", label: "Etapa 2" },
          { href: "/admin/politicas-afirmativas", label: "Politicas" },
          { href: "/admin/recursos", label: "Recursos" },
          { href: "/admin/classificacao", label: "Classificacao" },
          { href: "/admin/publicacoes", label: "Publicacoes" },
          { href: "/candidato", label: "Area do candidato" },
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
