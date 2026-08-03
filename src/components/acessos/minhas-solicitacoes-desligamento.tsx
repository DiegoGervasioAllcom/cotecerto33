// "Minhas solicitações de desligamento" (V11 · C8) — xAcessos (visão de grupo).
// Espelha "Minhas solicitações" de CadastrarVendedorForm: mesma RLS
// (desligamento_solicitacoes_select libera pro próprio solicitante_id) já
// devolve só os pedidos de quem está logado — sem filtro extra no client.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/operacao/acessos/icon";
import { supabase } from "@/integrations/supabase/client";

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

type Pedido = {
  id: string;
  alvo_profile_id: string;
  motivo: string;
  status: string;
  observacao: string | null;
  created_at: string;
};

export function MinhasSolicitacoesDesligamento({ reloadKey }: { reloadKey: number }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("desligamento_solicitacoes")
      .select("id,alvo_profile_id,motivo,status,observacao,created_at")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Pedido[];
    setPedidos(rows);
    const alvoIds = Array.from(new Set(rows.map((r) => r.alvo_profile_id)));
    if (alvoIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", alvoIds);
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
  }, [reload, reloadKey]);

  if (!loading && pedidos.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-h">
        <h3>
          <Icon id="clock" size={16} /> Minhas solicitações de desligamento
        </h3>
      </div>
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Cadastro</th>
              <th>Motivo</th>
              <th>Status</th>
              <th>Enviado em</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="muted small" style={{ padding: 16 }}>
                  Carregando…
                </td>
              </tr>
            ) : (
              pedidos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{nomes[p.alvo_profile_id] ?? "—"}</strong>
                  </td>
                  <td>
                    <small className="muted">{p.motivo}</small>
                    {p.observacao && <div className="small muted">Matriz: {p.observacao}</div>}
                  </td>
                  <td>
                    <span className={`chip ${STATUS_CHIP[p.status] ?? "chip-outline"}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
