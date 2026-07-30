import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { cadastrarFranquia } from "@/lib/cadastro.functions";
import logoUrl from "@/assets/cotecerto-logo.png";
import { camposDoModelo, type ModeloCadastro } from "@/lib/cadastro-campos";
import { CamposCadastro } from "@/components/auth/campos-cadastro";
import { cnpjCadastroSchema, cpfCadastroSchema } from "@/lib/schemas/cadastro.schema";

export const Route = createFileRoute("/auth/cadastro")({
  head: () => ({ meta: [{ title: "Criar cadastro · CoteCerto" }] }),
  component: CadastroPage,
});

type View = "model" | "form" | "success";

function CadastroPage() {
  const navigate = useNavigate();
  const cadastrar = useServerFn(cadastrarFranquia);
  const [view, setView] = useState<View>("model");
  const [model, setModel] = useState<ModeloCadastro>("cnpj");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => camposDoModelo(model), [model]);

  function pick(m: ModeloCadastro) {
    setModel(m);
    setValues({});
    setError(null);
    setView("form");
  }

  function update(k: string, v: string) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const schema = model === "cnpj" ? cnpjCadastroSchema : cpfCadastroSchema;
    const result = schema.safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Dados inválidos.");
      setSubmitting(false);
      return;
    }

    const email = values.email?.trim() ?? "";
    const password = values.password ?? "";

    const { password: _pwd, email: _em, nome: _n, documento: _d, tipo: _t, ...extras } = values;

    try {
      await cadastrar({
        data: {
          email,
          password,
          tipo: model === "cnpj" ? "pj" : "pf",
          nome: values.nome,
          documento: values.documento,
          extras,
        },
      });
      setView("success");
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || "Falha ao enviar cadastro.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = model === "cnpj" ? "Cadastro · Pessoa Jurídica" : "Cadastro · Pessoa Física";
  const successLead =
    model === "cpf"
      ? "Seu acesso ainda não está liberado. A matriz vai analisar seus dados e definir seu perfil de acesso e permissões."
      : "Seu acesso ainda não está liberado. A matriz vai analisar seus dados e classificar sua franquia — modelo, comissões e permissões.";

  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
      </div>

      {view === "model" && (
        <>
          <div className="auth-h">
            <h2>Criar seu cadastro</h2>
            <p>Como você vai atuar na Supper?</p>
          </div>
          <div className="auth-card">
            <Link to="/auth" className="auth-back">
              <svg>
                <use href="#i-chevron-left" />
              </svg>{" "}
              Voltar ao login
            </Link>
            <h3>Escolha o modelo de cadastro</h3>
            <p className="lead">Selecione o tipo de pessoa para o cadastro correto.</p>
            <div className="auth-models">
              <button className="auth-model" type="button" onClick={() => pick("cnpj")}>
                <span className="mi">
                  <svg>
                    <use href="#i-building" />
                  </svg>
                </span>
                <span>
                  <b>Pessoa Jurídica · CNPJ</b>
                  <span>Franquia / empresa com CNPJ próprio</span>
                </span>
              </button>
              <button className="auth-model" type="button" onClick={() => pick("cpf")}>
                <span className="mi">
                  <svg>
                    <use href="#i-user" />
                  </svg>
                </span>
                <span>
                  <b>Pessoa Física · CPF</b>
                  <span>Vendedor / profissional pessoa física</span>
                </span>
              </button>
            </div>
          </div>
          <div className="auth-copy">© 2026 CoteCerto · Supper. Todos os direitos reservados.</div>
        </>
      )}

      {view === "form" && (
        <>
          <div className="auth-h">
            <h2>{title}</h2>
            <p>Preencha seus dados para análise</p>
          </div>
          <div className="auth-card">
            <button className="auth-back" type="button" onClick={() => setView("model")}>
              <svg>
                <use href="#i-chevron-left" />
              </svg>{" "}
              Trocar modelo
            </button>
            <form onSubmit={submit}>
              <CamposCadastro fields={fields} values={values} onChange={update} />

              {error && (
                <div className="banner alert" style={{ marginTop: 14, fontSize: 12.5 }}>
                  {error}
                </div>
              )}

              <div style={{ height: 14 }} />
              <button className="auth-btn slate" type="submit" disabled={submitting}>
                {submitting ? "Enviando…" : "Enviar cadastro"}
              </button>
            </form>
          </div>
        </>
      )}

      {view === "success" && (
        <div className="auth-card auth-success">
          <div className="sx">
            <svg>
              <use href="#i-check" />
            </svg>
          </div>
          <h3>Cadastro enviado com sucesso!</h3>
          <p>{successLead}</p>
          <div className="auth-note">
            <svg>
              <use href="#i-mail" />
            </svg>
            <span>
              Você receberá <strong>por e-mail</strong> a confirmação da liberação de acesso assim
              que a matriz autorizar sua entrada. Qualquer dúvida, fale diretamente com a{" "}
              <strong>matriz</strong>.
            </span>
          </div>
          <button className="auth-btn" type="button" onClick={() => navigate({ to: "/auth" })}>
            Voltar ao login
          </button>
        </div>
      )}
    </div>
  );
}
