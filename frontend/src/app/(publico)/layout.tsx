"use client";

import type { ReactNode } from "react";

import { AppFrame } from "@/components/shared/app-frame";
import { useSession } from "@/lib/auth/session-provider";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  const session = useSession();

  const navigation = [{ href: "/editais", label: "Editais" }];
  const description = session.isAuthenticated
    ? "Base publica para consulta de editais e acesso rapido as areas autenticadas do processo."
    : "Base publica para consulta de editais, autenticacao e acesso aos modulos do candidato.";

  if (session.isAuthenticated) {
    navigation.push({ href: "/candidato", label: "Area do candidato" });

    if (session.hasRole("ADMIN")) {
      navigation.push({ href: "/admin", label: "Area administrativa" });
    }
  } else {
    navigation.push({ href: "/entrar", label: "Entrar" });
    navigation.push({ href: "/criar-conta", label: "Criar conta" });
  }

  return (
    <AppFrame
      title="Portal do processo seletivo"
      description={description}
      navigation={navigation}
      actions={
        session.isAuthenticated ? (
          <button className="secondary-button" onClick={session.signOut} type="button">
            Sair
          </button>
        ) : null
      }
    >
      {children}
    </AppFrame>
  );
}
