// "Solicitações de desligamento" (V11 · C9) — Acessos e permissões (Matriz).
// Lista os pedidos pendentes de `desligamento_solicitacoes` (criados pelo
// grupo via xAcessos, C8) e resolve via `resolver_desligamento`. Aprovar
// EXECUTA o desligamento na mesma transação (excluir_cadastro_rede, C6) — se a
// trava de dependentes disparar, o erro sobe aqui e o pedido continua pendente.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";

type SolicitacaoPendente = {
  id: string;
  alvo_profile_id: string;
  solicitante_id: string;
  motivo: string;
  created_at: string;
};

export function DesligamentoSolicitacoesTab() {
  const [rows, setRows] = useState<SolicitacaoPendente[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<SolicitacaoPendente | null>(null);
  const [observacao, setObservacao] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from("desligamento_solicitacoes")
      .select("id,alvo_profile_id,solicitante_id,motivo,created_at")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    const pendentes = (data ?? []) as SolicitacaoPendente[];
    setRows(pendentes);

    const ids = Array.from(
      new Set(pendentes.flatMap((r) => [r.alvo_profile_id, r.solicitante_id])),
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", ids);
      setNomes(
        Object.fromEntries(
          ((profs ?? []) as { id: string; nome: string }[]).map((p) => [p.id, p.nome]),
        ),
      );
    } else {
      setNomes({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function aprovar(row: SolicitacaoPendente) {
    setBusyId(row.id);
    setErr(null);
    const { error } = await supabase.rpc("resolver_desligamento", {
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
    const { error } = await supabase.rpc("resolver_desligamento", {
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
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-h">
        <h3>
          <Icon id="clock" size={16} /> Solicitações de desligamento
        </h3>
        <span className="small muted">{rows.length} pendente(s)</span>
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
              <th>Alvo</th>
              <th>Motivo</th>
              <th>Solicitado por</th>
              <th>Enviado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="muted small" style={{ padding: 16 }}>
                  Carregando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}>
                  Nenhuma solicitação pendente.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{nomes[r.alvo_profile_id] ?? "—"}</strong>
                  </td>
                  <td>
                    <small className="muted">{r.motivo}</small>
                  </td>
                  <td>
                    <small className="muted">{nomes[r.solicitante_id] ?? "—"}</small>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn btn-yellow btn-sm"
                      disabled={busyId === r.id}
                      onClick={() => void aprovar(r)}
                    >
                      <Icon id="check" size={13} /> Aprovar
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
              <h3>Recusar desligamento — {nomes[recusando.alvo_profile_id] ?? ""}</h3>
              <div
                className="x"
                onClick={() => setRecusando(null)}
                role="button"
                aria-label="Fechar"
              >
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
