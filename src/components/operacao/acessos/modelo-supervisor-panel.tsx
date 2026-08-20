// Aba "Personalização geral" — Modelo Supervisor (bloco MATRIZ · time interno).
// "Config preservada": hoje o Supervisor (Matriz) não é comissionado em
// nenhum lugar do motor de comissão — a tela existe caso a regra volte a
// valer (accSupModelo()/accModeloSupervisor() no protótipo v11).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SenhaDiretorModal } from "@/components/acessos/senha-diretor-modal";
import { Icon } from "./icon";
import type { ModeloSupervisorConfig } from "./types";

const DEFAULT_CONFIG: ModeloSupervisorConfig = {
  comissao_grupo: "15%",
  royalties: "5%",
  base_calc: "Comissão líquida das franquias supervisionadas",
  pagamento: "5º dia útil",
};

export function ModeloSupervisorPanel({
  onToast,
}: {
  onToast: (msg: string, kind: "ok" | "alert") => void;
}) {
  const [config, setConfig] = useState<ModeloSupervisorConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("modelo_supervisor_config")
        .select("comissao_grupo,royalties,base_calc,pagamento")
        .eq("id", "default")
        .maybeSingle();
      if (data) setConfig(data);
      setLoading(false);
    })();
  }, []);

  async function salvarComSenha(senha: string): Promise<{ error: string | null }> {
    setBusy(true);
    const { error } = await supabase.rpc("fn_salvar_modelo_supervisor", {
      p_senha: senha,
      p_comissao_grupo: config.comissao_grupo,
      p_royalties: config.royalties,
      p_base_calc: config.base_calc,
      p_pagamento: config.pagamento,
    });
    setBusy(false);
    if (error) return { error: error.message };
    onToast("Padrão do Supervisor (Matriz) atualizado", "ok");
    return { error: null };
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando Modelo Supervisor…</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="audit-note">
        <Icon id="info" size={16} /> <strong>Config preservada.</strong> Hoje o Supervisor (Vendas e
        Operacional) é papel <strong>da Matriz</strong> e <strong>não é comissionado</strong>. Esta
        regra de comissão fica guardada aqui, caso volte a valer.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted small">
          <Icon id="info" size={13} /> Padrão dos Supervisores internos (Matriz) — espelho do
          Master, porém dentro de casa.
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
          label="o Modelo Supervisor"
          onConfirm={salvarComSenha}
          onClose={() => setConfirmando(false)}
        />
      )}
      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="percent" size={16} /> Padrão de comissão do Supervisor (Matriz)
          </h3>
        </div>
        <div className="card-b">
          <div className="acc-grid">
            <div className="field-group">
              <label>% sobre a comissão das franquias</label>
              <input
                className="input"
                placeholder="ex.: 15%"
                value={config.comissao_grupo}
                onChange={(e) => setConfig({ ...config, comissao_grupo: e.target.value })}
              />
            </div>
            <div className="field-group">
              <label>Royalties + FPP</label>
              <input
                className="input"
                placeholder="ex.: 5%"
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
              Cada Supervisor da Matriz pode ter <strong>regra própria</strong>: estes são os
              valores padrão, <strong>ajustáveis por pessoa</strong> na hora de classificar o
              acesso.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
