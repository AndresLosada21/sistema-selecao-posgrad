"use client";

import type { ReactNode } from "react";

import { CandidateHeader } from "@/components/layout/candidate-header";
import { CandidateSidebar } from "@/components/layout/candidate-sidebar";
import { RouteGuard } from "@/lib/auth/route-guard";

type CandidateLayoutProps = {
  children: ReactNode;
};

export default function CandidateLayout({ children }: CandidateLayoutProps) {
  return (
    <RouteGuard>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <CandidateHeader />
        <div className="candidate-body">
          <CandidateSidebar />
          <main className="candidate-main">
            <div className="candidate-main-inner">{children}</div>
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
