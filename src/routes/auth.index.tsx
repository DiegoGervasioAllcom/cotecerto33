import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from "@/integrations/supabase/client";
import { getProfileAccessState, useAuth } from "@/lib/auth";
import { useGroupScope } from "@/lib/group-scope";
import { resolverLanding } from "@/lib/landing";
import {
  limparChaveRedirecionamentoFalho,
  proximaChaveRedirecionamento,
} from "@/lib/redirect-once";
import { ProtoIcons } from "@/components/proto-icons";
import logoUrl from "@/assets/cotecerto-logo.png";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [{ title: "Entrar · CoteCerto" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, profile, role, loading, accessError, refresh } = useAuth();
  const { loading: groupLoading, isGroupView } = useGroupScope();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultimoRedirecionamento = useRef<string | null>(null);
  const [erroNavegacao, setErroNavegacao] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (loading || !session) {
      ultimoRedirecionamento.current = null;
      setErroNavegacao(null);
      return;
    }

    const profileAccess = getProfileAccessState(profile);
    if (profileAccess === "disabled" || profileAccess === "unknown") return;
    const destino =
      profileAccess === "pending"
        ? "/auth/pendente"
        : resolverLanding({ role, isGroupView, groupLoading });
    if (!destino) return;

    // A rota de login permanece montada enquanto o TanStack carrega o destino.
    // Não reiniciar a mesma transição quando o estado interno do router renderiza
    // este efeito novamente (especialmente ao trocar de persona na mesma page).
    const chaveDesejada = [session.user.id, destino].join("->");
    if (erroNavegacao === chaveDesejada) return;
    if (erroNavegacao) setErroNavegacao(null);

    const chave = proximaChaveRedirecionamento(
      [session.user.id, destino],
      ultimoRedirecionamento.current,
    );
    if (!chave) return;
    ultimoRedirecionamento.current = chave;
    void navigate({ to: destino, replace: true }).catch(() => {
      if (ultimoRedirecionamento.current !== chave) return;
      ultimoRedirecionamento.current = limparChaveRedirecionamentoFalho(
        ultimoRedirecionamento.current,
        chave,
      );
      setErroNavegacao(chave);
    });
  }, [
    session,
    profile,
    role,
    loading,
    groupLoading,
    isGroupView,
    navigate,
    erroNavegacao,
    retryNonce,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError(supabaseConfigError ?? "Supabase não configurado.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    try {
      await supabase.rpc("registrar_tentativa_login", {
        p_email: email,
        p_sucesso: !error,
        p_motivo: error?.message ?? undefined,
        p_user_agent: ua,
      });
    } catch {
      /* não bloquear login por falha de auditoria */
    }
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }
    await refresh();
    setSubmitting(false);
  };

  return (
    <div className="auth-stage">
      <ProtoIcons />
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-card">
        <h3>Entrar na sua franquia</h3>
        <p className="lead">Use seu e-mail corporativo e senha.</p>
        {erroNavegacao && (
          <div className="banner alert" style={{ marginBottom: 14, fontSize: 12.5 }}>
            Não foi possível abrir sua área.
            <button
              type="button"
              className="link"
              onClick={() => {
                setErroNavegacao(null);
                setRetryNonce((atual) => atual + 1);
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {!isSupabaseConfigured && (
          <div className="banner alert" style={{ marginBottom: 14, fontSize: 12.5 }}>
            {supabaseConfigError} Configure as variáveis do Supabase para entrar.
          </div>
        )}
        {accessError && (
          <div className="banner alert" style={{ marginBottom: 14, fontSize: 12.5 }}>
            {accessError}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label>E-mail</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label>Senha</label>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="pw-toggle"
                title="Mostrar/ocultar a senha"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  "OCULTAR"
                ) : (
                  <svg>
                    <use href="#i-eye" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="banner alert" style={{ marginBottom: 14, fontSize: 12.5 }}>
              {error}
            </div>
          )}
          <button className="auth-btn" type="submit" disabled={submitting || !isSupabaseConfigured}>
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <div className="auth-divider" />
        <p className="auth-foot" style={{ margin: "0 0 12px" }}>
          O acesso à plataforma é por convite.
          <br />
          Ainda não tem o seu?
        </p>
        <Link
          to="/auth/contato"
          className="auth-btn outline"
          style={{ display: "inline-block", textAlign: "center" }}
        >
          Quero falar com a Supper Certo
        </Link>
      </div>
    </div>
  );
}
