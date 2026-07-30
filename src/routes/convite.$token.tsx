import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { cadastrarPorConvite } from "@/lib/convite.functions";
import { camposDoModelo, type ModeloCadastro } from "@/lib/cadastro-campos";
import { CamposCadastro } from "@/components/auth/campos-cadastro";
import { cnpjCadastroSchema, cpfCadastroSchema } from "@/lib/schemas/cadastro.schema";
import logoUrl from "@/assets/cotecerto-logo.png";

/**
 * Rota do Convite Supper (V11 · C7/C8) — item 1 do Handoff de Produção.
 *
 * "O link abre o cadastro já identificado": a tela mostra quem convidou, e o
 * perfil e o vínculo aparecem em TEXTO FIXO — quem recebe não altera. Se estiver
 * errado, pede outro convite. Isso não é só UX: é o que garante que o pedido
 * chegue na fila já classificado, para a aprovação confirmar em vez de adivinhar.
 *
 * O texto fixo é apresentação, não segurança — `cadastrarPorConvite` revalida o
 * token no servidor e deriva dele o tipo de pessoa e a classificação.
 */
export const Route = createFileRoute("/convite/$token")({
  head: () => ({ meta: [{ title: "Convite Supper · CoteCerto" }] }),
  component: ConvitePage,
});

type Convite = {
  ok: boolean;
  motivo?: "expirado" | "usado" | "inexistente";
  codigo?: string;
  nome?: string;
  trilha?: "interno" | "externo";
  perfil?: string | null;
  cargo_id?: string | null;
  cargo_nome?: string | null;
  vinc_tipo?: "matriz" | "master" | "full";
  vinc_nome?: string;
  convidado_por?: string;
  expira_em?: string;
};

/** Rótulo do tipo declarado, no formato "TÍTULO | qualificador" do protótipo. */
function rotuloPerfil(c: Convite): string {
  if (c.trilha === "interno") {
    return c.cargo_nome ? `Matriz | ${c.cargo_nome}` : "Matriz | Vendedor Matriz (Modelo CLT)";
  }
  switch (c.perfil) {
    case "master":
      return "Master | franqueado";
    case "franquia_full":
      return "Franquia | Full";
    case "franquia_indiv":
      return "Franquia | Individual";
    case "vendedor":
      return c.vinc_tipo === "full" ? "Vendedor | Full" : "Vendedor | Master";
    default:
      return "—";
  }
}

const MOTIVO_TITULO: Record<string, string> = {
  expirado: "Convite expirado",
  usado: "Convite já utilizado",
  inexistente: "Convite não encontrado",
};

const MOTIVO_TEXTO: Record<string, string> = {
  expirado:
    "Este link tinha prazo de validade e já passou. Peça um convite novo a quem te convidou — leva um minuto.",
  usado:
    "Este convite é de uso único e já foi usado para criar um cadastro. Se não foi você, avise quem te convidou.",
  inexistente:
    "Não encontramos este convite. Confira se o link veio completo, sem quebra de linha, ou peça um novo.",
};

function ConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const enviar = useServerFn(cadastrarPorConvite);

  const [convite, setConvite] = useState<Convite | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase.rpc("abrir_convite", { p_token: token }).then(({ data, error: e }) => {
      if (!ativo) return;
      if (e) setConvite({ ok: false, motivo: "inexistente" });
      else setConvite(data as unknown as Convite);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [token]);

  // Mesma derivação do servidor (e do `authPerfilNext` do protótipo): time
  // interno e vendedor são pessoa física; franquias e Master, jurídica.
  const modelo: ModeloCadastro = useMemo(() => {
    if (!convite?.ok) return "cpf";
    return convite.trilha === "interno" || convite.perfil === "vendedor" ? "cpf" : "cnpj";
  }, [convite]);

  const fields = useMemo(() => camposDoModelo(modelo), [modelo]);

  // O nome do convite é nominal: já vem preenchido, mas continua editável porque
  // o convite carrega o nome como quem convidou digitou (pode faltar sobrenome).
  useEffect(() => {
    if (convite?.ok && convite.nome) {
      setValues((p) => (p.nome ? p : { ...p, nome: convite.nome! }));
    }
  }, [convite]);

  // A máscara é aplicada por CamposCadastro; aqui só guardamos o valor.
  function update(k: string, v: string) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const schema = modelo === "cnpj" ? cnpjCadastroSchema : cpfCadastroSchema;
    const result = schema.safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Dados inválidos.");
      setSubmitting(false);
      return;
    }

    const { password: _p, email: _e, nome: _n, documento: _d, tipo: _t, ...extras } = values;
    try {
      await enviar({
        data: {
          token,
          email: values.email?.trim() ?? "",
          password: values.password ?? "",
          nome: values.nome,
          documento: values.documento,
          extras,
        },
      });
      setEnviado(true);
    } catch (err: unknown) {
      setError((err instanceof Error && err.message) || "Falha ao enviar o cadastro.");
    } finally {
      setSubmitting(false);
    }
  }

  if (carregando) {
    return (
      <div className="auth-stage">
        <div className="auth-bg" />
        <div className="auth-brand">
          <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
        </div>
        <div className="auth-card">
          <p className="lead">Verificando seu convite…</p>
        </div>
      </div>
    );
  }

  // C8 — link expirado, reusado ou inexistente: erro amigável e o caminho de
  // pedir um novo. O Handoff pede exatamente isso no critério de aceite.
  if (!convite?.ok) {
    const motivo = convite?.motivo ?? "inexistente";
    return (
      <div className="auth-stage">
        <div className="auth-bg" />
        <div className="auth-brand">
          <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
        </div>
        <div className="auth-h">
          <h2>{MOTIVO_TITULO[motivo]}</h2>
          <p>Nada foi criado — seus dados não chegaram a ser enviados.</p>
        </div>
        <div className="auth-card">
          <p className="lead">{MOTIVO_TEXTO[motivo]}</p>
          <div className="clt-note" style={{ marginTop: 12 }}>
            <div>
              <strong>Como pedir um novo:</strong> fale com quem te enviou este link — a Matriz, o
              seu Master ou a sua franquia. O convite é nominal, então precisa ser gerado novamente
              no seu nome.
            </div>
          </div>
          <Link to="/auth" className="auth-back" style={{ marginTop: 14 }}>
            Ir para o login
          </Link>
        </div>
        <div className="auth-copy">© 2026 CoteCerto · Supper</div>
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="auth-stage">
        <div className="auth-bg" />
        <div className="auth-brand">
          <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
        </div>
        <div className="auth-h">
          <h2>Cadastro enviado</h2>
          <p>Seu pedido entrou na fila de aprovação.</p>
        </div>
        <div className="auth-card">
          <p className="lead">
            Quem te convidou já sabe do seu pedido. Assim que ele for aprovado, você recebe a
            confirmação no e-mail que cadastrou.
          </p>
          <button className="auth-btn" type="button" onClick={() => navigate({ to: "/auth" })}>
            Ir para o login
          </button>
        </div>
        <div className="auth-copy">© 2026 CoteCerto · Supper</div>
      </div>
    );
  }

  const fixoStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 14,
    padding: "11px 13px",
    background: "#f4f6f8",
    borderRadius: 10,
    border: "1px solid var(--border-soft)",
  };

  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
      </div>

      <div className="auth-h">
        <h2>Complete o seu cadastro</h2>
        <p>
          Você foi convidado por <strong>{convite.convidado_por}</strong>
        </p>
      </div>

      <div className="auth-card">
        {/* Perfil e vínculo em texto fixo: quem recebe confere, não escolhe. */}
        <div className="auth-field">
          <label>Perfil do convite</label>
          <div style={fixoStyle} data-testid="convite-perfil">
            {rotuloPerfil(convite)}
          </div>
        </div>
        <div className="auth-field">
          <label>Vínculo</label>
          <div style={fixoStyle} data-testid="convite-vinculo">
            {convite.vinc_nome}
          </div>
        </div>
        <div className="clt-note" style={{ margin: "10px 0 16px" }}>
          <div>
            Perfil e vínculo vêm do convite <strong>{convite.codigo}</strong> e não são editáveis.
            Se algo aí estiver errado, peça um convite novo antes de enviar.
          </div>
        </div>

        <form onSubmit={submit}>
          <CamposCadastro fields={fields} values={values} onChange={update} />

          {error && (
            <div className="banner alert" role="alert" style={{ marginTop: 14, fontSize: 12.5 }}>
              {error}
            </div>
          )}

          <button
            className="auth-btn"
            type="submit"
            disabled={submitting}
            style={{ marginTop: 16 }}
          >
            {submitting ? "Enviando…" : "Enviar cadastro"}
          </button>
        </form>
      </div>
      <div className="auth-copy">© 2026 CoteCerto · Supper</div>
    </div>
  );
}
