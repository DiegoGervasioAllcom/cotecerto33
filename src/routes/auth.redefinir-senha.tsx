import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import logoUrl from "@/assets/cotecerto-logo.png";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import {
  clearSessionAfterPasswordChange,
  isPasswordRecoveryEvent,
  parseRecoveryCallback,
} from "@/lib/auth-recovery";
import { criarSenhaSchema, type CriarSenhaForm } from "@/lib/schemas/criar-senha.schema";

export const Route = createFileRoute("/auth/redefinir-senha")({
  head: () => ({ meta: [{ title: "Nova senha · CoteCerto" }] }),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const [checkingLink, setCheckingLink] = useState(true);
  const [validLink, setValidLink] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
    const callback = parseRecoveryCallback(new URL(window.location.href));
    let recoverySessionReceived = false;
    let finishWaiting: (() => void) | null = null;
    const recoveryEvent = new Promise<void>((resolve) => {
      finishWaiting = resolve;
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || !isPasswordRecoveryEvent(event, Boolean(session))) return;
      recoverySessionReceived = true;
      finishWaiting?.();
    });
    async function establishSession() {
      if (callback.kind === "code") return supabase.auth.exchangeCodeForSession(callback.code);
      if (callback.kind === "tokenHash") {
        return supabase.auth.verifyOtp({ type: "recovery", token_hash: callback.tokenHash });
      }
      // O fluxo implícito é processado automaticamente pelo cliente. Não usamos
      // setSession aqui: só PASSWORD_RECOVERY é prova de que o link era recovery.
      return callback.kind === "tokens" ? supabase.auth.getSession() : null;
    }
    void establishSession().then(async (result) => {
      if (result?.error) {
        if (!active) return;
        setValidLink(false);
        setCheckingLink(false);
        return;
      }
      if (!recoverySessionReceived) {
        await Promise.race([
          recoveryEvent,
          new Promise<void>((resolve) => window.setTimeout(resolve, 750)),
        ]);
      }
      if (!active) return;
      setValidLink(recoverySessionReceived);
      setCheckingLink(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(values: CriarSenhaForm) {
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: values.senha });
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const cleared = await clearSessionAfterPasswordChange(supabase.auth);
    if (!cleared) {
      setSubmitError(
        "A senha foi alterada, mas não foi possível encerrar esta sessão com segurança. Feche esta página e tente entrar novamente.",
      );
      return;
    }
    setCompleted(true);
  }

  return (
    <div className="auth-stage">
      <ProtoIcons />
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-h">
        <h2>Crie uma nova senha</h2>
        <p>Escolha uma senha segura para acessar sua conta</p>
      </div>
      <div className="auth-card">
        {checkingLink ? (
          <p className="lead" role="status">
            Validando o link…
          </p>
        ) : completed ? (
          <>
            <div className="auth-note" role="status" style={{ marginBottom: 14 }}>
              <svg>
                <use href="#i-check" />
              </svg>
              <span>
                <strong>Senha alterada!</strong> Agora você já pode entrar com a nova senha.
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
            <div className="banner alert" role="alert" style={{ marginBottom: 14 }}>
              Este link é inválido, já foi usado ou expirou. Solicite uma nova recuperação de senha.
            </div>
            <Link
              to="/auth/esqueci-senha"
              className="auth-btn"
              style={{ display: "inline-block", textAlign: "center", lineHeight: "48px" }}
            >
              Solicitar novo link
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit(submit)}>
            <PasswordField
              id="nova-senha"
              label="Nova senha"
              visible={showPassword}
              toggle={() => setShowPassword((value) => !value)}
              error={errors.senha?.message}
              inputProps={register("senha")}
            />
            <PasswordField
              id="confirmar-nova-senha"
              label="Confirmar nova senha"
              visible={showConfirmation}
              toggle={() => setShowConfirmation((value) => !value)}
              error={errors.confirmarSenha?.message}
              inputProps={register("confirmarSenha")}
            />
            {submitError && (
              <div className="banner alert" role="alert" style={{ marginBottom: 14 }}>
                {submitError}
              </div>
            )}
            <button className="auth-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
      <div className="auth-copy">© 2026 CoteCerto · Supper</div>
    </div>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  visible: boolean;
  toggle: () => void;
  error?: string;
  inputProps: UseFormRegisterReturn;
};

function PasswordField({ id, label, visible, toggle, error, inputProps }: PasswordFieldProps) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-input">
        <svg>
          <use href="#i-lock" />
        </svg>
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          placeholder="mínimo 8 caracteres, letras e números"
          maxLength={72}
          {...inputProps}
        />
        <button
          className="pw-toggle"
          type="button"
          title="Mostrar/ocultar a senha"
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={toggle}
        >
          {visible ? (
            "OCULTAR"
          ) : (
            <svg>
              <use href="#i-eye" />
            </svg>
          )}
        </button>
      </div>
      {error && (
        <div className="banner alert" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
