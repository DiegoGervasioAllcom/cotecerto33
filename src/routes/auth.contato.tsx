import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import logoUrl from "@/assets/cotecerto-logo.png";
import { enviarContatoMatriz } from "@/lib/contato.functions";
import { TEMAS_CONTATO } from "@/lib/schemas/contato.schema";

/**
 * "Fale com a Cote Certo" (V11 · C13) — `#av-contato` do protótipo. Rota
 * pública própria, no mesmo padrão das outras views de auth (`/auth/cadastro`,
 * `/auth/pendente`): cada `auth-view` do protótipo é uma rota aqui, não um
 * estado de modal dentro de `/auth`.
 */

export const Route = createFileRoute("/auth/contato")({
  head: () => ({ meta: [{ title: "Fale com a Cote Certo" }] }),
  component: ContatoPage,
});

const CAMPOS_VAZIOS = { nome: "", email: "", tema: "", mensagem: "" };

function ContatoPage() {
  const enviar = useServerFn(enviarContatoMatriz);
  const [campos, setCampos] = useState(CAMPOS_VAZIOS);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function update(key: keyof typeof CAMPOS_VAZIOS, value: string) {
    setCampos((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await enviar({
        data: {
          nome: campos.nome,
          email: campos.email,
          tema: campos.tema as (typeof TEMAS_CONTATO)[number],
          mensagem: campos.mensagem,
        },
      });
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar sua mensagem.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoUrl} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-h">
        <h2>Fale com a Cote Certo</h2>
        <p>
          O acesso é por convite — deixe sua mensagem que a equipe da Matriz responde por e-mail
        </p>
      </div>
      <div className="auth-card">
        {enviado ? (
          <>
            <p className="lead">
              Mensagem enviada! Seu contato — tema <strong>{campos.tema}</strong> — foi encaminhado
              por e-mail para a equipe da Matriz. A resposta chega em{" "}
              <strong>{campos.email}</strong>.
            </p>
            <Link to="/auth" className="auth-back" style={{ marginTop: 14 }}>
              Voltar ao login
            </Link>
          </>
        ) : (
          <>
            <Link to="/auth" className="auth-back">
              Voltar ao login
            </Link>
            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label>Seu nome</label>
                <div className="auth-input">
                  <input
                    type="text"
                    placeholder="Nome completo"
                    required
                    value={campos.nome}
                    onChange={(e) => update("nome", e.target.value)}
                  />
                </div>
              </div>
              <div className="auth-field">
                <label>Seu e-mail</label>
                <div className="auth-input">
                  <input
                    type="email"
                    placeholder="voce@email.com"
                    required
                    value={campos.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </div>
              </div>
              <div className="auth-field">
                <label>Tema</label>
                <div className="auth-input">
                  <select
                    required
                    value={campos.tema}
                    onChange={(e) => update("tema", e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {TEMAS_CONTATO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="auth-field">
                <label>Mensagem</label>
                <div
                  className="auth-input"
                  style={{
                    height: "auto",
                    minHeight: 96,
                    padding: "10px 13px",
                    alignItems: "stretch",
                  }}
                >
                  <textarea
                    rows={4}
                    placeholder="Conte o que você precisa"
                    required
                    value={campos.mensagem}
                    onChange={(e) => update("mensagem", e.target.value)}
                    style={{
                      border: 0,
                      background: "transparent",
                      outline: 0,
                      width: "100%",
                      fontSize: 14,
                      color: "#1E2A33",
                      fontFamily: "inherit",
                      resize: "vertical",
                      lineHeight: 1.5,
                    }}
                  />
                </div>
              </div>
              {erro && (
                <div className="banner alert" style={{ marginBottom: 14, fontSize: 12.5 }}>
                  {erro}
                </div>
              )}
              <button className="auth-btn" type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar mensagem"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
