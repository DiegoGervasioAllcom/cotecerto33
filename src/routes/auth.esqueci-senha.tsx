import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import logoUrl from "@/assets/cotecerto-logo.png";
import { ProtoIcons } from "@/components/proto-icons";
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigError,
} from "@/integrations/supabase/client";
import {
  recuperarSenhaSchema,
  type RecuperarSenhaForm,
} from "@/lib/schemas/recuperar-senha.schema";
import { requestPasswordRecovery } from "@/lib/auth-recovery";

export const Route = createFileRoute("/auth/esqueci-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha · CoteCerto" }] }),
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const [requested, setRequested] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecuperarSenhaForm>({
    resolver: zodResolver(recuperarSenhaSchema),
    defaultValues: { email: "" },
  });

  async function submit(values: RecuperarSenhaForm) {
    setConfigError(null);
    setRequestError(null);
    if (!isSupabaseConfigured) {
      setConfigError(supabaseConfigError ?? "Supabase não configurado.");
      return;
    }
    const sent = await requestPasswordRecovery(
      supabase.auth,
      values.email,
      `${window.location.origin}/auth/redefinir-senha`,
    );
    if (!sent) {
      setRequestError(
        "Não foi possível enviar o e-mail agora. Aguarde um momento e tente novamente.",
      );
      return;
    }
    // A resposta é deliberadamente neutra para não revelar contas cadastradas.
    setRequested(true);
  }

  return (
    <div className="auth-stage">
      <ProtoIcons />
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-h">
        <h2>Recupere sua senha</h2>
        <p>Enviaremos as instruções para o seu e-mail</p>
      </div>
      <div className="auth-card">
        {requested ? (
          <>
            <div className="auth-note" role="status" style={{ marginBottom: 14 }}>
              <svg>
                <use href="#i-mail" />
              </svg>
              <span>
                Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.
                Verifique também a caixa de spam.
              </span>
            </div>
            <Link
              to="/auth"
              className="auth-btn"
              style={{ display: "inline-block", textAlign: "center", lineHeight: "48px" }}
            >
              Voltar ao login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit(submit)}>
            <div className="auth-field">
              <label htmlFor="email-recuperacao">E-mail</label>
              <div className="auth-input">
                <svg>
                  <use href="#i-mail" />
                </svg>
                <input
                  id="email-recuperacao"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  maxLength={254}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <div className="banner alert" role="alert">
                  {errors.email.message}
                </div>
              )}
            </div>
            {configError && (
              <div className="banner alert" role="alert" style={{ marginBottom: 14 }}>
                {configError}
              </div>
            )}
            {requestError && (
              <div className="banner alert" role="alert" style={{ marginBottom: 14 }}>
                {requestError}
              </div>
            )}
            <button
              className="auth-btn"
              type="submit"
              disabled={isSubmitting || !isSupabaseConfigured}
            >
              {isSubmitting ? "Enviando…" : "Enviar link de recuperação"}
            </button>
            <p className="auth-foot">
              <Link to="/auth" className="auth-link">
                Voltar ao login
              </Link>
            </p>
          </form>
        )}
      </div>
      <div className="auth-copy">© 2026 CoteCerto · Supper</div>
    </div>
  );
}
