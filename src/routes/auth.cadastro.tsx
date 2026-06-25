import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/cotecerto-logo.png.asset.json";

export const Route = createFileRoute("/auth/cadastro")({
  head: () => ({ meta: [{ title: "Criar franquia · CoteCerto" }] }),
  component: CadastroPage,
});

type Tipo = "pj" | "pf";

function CadastroPage() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<Tipo>("pj");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [documento, setDocumento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined,
        data: {
          nome: responsavel,
          empresa_nome: nomeEmpresa || responsavel,
          empresa_tipo: tipo,
          empresa_documento: documento,
        },
      },
    });

    if (signErr) {
      setError(signErr.message);
      setSubmitting(false);
      return;
    }

    // Caso o trigger de banco não tenha criado a empresa, garantimos via RPC.
    if (data.user) {
      const { error: rpcErr } = await supabase.rpc("cadastrar_franquia", {
        p_nome: nomeEmpresa || responsavel,
        p_tipo: tipo,
        p_documento: documento,
        p_responsavel: responsavel,
      });
      if (rpcErr && !rpcErr.message.includes("já cadastrada")) {
        // Não-fatal: o usuário ainda pode prosseguir; matriz aprovará posteriormente.
        console.warn("[cadastro] RPC cadastrar_franquia:", rpcErr.message);
      }
    }

    setSubmitting(false);
    navigate({ to: "/auth/pendente", replace: true });
  };

  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoAsset.url} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h3>Criar nova franquia</h3>
        <p className="lead">
          Preencha seus dados. Sua franquia ficará pendente até aprovação pela Matriz.
        </p>

        <div className="seg" style={{ marginBottom: 18 }}>
          <button
            type="button"
            className={tipo === "pj" ? "on" : ""}
            onClick={() => setTipo("pj")}
          >
            Pessoa Jurídica
          </button>
          <button
            type="button"
            className={tipo === "pf" ? "on" : ""}
            onClick={() => setTipo("pf")}
          >
            Pessoa Física
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label>{tipo === "pj" ? "Razão social" : "Nome completo"}<span className="req">*</span></label>
            <input
              className="input"
              required
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label>{tipo === "pj" ? "CNPJ" : "CPF"}<span className="req">*</span></label>
            <input
              className="input"
              required
              inputMode="numeric"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
            />
          </div>
          {tipo === "pj" && (
            <div className="field-group">
              <label>Nome do responsável<span className="req">*</span></label>
              <input
                className="input"
                required
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
              />
            </div>
          )}
          {tipo === "pf" && (
            <input type="hidden" value={(responsavel || nomeEmpresa)} readOnly />
          )}
          <div className="field-group">
            <label>E-mail<span className="req">*</span></label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label>Senha<span className="req">*</span></label>
            <input
              className="input"
              type="password"
              required
              minLength={6}
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
            {submitting ? "Enviando…" : "Criar franquia"}
          </button>
        </form>

        <div className="auth-foot">
          Já tem cadastro? <Link to="/auth">Entrar</Link>
        </div>
      </div>
    </div>
  );
}
