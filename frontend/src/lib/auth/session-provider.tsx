"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { configureAuthRefresh } from "@/lib/http/client";
import { getAuthenticatedUser, logout, refreshSession } from "@/modules/auth/api";
import type { AuthResponse, AuthUser } from "@/modules/auth/types";

import { clearStoredToken, readStoredToken, writeStoredToken } from "./storage";

type SessionStatus = "loading" | "authenticated" | "anonymous";

type SessionContextValue = {
  status: SessionStatus;
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasRole: (role: AuthUser["perfis"][number]) => boolean;
  setSessionFromAuthResponse: (response: AuthResponse) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = {
  children: React.ReactNode;
};

function hasCsrfCookie() {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").some((item) => item.startsWith("XSRF-TOKEN="));
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedToken = readStoredToken();

    if (storedToken) {
      setToken(storedToken);
      getAuthenticatedUser(storedToken)
        .then((authenticatedUser) => {
          setUser(authenticatedUser);
          setStatus("authenticated");
        })
        .catch(() => {
          clearStoredToken();
          setToken(null);
          setUser(null);
          setStatus("anonymous");
        });
      return;
    }

    if (!hasCsrfCookie()) {
      setStatus("anonymous");
      return;
    }

    refreshSession()
      .then((response) => {
        writeStoredToken(response.token);
        setToken(response.token);
        setUser(response.user);
        setStatus("authenticated");
      })
      .catch(() => {
        clearStoredToken();
        setToken(null);
        setUser(null);
        setStatus("anonymous");
      });
  }, []);

  useEffect(() => {
    configureAuthRefresh(async () => {
      try {
        const response = await refreshSession();
        writeStoredToken(response.token);
        setToken(response.token);
        setUser(response.user);
        setStatus("authenticated");
        return response.token;
      } catch {
        clearStoredToken();
        setToken(null);
        setUser(null);
        setStatus("anonymous");
        return null;
      }
    });

    return () => configureAuthRefresh(null);
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    status,
    token,
    user,
    isAuthenticated: status === "authenticated" && !!token && !!user,
    hasRole: (role) => user?.perfis.includes(role) ?? false,
    setSessionFromAuthResponse: (response) => {
      writeStoredToken(response.token);
      setToken(response.token);
      setUser(response.user);
      setStatus("authenticated");
    },
    signOut: () => {
      void logout(token).catch(() => undefined);
      clearStoredToken();
      setToken(null);
      setUser(null);
      setStatus("anonymous");
    },
  }), [status, token, user]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession deve ser usado dentro de SessionProvider.");
  }

  return context;
}
