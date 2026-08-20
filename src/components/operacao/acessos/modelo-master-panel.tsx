// Aba "Personalização geral" — Modelo Master (bloco EXTERNOS · rede), com a
// Campanha Elite Master (accModeloMaster()/ELITE_MASTER no protótipo v11).
// Categoria e faixa mínima são fixas — só o bônus é editável, igual ao
// protótipo (eliteTable()).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SenhaDiretorModal } from "@/components/acessos/senha-diretor-modal";
import { Icon } from "./icon";
import type { EliteRow, ModeloMasterConfig } from "./types";

const DEFAULT_ELITE: EliteRow[] = [
  ["Bronze", "≥ 200 mil", "5%"],
  ["Prata", "≥ 250 mil", "10%"],
  ["Ouro", "≥ 300 mil", "25%"],
  ["Platinum", "≥ 400 mil", "40%"],
  ["Elite", "≥ 500 mil", "50%"],
];

const DEFAULT_CONFIG: ModeloMasterConfig = {
  comissao_grupo: "20%",
  royalties: "5%",
  base_calc: "Comissão líquida da equipe (inclui renovações, menos estornos)",
  pagamento: "5º dia útil",
  elite: DEFAULT_ELITE,
};

export function ModeloMasterPanel({
  onToast,
}: {
  onToast: (msg: string, kind: "ok" | "alert") => void;
}) {
  const [config, setConfig] = useState<ModeloMasterConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("modelo_master_config")
        .select("comissao_grupo,royalties,base_calc,pagamento,elite")
        .eq("id", "default")
        .maybeSingle();
      if (data) {
        setConfig({
          comissao_grupo: data.comissao_grupo,
          royalties: data.royalties,
          base_calc: data.base_calc,
          pagamento: data.pagamento,
          elite: (data.elite as EliteRow[]) ?? DEFAULT_ELITE,
        });
      }
      setLoading(false);
    })();
  }, []);

  function patchElite(i: number, bonus: string) {
    setConfig((prev) => ({
      ...prev,
      elite: prev.elite.map((r, j) => (j === i ? ([r[0], r[1], bonus] as EliteRow) : r)),
    }));
  }

  async function salvarComSenha(senha: string): Promise<{ error: string | null }> {
    setBusy(true);
    const { error } = await supabase.rpc("fn_salvar_modelo_master", {
      p_senha: senha,
      p_comissao_grupo: config.comissao_grupo,
      p_royalties: config.royalties,
      p_base_calc: config.base_calc,
      p_pagamento: config.pagamento,
      p_elite: config.elite,
    });
    setBusy(false);
    if (error) return { error: error.message };
    onToast("Modelo Master atualizado", "ok");
    return { error: null };
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando Modelo Master…</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted small">
          <Icon id="info" size={13} /> Política do Master franqueado — supervisionado pela Matriz.
        </div>
        <button
          className="btn btn-slate btn-sm"
          disabled={busy}
          onClick={() => setConfirmando(true)}
        >
          <Icon id="check" size={13} /> Salvar política
        </button>
      </div>
      {confirmando && (
        <SenhaDiretorModal
          label="o Modelo Master"
          onConfirm={salvarComSenha}
          onClose={() => setConfirmando(false)}
        />
      )}
      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="percent" size={16} /> Comissão do Master
          </h3>
        </div>
        <div className="card-b">
          <div className="acc-grid">
            <div className="field-group">
              <label>% sobre a comissão da equipe</label>
              <input
                className="input"
                value={config.comissao_grupo}
                onChange={(e) => setConfig({ ...config, comissao_grupo: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>Royalties + FPP</label>
              <input
                className="input"
                value={config.royalties}
                onChange={(e) => setConfig({ ...config, royalties: e.target.value })}
              />
            </div>
            <div className="field-group full">
              <label>Base de cálculo</label>
              <input
                className="input"
                value={config.base_calc}
                onChange={(e) => setConfig({ ...config, base_calc: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>Pagamento</label>
              <input
                className="input"
                value={config.pagamento}
                onChange={(e) => setConfig({ ...config, pagamento: e.target.value })}
              />
            </div>
          </div>
          <div className="clt-note" style={{ marginTop: 12 }}>
            <Icon id="info" size={15} />
            <div>
              O Master recebe <strong>{config.comissao_grupo || "20%"}</strong> sobre a comissão
              líquida gerada pela equipe (franquias e vendedores),{" "}
              <strong>incluindo renovações</strong> da equipe e descontando estornos — como no
              fechamento de franquias.
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="award" size={16} /> Campanha Elite — Master
          </h3>
        </div>
        <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table-pipe acc-modelos">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Faixa mínima (trimestre)</th>
                <th>Bônus</th>
              </tr>
            </thead>
            <tbody>
              {config.elite.map((r, i) => (
                <tr key={r[0]}>
                  <td>
                    <strong>{r[0]}</strong>
                  </td>
                  <td>{r[1]}</td>
                  <td>
                    <input
                      className="input input-mini"
                      value={r[2]}
                      onChange={(e) => patchElite(i, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-b">
          <div className="muted small">
            <Icon id="info" size={13} /> Bônus trimestral sobre o faturamento das novas vendas da
            equipe de franqueados (ciclos: Abr–Jun · Jul–Set · Out–Dez).
          </div>
        </div>
      </div>
    </div>
  );
}
