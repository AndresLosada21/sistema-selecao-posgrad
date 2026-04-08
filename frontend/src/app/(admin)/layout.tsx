"use client";

import type { ReactNode } from "react";

import { AdminHeader } from "@/components/layout/admin-header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { RouteGuard } from "@/lib/auth/route-guard";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <RouteGuard requiredRole="ADMIN">
      <div className="admin-shell">
        <AdminHeader />
        <div className="admin-body">
          <AdminSidebar />
          <main className="admin-main">
            <div className="admin-main-inner">{children}</div>
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}
