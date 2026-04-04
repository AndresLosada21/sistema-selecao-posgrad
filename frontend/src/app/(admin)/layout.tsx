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
