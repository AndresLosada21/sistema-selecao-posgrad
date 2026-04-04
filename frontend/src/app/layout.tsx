import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SessionProvider } from "@/lib/auth/session-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema de Selecao Pos-Grad",
  description: "Portal do processo seletivo stricto sensu do PPGEE/UFAM.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
