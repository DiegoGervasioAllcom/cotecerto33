// Form "Cadastrar vendedor" (G1.6c) — xAcessos (visão de grupo).
// Envia um pedido para a Matriz aprovar via RPC `solicitar_vendedor`;
// não cria o usuário diretamente (isso reusa o fluxo de criação de usuário
// já existente, feito pela Matriz após aprovar).
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";
import { maskCpfCnpj, maskTelefone } from "@/lib/masks";
import {
  validarVendedorSolicitacao,
  type VendedorSolicitacaoErrors,
  type VendedorSolicitacaoFields,
} from "@/lib/schemas/vendedor-solicitacao.schema";

const EMPTY_FIELDS: VendedorSolicitacaoFields = {
  nome: "",
  cpf: "",
  celular: "",
  email: "",
};

const STATUS_CHIP: Record<string, string> = {
  pendente: "chip-yellow",
  aprovada: "chip-ok",
  recusada: "chip-outline",
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  recusada: "Recusada",
};

type Solicitacao = {
  id: string;
  nome: string;
  cpf: string | null;
  celular: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

export function CadastrarVendedorForm() {
  const [fields, setFields] = useState<VendedorSolicitacaoFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<VendedorSolicitacaoErrors>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);

  const reload = useCallback(async () => {
    setLoadingLista(true);
    const { data, error } = await supabase
      .from("vendedor_solicitacoes")
      .select("id,nome,cpf,celular,email,status,created_at")
      .order("created_at", { ascending: false });
    if (!error) setSolicitacoes((data ?? []) as Solicitacao[]);
    setLoadingLista(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(t);
  }, [feedback]);

  function update<K extends keyof VendedorSolicitacaoFields>(
    key: K,
    value: VendedorSolicitacaoFields[K],
  ) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function submit() {
    const validation = validarVendedorSolicitacao(fields);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.rpc("solicitar_vendedor", {
      p_nome: fields.nome.trim(),
      p_cpf: fields.cpf.trim() || undefined,
      p_celular: fields.celular.trim() || undefined,
      p_email: fields.email.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      setFeedback({ msg: error.message, kind: "alert" });
      return;
    }
    setFeedback({
      msg: "Cadastro enviado para aprovação da Matriz.",
      kind: "ok",
    });
    setFields(EMPTY_FIELDS);
    await reload();
  }

  return (
    <div className="detail-grid">
      <div className="col">
        <div className="card">
          <div className="card-h">
            <h3>
              <Icon id="user" size={16} /> Cadastrar vendedor
            </h3>
          </div>
          <div className="card-b">
            <div className="acc-grid">
              <div className="field-group full">
                <label>Nome completo</label>
                <input
                  className="input"
                  placeholder="Nome do vendedor"
                  value={fields.nome}
                  maxLength={150}
                  onChange={(e) => update("nome", e.target.value)}
                />
                {errors.nome && <small style={{ color: "var(--alert)" }}>{errors.nome}</small>}
              </div>
              <div className="field-group">
                <label>CPF</label>
                <input
                  className="input"
                  placeholder="000.000.000-00"
                  value={fields.cpf}
                  maxLength={14}
                  onChange={(e) => update("cpf", maskCpfCnpj(e.target.value))}
                />
                {errors.cpf && <small style={{ color: "var(--alert)" }}>{errors.cpf}</small>}
              </div>
              <div className="field-group">
                <label>Celular</label>
                <input
                  className="input"
                  placeholder="(11) 90000-0000"
                  value={fields.celular}
                  maxLength={20}
                  onChange={(e) => update("celular", maskTelefone(e.target.value))}
                />
                {errors.celular && (
                  <small style={{ color: "var(--alert)" }}>{errors.celular}</small>
                )}
              </div>
              <div className="field-group full">
                <label>E-mail</label>
                <input
                  className="input"
                  placeholder="voce@email.com"
                  value={fields.email}
                  maxLength={150}
                  onChange={(e) => update("email", e.target.value)}
                />
                {errors.email && <small style={{ color: "var(--alert)" }}>{errors.email}</small>}
              </div>
            </div>
            <div className="clt-note">
              <Icon id="info" size={15} />
              <div>
                Ao enviar, o cadastro vai para a <strong>matriz</strong> aprovar. Só após a
                aprovação o vendedor ganha acesso e entra na sua base.
              </div>
            </div>
            {feedback && (
              <div
                className={feedback.kind === "alert" ? "banner alert" : undefined}
                style={
                  feedback.kind === "ok"
                    ? {
                        marginTop: 12,
                        background: "var(--ok)",
                        color: "#fff",
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontWeight: 600,
                        fontSize: 13,
                      }
                    : { marginTop: 12 }
                }
              >
                {feedback.msg}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button className="btn btn-yellow" disabled={busy} onClick={() => void submit()}>
                <Icon id="send" size={14} /> {busy ? "Enviando…" : "Enviar para a matriz"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="col">
        <div className="card">
          <div className="card-h">
            <h3>
              <Icon id="clock" size={16} /> Minhas solicitações
            </h3>
          </div>
          <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
            <table className="table-pipe">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Documento</th>
                  <th>E-mail</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingLista ? (
                  <tr>
                    <td colSpan={4} className="muted small" style={{ padding: 16 }}>
                      Carregando…
                    </td>
                  </tr>
                ) : solicitacoes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted small" style={{ padding: 16 }}>
                      Nenhum cadastro enviado ainda.
                    </td>
                  </tr>
                ) : (
                  solicitacoes.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.nome}</strong>
                        <div className="small muted">
                          {new Date(s.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </td>
                      <td>{s.cpf ? maskCpfCnpj(s.cpf) : "—"}</td>
                      <td>{s.email ?? "—"}</td>
                      <td>
                        <span className={`chip ${STATUS_CHIP[s.status] ?? "chip-outline"}`}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
