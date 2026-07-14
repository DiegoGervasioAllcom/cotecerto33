import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { cadastrarFranquia } from "@/lib/cadastro.functions";
import logoAsset from "@/assets/cotecerto-logo.png.asset.json";

export const Route = createFileRoute("/auth/cadastro")({
  head: () => ({ meta: [{ title: "Criar cadastro · CoteCerto" }] }),
  component: CadastroPage,
});

type Model = "cnpj" | "cpf";
type View = "model" | "form" | "success";

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "password";
  ph?: string;
  full?: boolean;
  required?: boolean;
};

const CNPJ_FIELDS: FieldDef[] = [
  {
    key: "nome",
    label: "Razão Social",
    type: "text",
    full: true,
    ph: "Empresa LTDA",
    required: true,
  },
  { key: "documento", label: "CNPJ", type: "text", ph: "00.000.000/0000-00", required: true },
  { key: "data_nascimento", label: "Data de nascimento (sócio)", type: "date" },
  {
    key: "endereco",
    label: "Endereço completo",
    type: "text",
    full: true,
    ph: "Rua, nº, bairro, cidade - UF, CEP",
  },
  {
    key: "socio_nome",
    label: "Nome do sócio operador",
    type: "text",
    full: true,
    ph: "Quem vai operar a franquia",
    required: true,
  },
  { key: "socio_cpf", label: "CPF do sócio operador", type: "text", ph: "000.000.000-00" },
  { key: "socio_rg", label: "RG do sócio operador", type: "text", ph: "00.000.000-0" },
  { key: "celular", label: "Celular", type: "tel", ph: "(11) 90000-0000" },
  { key: "telefone_recado", label: "Outro telefone / recado", type: "tel", ph: "(11) 90000-0000" },
  {
    key: "email",
    label: "E-mail",
    type: "email",
    full: true,
    ph: "voce@email.com",
    required: true,
  },
  {
    key: "pix_chave",
    label: "Chave Pix (conta PJ)",
    type: "text",
    full: true,
    ph: "CNPJ, e-mail, telefone ou chave aleatória",
  },
  {
    key: "dados_bancarios",
    label: "Banco / Agência / Conta (PJ)",
    type: "text",
    full: true,
    ph: "Banco 000 · Ag 0001 · CC 00000-0",
  },
  {
    key: "password",
    label: "Senha de acesso",
    type: "password",
    ph: "Mínimo 6 caracteres",
    required: true,
  },
];

const CPF_FIELDS: FieldDef[] = [
  { key: "nome", label: "Nome completo", type: "text", full: true, ph: "Seu nome", required: true },
  { key: "documento", label: "CPF", type: "text", ph: "000.000.000-00", required: true },
  { key: "rg", label: "RG", type: "text", ph: "00.000.000-0" },
  { key: "data_nascimento", label: "Data de nascimento", type: "date" },
  { key: "celular", label: "Celular", type: "tel", ph: "(11) 90000-0000" },
  {
    key: "endereco",
    label: "Endereço completo",
    type: "text",
    full: true,
    ph: "Rua, nº, bairro, cidade - UF, CEP",
  },
  { key: "telefone_recado", label: "Outro telefone / recado", type: "tel", ph: "(11) 90000-0000" },
  {
    key: "contato_emergencia",
    label: "Contato de emergência",
    type: "text",
    full: true,
    ph: "Nome e telefone do contato",
  },
  {
    key: "email",
    label: "E-mail",
    type: "email",
    full: true,
    ph: "voce@email.com",
    required: true,
  },
  {
    key: "pix_chave",
    label: "Chave Pix",
    type: "text",
    full: true,
    ph: "CPF, e-mail, telefone ou chave aleatória",
  },
  {
    key: "dados_bancarios",
    label: "Banco / Agência / Conta",
    type: "text",
    full: true,
    ph: "Banco 000 · Ag 0001 · CC 00000-0",
  },
  {
    key: "password",
    label: "Senha de acesso",
    type: "password",
    ph: "Mínimo 6 caracteres",
    required: true,
  },
];

function onlyDigits(s: string) {
  return s.replace(/\D+/g, "");
}

function maskFor(key: string, raw: string): string {
  const d = onlyDigits(raw);
  switch (key) {
    case "documento":
      // CPF (11) ou CNPJ (14)
      if (d.length <= 11) {
        return d
          .slice(0, 11)
          .replace(/^(\d{3})(\d)/, "$1.$2")
          .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/\.(\d{3})(\d)/, ".$1-$2");
      }
      return d
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    case "socio_cpf":
      return d
        .slice(0, 11)
        .replace(/^(\d{3})(\d)/, "$1.$2")
        .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    case "socio_rg":
    case "rg":
      return d
        .slice(0, 9)
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1-$2");
    case "celular":
    case "telefone_recado": {
      const t = d.slice(0, 11);
      if (t.length <= 10) {
        return t.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
      }
      return t.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    }
    default:
      return raw;
  }
}

function CadastroPage() {
  const navigate = useNavigate();
  const cadastrar = useServerFn(cadastrarFranquia);
  const [view, setView] = useState<View>("model");
  const [model, setModel] = useState<Model>("cnpj");
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => (model === "cnpj" ? CNPJ_FIELDS : CPF_FIELDS), [model]);

  function pick(m: Model) {
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

    const email = values.email?.trim();
    const password = values.password ?? "";
    if (!email || password.length < 6) {
      setError("Informe e-mail válido e senha com pelo menos 6 caracteres.");
      setSubmitting(false);
      return;
    }

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
        <img src={logoAsset.url} alt="CoteCerto" className="auth-logo" />
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
              <div className="auth-form">
                <div className="auth-grid">
                  {fields.map((f) => (
                    <div key={f.key} className={`auth-field${f.full ? " full" : ""}`}>
                      <label>
                        {f.label}
                        {f.required && <span className="req"> *</span>}
                      </label>
                      <div className="auth-input">
                        {f.type === "email" && (
                          <svg style={{ width: 16, height: 16, color: "#7A8794", flex: "none" }}>
                            <use href="#i-mail" />
                          </svg>
                        )}
                        {f.type === "password" && (
                          <svg style={{ width: 16, height: 16, color: "#7A8794", flex: "none" }}>
                            <use href="#i-lock" />
                          </svg>
                        )}
                        <input
                          type={f.type}
                          placeholder={f.ph || ""}
                          required={f.required}
                          minLength={f.type === "password" ? 6 : undefined}
                          inputMode={
                            [
                              "documento",
                              "socio_cpf",
                              "socio_rg",
                              "rg",
                              "celular",
                              "telefone_recado",
                            ].includes(f.key)
                              ? "numeric"
                              : undefined
                          }
                          value={values[f.key] || ""}
                          onChange={(e) => update(f.key, maskFor(f.key, e.target.value))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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
