import type { ReactNode } from "react";

import { AppFrame } from "@/components/shared/app-frame";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <AppFrame
      title="Portal do processo seletivo"
      description="Base publica para consulta de editais, autenticacao e acesso aos modulos do candidato."
      navigation={[
        { href: "/editais", label: "Editais" },
        { href: "/entrar", label: "Entrar" },
        { href: "/criar-conta", label: "Criar conta" },
      ]}
    >
      {children}
    </AppFrame>
  );
}
