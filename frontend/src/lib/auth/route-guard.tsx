"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { LoadingState } from "@/components/shared/page-states";

import { useSession } from "./session-provider";

type RouteGuardProps = {
  children: React.ReactNode;
  requiredRole?: string;
  redirectTo?: string;
};

export function RouteGuard({ children, requiredRole, redirectTo = "/entrar" }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  useEffect(() => {
    if (session.status === "loading") {
      return;
    }

    if (!session.isAuthenticated) {
      router.replace(`${redirectTo}?next=${encodeURIComponent(pathname ?? "/")}`);
      return;
    }

    if (requiredRole && !session.hasRole(requiredRole)) {
      router.replace("/candidato");
    }
  }, [pathname, redirectTo, requiredRole, router, session]);

  if (session.status === "loading") {
    return <LoadingState description="Validando sessao..." title="Carregando" />;
  }

  if (!session.isAuthenticated) {
    return <LoadingState description="Redirecionando para autenticacao..." title="Aguardando" />;
  }

  if (requiredRole && !session.hasRole(requiredRole)) {
    return <LoadingState description="Redirecionando para area permitida..." title="Acesso restrito" />;
  }

  return <>{children}</>;
}
