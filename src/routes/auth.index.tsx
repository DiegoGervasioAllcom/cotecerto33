import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import logoAsset from "@/assets/cotecerto-logo.png.asset.json";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [{ title: "Entrar · CoteCerto" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, profile, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) return;
    if (profile?.status === "pendente") navigate({ to: "/auth/pendente", replace: true });
    else navigate({ to: "/inicio", replace: true });
  }, [session, profile, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoAsset.url} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-card">
        <h3>Entrar na sua franquia</h3>
        <p className="lead">Use seu e-mail corporativo e senha.</p>
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
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="banner alert" style={{ marginBottom: 14, fontSize: 12.5 }}>
              {error}
            </div>
          )}
          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <div className="auth-foot">
          Ainda não tem cadastro? <Link to="/auth/cadastro">Criar franquia</Link>
        </div>
      </div>
    </div>
  );
}
