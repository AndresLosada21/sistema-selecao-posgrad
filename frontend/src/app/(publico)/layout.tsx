"use client";

import type { ReactNode } from "react";

import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

type PublicLayoutProps = {
  children: ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PublicHeader />
      <main className="public-main">
        <div className="public-main-inner">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}
