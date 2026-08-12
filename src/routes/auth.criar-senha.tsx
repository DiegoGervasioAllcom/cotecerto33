import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import logoUrl from "@/assets/cotecerto-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { criarSenhaSchema, type CriarSenhaForm } from "@/lib/schemas/criar-senha.schema";

export const Route = createFileRoute("/auth/criar-senha")({
  head: () => ({ meta: [{ title: "Criar senha · CoteCerto" }] }),
  component: CriarSenhaPage,
});

function CriarSenhaPage() {
  const [checkingLink, setCheckingLink] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const query = new URLSearchParams(window.location.search);
  const emissaoId = query.get("emissao");
  const versaoRaw = query.get("versao");
  const versao = versaoRaw && /^\d+$/.test(versaoRaw) ? Number(versaoRaw) : null;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CriarSenhaForm>({
    resolver: zodResolver(criarSenhaSchema),
    defaultValues: { senha: "", confirmarSenha: "" },
  });

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const isRecoveryCallback =
      query.get("type") === "recovery" ||
      hash.get("type") === "recovery" ||
      query.has("token_hash") ||
      query.has("code") ||
      hash.has("access_token");

    async function establishRecoverySession() {
      if (!isRecoveryCallback) return null;

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        return supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }

      const code = query.get("code");
      if (code) return supabase.auth.exchangeCodeForSession(code);

      const tokenHash = query.get("token_hash");
      if (tokenHash) return supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

      return supabase.auth.getSession();
    }

    void establishRecoverySession().then((result) => {
      if (!active) return;
      setValidLink(Boolean(result?.data.session) && !result?.error);
      setCheckingLink(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || (event !== "PASSWORD_RECOVERY" && !session)) return;
      setValidLink(Boolean(session));
      setCheckingLink(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(values: CriarSenhaForm) {
    setSubmitError(null);
    if (!emissaoId || !versao || !Number.isSafeInteger(versao)) {
      await supabase.auth.signOut();
      setValidLink(false);
      setSubmitError("Este link foi substituído. Solicite um novo e-mail de acesso.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: values.senha });
    if (error) {
      setSubmitError(error.message);
      return;
    }
    // O GoTrue confirma a senha; a emissão de acesso só pode ser marcada como
    // ativa pelo próprio titular, já autenticado na sessão de recovery.
    const { error: activationError } = await supabase.rpc("ativar_acesso_apos_criar_senha", {
      p_emissao_id: emissaoId,
      p_versao: versao,
    });
    if (activationError) {
      setSubmitError(
        "Senha criada, mas não foi possível confirmar a ativação. Tente entrar novamente ou contate o responsável pelos acessos.",
      );
      return;
    }
    await supabase.auth.signOut();
    setCompleted(true);
  }

  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-h">
        <h2>Crie a sua senha</h2>
        <p>Você chegou pelo link do e-mail Boas-vindas Supper</p>
      </div>
      <div className="auth-card">
        {checkingLink ? (
          <p className="lead">Validando o link…</p>
        ) : completed ? (
          <>
            <div className="auth-note" style={{ marginBottom: 14 }}>
              <svg>
                <use href="#i-check" />
              </svg>
              <span>
                <strong>Senha criada!</strong> O link foi invalidado (uso único). Agora é só entrar
                com o seu e-mail e a senha nova.
              </span>
            </div>
            <Link
              to="/auth"
              className="auth-btn"
              style={{ display: "inline-block", textAlign: "center", lineHeight: "48px" }}
            >
              Ir para o login
            </Link>
          </>
        ) : !validLink ? (
          <>
            <div className="banner alert" style={{ marginBottom: 14, fontSize: 12.5 }}>
              Este link é inválido, já foi usado ou expirou. Solicite um novo e-mail ao responsável
              pelos acessos da sua operação.
            </div>
            <Link
              to="/auth"
              className="auth-btn"
              style={{ display: "inline-block", textAlign: "center", lineHeight: "48px" }}
            >
              Ir para o login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit(submit)}>
            <div className="auth-note" style={{ marginBottom: 14 }}>
              <svg>
                <use href="#i-lock" />
              </svg>
              <span>
                Link válido — de uso único, expira em <strong>48 horas</strong>. Você cria a senha;
                ninguém a recebe por e-mail.
              </span>
            </div>
            <div className="auth-field">
              <label htmlFor="nova-senha">Nova senha</label>
              <div className="auth-input">
                <svg>
                  <use href="#i-lock" />
                </svg>
                <input
                  id="nova-senha"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="mínimo 8 caracteres, letras e números"
                  maxLength={72}
                  {...register("senha")}
                />
                <button
                  className="pw-toggle"
                  type="button"
                  title="Mostrar/ocultar a senha"
                  aria-label={showPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
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
              {errors.senha && <div className="banner alert">{errors.senha.message}</div>}
            </div>
            <div className="auth-field">
              <label htmlFor="confirmar-senha">Confirmar a senha</label>
              <div className="auth-input">
                <svg>
                  <use href="#i-lock" />
                </svg>
                <input
                  id="confirmar-senha"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="repita a senha"
                  maxLength={72}
                  {...register("confirmarSenha")}
                />
                <button
                  className="pw-toggle"
                  type="button"
                  title="Mostrar/ocultar a senha"
                  aria-label={showConfirmation ? "Ocultar confirmação" : "Mostrar confirmação"}
                  aria-pressed={showConfirmation}
                  onClick={() => setShowConfirmation((value) => !value)}
                >
                  {showConfirmation ? (
                    "OCULTAR"
                  ) : (
                    <svg>
                      <use href="#i-eye" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmarSenha && (
                <div className="banner alert">{errors.confirmarSenha.message}</div>
              )}
            </div>
            {submitError && (
              <div className="banner alert" style={{ marginBottom: 14 }}>
                {submitError}
              </div>
            )}
            <div style={{ height: 12 }} />
            <button className="auth-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando senha…" : "Criar senha e entrar"}
            </button>
          </form>
        )}
      </div>
      <div className="auth-copy">© 2026 CoteCerto · Supper</div>
    </div>
  );
}
