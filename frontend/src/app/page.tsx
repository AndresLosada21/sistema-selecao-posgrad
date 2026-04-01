"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthResponse = {
  token: string;
  user: {
    id: string;
    nomeCompleto: string;
    email: string;
    perfis: string[];
  };
};

type DashboardResponse = {
  total: number;
  items: Array<{
    id: string;
    edital: {
      numero: string;
      titulo: string;
      cursoNivel: string;
      status: string;
    };
    isencao: {
      status: string;
      parecerFinal: string | null;
    } | null;
    inscricao: {
      status: string;
      statusPagamento: string;
      linhaPesquisa: { nome: string } | null;
      documentos: Array<{ id: string; nome: string; tipo: string }>;
      homologacao: {
        statusFinal: string | null;
        parecerFinal: string | null;
      } | null;
      etapa1: {
        nota: number | null;
        status: string;
      } | null;
      etapa2: {
        notaNormalizada: number | null;
        status: string;
      } | null;
    } | null;
    classificacao: {
      status: string;
      notaFinal: number | null;
      posicaoGeral: number | null;
    } | null;
    recursos: Array<{
      id: string;
      fase: string;
      status: string;
    }>;
  }>;
};

type EditaisResponse = {
  total: number;
  items: Array<{
    id: string;
    numero: string;
    titulo: string;
    cursoNivel: string;
    status: string;
    faseAtual: { titulo: string } | null;
    proximaFase: { titulo: string } | null;
  }>;
};

const tokenStorageKey = "selecao-posgrad-token";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const data = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? "Falha na requisicao.");
  }

  return data;
}

export default function HomePage() {
  const [mode, setMode] = useState<"login" | "cadastro">("login");
  const [token, setToken] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [editais, setEditais] = useState<EditaisResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    const storedToken = window.localStorage.getItem(tokenStorageKey);

    if (!storedToken) {
      setStatus("ready");
      return;
    }

    setToken(storedToken);
  }, []);

  useEffect(() => {
    request<EditaisResponse>("/v1/editais")
      .then(setEditais)
      .catch(() => {
        setEditais(null);
      });
  }, []);

  useEffect(() => {
    if (!token) {
      setAuth(null);
      setDashboard(null);
      return;
    }

    setStatus("loading");

    Promise.all([
      request<AuthResponse["user"]>("/v1/auth/me", {}, token),
      request<DashboardResponse>("/v1/candidato/area", {}, token),
    ])
      .then(([user, dashboardResponse]) => {
        setAuth({ token, user });
        setDashboard(dashboardResponse);
        setStatus("ready");
      })
      .catch((error: Error) => {
        window.localStorage.removeItem(tokenStorageKey);
        setToken(null);
        setStatus("error");
        setMessage(error.message);
      });
  }, [token]);

  const dashboardSummary = useMemo(() => {
    if (!dashboard?.items.length) {
      return null;
    }

    const first = dashboard.items[0];

    return {
      participacoes: dashboard.total,
      inscricaoStatus: first.inscricao?.status ?? "SEM_INSCRICAO",
      classificacao: first.classificacao?.status ?? "SEM_CLASSIFICACAO",
    };
  }, [dashboard]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);

    try {
      const response =
        mode === "cadastro"
          ? await request<AuthResponse>("/v1/auth/register", {
              method: "POST",
              body: JSON.stringify({ nomeCompleto, email, senha, telefone, cpf }),
            })
          : await request<AuthResponse>("/v1/auth/login", {
              method: "POST",
              body: JSON.stringify({ email, senha }),
            });

      window.localStorage.setItem(tokenStorageKey, response.token);
      setToken(response.token);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage((error as Error).message);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem(tokenStorageKey);
    setToken(null);
    setAuth(null);
    setDashboard(null);
    setStatus("ready");
    setMessage(null);
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-header">
          <div>
            <p className="eyebrow">Portal do processo seletivo</p>
            <h1>Sistema de Selecao Pos-Graduacao</h1>
            <p className="hero-copy">
              Base funcional integrada ao backend dockerizado para acompanhar editais,
              autenticacao e area do candidato.
            </p>
          </div>
          {auth ? (
            <button className="secondary-button" onClick={handleLogout} type="button">
              Sair
            </button>
          ) : null}
        </div>

        <div className="grid-layout">
          <section className="panel">
            <h2>Editais disponiveis</h2>
            <div className="stack-list">
              {editais?.items.map((edital) => (
                <article className="item-card" key={edital.id}>
                  <strong>
                    {edital.numero} · {edital.cursoNivel}
                  </strong>
                  <span>{edital.titulo}</span>
                  <small>Status: {edital.status}</small>
                  <small>Fase atual: {edital.faseAtual?.titulo ?? "sem fase ativa"}</small>
                  <small>Proxima fase: {edital.proximaFase?.titulo ?? "sem previsao imediata"}</small>
                </article>
              ))}
            </div>
          </section>

          {!auth ? (
            <section className="panel auth-panel">
              <div className="tab-row">
                <button
                  className={mode === "login" ? "tab-active" : "tab-button"}
                  onClick={() => setMode("login")}
                  type="button"
                >
                  Entrar
                </button>
                <button
                  className={mode === "cadastro" ? "tab-active" : "tab-button"}
                  onClick={() => setMode("cadastro")}
                  type="button"
                >
                  Criar conta
                </button>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                {mode === "cadastro" ? (
                  <label>
                    Nome completo
                    <input onChange={(event) => setNomeCompleto(event.target.value)} value={nomeCompleto} />
                  </label>
                ) : null}

                <label>
                  E-mail
                  <input onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
                </label>

                <label>
                  Senha
                  <input onChange={(event) => setSenha(event.target.value)} type="password" value={senha} />
                </label>

                {mode === "cadastro" ? (
                  <>
                    <label>
                      Telefone
                      <input onChange={(event) => setTelefone(event.target.value)} value={telefone} />
                    </label>
                    <label>
                      CPF
                      <input onChange={(event) => setCpf(event.target.value)} value={cpf} />
                    </label>
                  </>
                ) : null}

                <button className="primary-button" type="submit">
                  {status === "loading" ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
                </button>
              </form>

              {message ? <p className="feedback error-text">{message}</p> : null}
            </section>
          ) : (
            <section className="panel dashboard-panel">
              <h2>Area do candidato</h2>
              <p className="hero-copy">
                {auth.user.nomeCompleto} · {auth.user.email}
              </p>

              <div className="summary-grid">
                <article className="summary-card">
                  <span>Participacoes</span>
                  <strong>{dashboardSummary?.participacoes ?? 0}</strong>
                </article>
                <article className="summary-card">
                  <span>Status da inscricao</span>
                  <strong>{dashboardSummary?.inscricaoStatus ?? "-"}</strong>
                </article>
                <article className="summary-card">
                  <span>Classificacao</span>
                  <strong>{dashboardSummary?.classificacao ?? "-"}</strong>
                </article>
              </div>

              <div className="stack-list">
                {dashboard?.items.map((item) => (
                  <article className="item-card item-card-large" key={item.id}>
                    <strong>
                      {item.edital.numero} · {item.edital.cursoNivel}
                    </strong>
                    <span>{item.edital.titulo}</span>
                    <small>Status da inscricao: {item.inscricao?.status ?? "SEM_INSCRICAO"}</small>
                    <small>Status da isencao: {item.isencao?.status ?? "SEM_PEDIDO"}</small>
                    <small>Linha: {item.inscricao?.linhaPesquisa?.nome ?? "nao definida"}</small>
                    <small>Documentos enviados: {item.inscricao?.documentos.length ?? 0}</small>
                    <small>Etapa 1: {item.inscricao?.etapa1?.nota ?? "-"}</small>
                    <small>Etapa 2: {item.inscricao?.etapa2?.notaNormalizada ?? "-"}</small>
                    <small>Classificacao: {item.classificacao?.status ?? "SEM_CLASSIFICACAO"}</small>
                    <small>Recursos: {item.recursos.length}</small>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
