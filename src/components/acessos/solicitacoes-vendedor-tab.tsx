// Aba "Solicitações de vendedor" (G1.6c) — Acessos e permissões (Matriz).
// Lista os pedidos pendentes de `vendedor_solicitacoes` (criados pelo grupo
// via xAcessos) e permite aprovar/recusar via `resolver_solicitacao_vendedor`.
// A criação efetiva do usuário reusa o fluxo já existente de "Usuários" —
// esta tela só resolve o pedido, não cria o profile/auth.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";
import { maskCpfCnpj, maskTelefone } from "@/lib/masks";

type SolicitacaoPendente = {
  id: string;
  nome: string;
  cpf: string | null;
  celular: string | null;
  email: string | null;
  created_at: string;
  solicitante_id: string;
  empresa_id: string | null;
};

export function SolicitacoesVendedorTab() {
  const [rows, setRows] = useState<SolicitacaoPendente[]>([]);
  const [solicitanteNomes, setSolicitanteNomes] = useState<Record<string, string>>({});
  const [empresaNomes, setEmpresaNomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<SolicitacaoPendente | null>(null);
  const [observacao, setObservacao] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("vendedor_solicitacoes")
      .select("id,nome,cpf,celular,email,created_at,solicitante_id,empresa_id")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    const pendentes = (data ?? []) as SolicitacaoPendente[];
    setRows(pendentes);

    const solicitanteIds = Array.from(new Set(pendentes.map((r) => r.solicitante_id)));
    const empresaIds = Array.from(
      new Set(pendentes.map((r) => r.empresa_id).filter((v): v is string => !!v)),
    );
    const [pr, em] = await Promise.all([
      solicitanteIds.length > 0
        ? supabase.from("profiles").select("id,nome").in("id", solicitanteIds)
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
      empresaIds.length > 0
        ? supabase.from("empresas").select("id,nome").in("id", empresaIds)
        : Promise.resolve({ data: [] as { id: string; nome: string }[] }),
    ]);
    setSolicitanteNomes(
      Object.fromEntries(
        ((pr.data ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]),
      ),
    );
    setEmpresaNomes(
      Object.fromEntries(
        ((em.data ?? []) as { id: string; nome: string }[]).map((e) => [e.id, e.nome]),
      ),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function aprovar(row: SolicitacaoPendente) {
    setBusyId(row.id);
    setErr(null);
    const { error } = await supabase.rpc("resolver_solicitacao_vendedor", {
      p_id: row.id,
      p_aprovar: true,
    });
    setBusyId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await reload();
  }

  function abrirRecusar(row: SolicitacaoPendente) {
    setRecusando(row);
    setObservacao("");
  }

  async function confirmarRecusar() {
    if (!recusando) return;
    setBusyId(recusando.id);
    setErr(null);
    const { error } = await supabase.rpc("resolver_solicitacao_vendedor", {
      p_id: recusando.id,
      p_aprovar: false,
      p_observacao: observacao.trim() || undefined,
    });
    setBusyId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    setRecusando(null);
    await reload();
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="clock" size={16} /> Solicitações de vendedor
        </h3>
        <span className="small muted">{rows.length} pendente(s)</span>
      </div>
      <div className="clt-note" style={{ margin: "0 16px 12px" }}>
        <Icon id="info" size={15} />
        <div>
          Após aprovar, crie o acesso do vendedor em <strong>Usuários</strong> usando os dados
          abaixo — a aprovação aqui só libera o pedido, não cria o usuário.
        </div>
      </div>

      {err && (
        <div className="banner alert" style={{ margin: "0 16px 12px" }}>
          {err}
        </div>
      )}

      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th>CPF</th>
              <th>Celular</th>
              <th>E-mail</th>
              <th>Solicitado por</th>
              <th>Rede</th>
              <th>Enviado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="muted small" style={{ padding: 16 }}>
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                  Nenhuma solicitação pendente.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.nome}</strong>
                  </td>
                  <td>{r.cpf ? maskCpfCnpj(r.cpf) : "—"}</td>
                  <td>{r.celular ? maskTelefone(r.celular) : "—"}</td>
                  <td>{r.email ?? "—"}</td>
                  <td>
                    <small className="muted">{solicitanteNomes[r.solicitante_id] ?? "—"}</small>
                  </td>
                  <td>
                    <small className="muted">
                      {r.empresa_id ? (empresaNomes[r.empresa_id] ?? "—") : "—"}
                    </small>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-yellow btn-sm"
                      disabled={busyId === r.id}
                      onClick={() => void aprovar(r)}
                    >
                      <Icon id="check-circle" size={13} /> Aprovar
                    </button>{" "}
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busyId === r.id}
                      onClick={() => abrirRecusar(r)}
                    >
                      <Icon id="trash" size={13} /> Recusar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {recusando && (
        <div
          className="modal-host"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRecusando(null);
          }}
        >
          <div className="modal">
            <div className="modal-h">
              <Icon id="trash" size={18} />
              <h3>Recusar solicitação — {recusando.nome}</h3>
              <div className="x" onClick={() => setRecusando(null)}>
                <Icon id="x" size={18} />
              </div>
            </div>
            <div className="modal-b">
              <div className="field-group full">
                <label>Observação (opcional)</label>
                <textarea
                  className="input"
                  rows={3}
                  maxLength={500}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Motivo da recusa…"
                />
              </div>
            </div>
            <div className="modal-f">
              <button className="btn btn-ghost" onClick={() => setRecusando(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-yellow"
                disabled={busyId === recusando.id}
                onClick={() => void confirmarRecusar()}
              >
                Confirmar recusa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
