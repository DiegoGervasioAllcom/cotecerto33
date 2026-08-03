// V11 · D7 (Frente 4) — sub-aba "Performance" em Personalização geral.
//
// Só interno/rede aqui — o bloco `full` já funciona no banco (D1-D6), mas a
// tela do franqueado Full (Central da Franquia) é da Frente 5, hoje travada
// por decisão pendente da Lis (ver PLANO_REGUA_V11.md). Salvar passa por
// `fn_salvar_regua_performance` (D2), que exige senha de diretor — daí o
// `SenhaDiretorModal`.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SenhaDiretorModal } from "@/components/acessos/senha-diretor-modal";
import { Icon } from "./icon";

type Bloco = "interno" | "rede";

type Regua = {
  janela_dias: number;
  conv_atencao_pct: number;
  conv_travado_pct: number;
  dias_atencao: number;
  dias_travado: number;
  cancelamentos_limite: number;
  pausa_leads_ativa: boolean;
  notifica_supervisor: boolean;
};

const BLOCO_LABEL: Record<Bloco, string> = {
  interno: "Vendedor Matriz (Modelo CLT)",
  rede: "Vendedor de rede / Franquia Individual",
};

export function PerformancePanel() {
  const [bloco, setBloco] = useState<Bloco>("interno");
  const [reguas, setReguas] = useState<Record<Bloco, Regua | null>>({
    interno: null,
    rede: null,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "alert" } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("regua_performance_config")
        .select(
          "bloco,janela_dias,conv_atencao_pct,conv_travado_pct,dias_atencao,dias_travado,cancelamentos_limite,pausa_leads_ativa,notifica_supervisor",
        )
        .in("bloco", ["interno", "rede"]);
      if (!ativo) return;
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      const map: Record<Bloco, Regua | null> = { interno: null, rede: null };
      for (const r of data ?? []) {
        map[r.bloco as Bloco] = {
          janela_dias: r.janela_dias,
          conv_atencao_pct: Number(r.conv_atencao_pct),
          conv_travado_pct: Number(r.conv_travado_pct),
          dias_atencao: r.dias_atencao,
          dias_travado: r.dias_travado,
          cancelamentos_limite: r.cancelamentos_limite,
          pausa_leads_ativa: r.pausa_leads_ativa,
          notifica_supervisor: r.notifica_supervisor,
        };
      }
      setReguas(map);
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  function patch(patch: Partial<Regua>) {
    setReguas((prev) => ({ ...prev, [bloco]: prev[bloco] ? { ...prev[bloco]!, ...patch } : null }));
  }

  const atual = reguas[bloco];

  async function salvarComSenha(senha: string): Promise<{ error: string | null }> {
    if (!atual) return { error: "Régua não carregada." };
    const { error } = await supabase.rpc("fn_salvar_regua_performance", {
      p_bloco: bloco,
      p_senha: senha,
      p_janela_dias: atual.janela_dias,
      p_conv_atencao_pct: atual.conv_atencao_pct,
      p_conv_travado_pct: atual.conv_travado_pct,
      p_dias_atencao: atual.dias_atencao,
      p_dias_travado: atual.dias_travado,
      p_cancelamentos_limite: atual.cancelamentos_limite,
      p_pausa_leads_ativa: atual.pausa_leads_ativa,
      p_notifica_supervisor: atual.notifica_supervisor,
    });
    if (error) return { error: error.message };
    setToast({ msg: `Régua de performance (${BLOCO_LABEL[bloco]}) atualizada`, kind: "ok" });
    return { error: null };
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando régua de performance…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="gauge" size={16} /> Régua de performance
        </h3>
      </div>
      {err && (
        <div className="card-b">
          <div className="banner alert">{err}</div>
        </div>
      )}
      <div className="card-b">
        <div className="muted small" style={{ marginBottom: 12 }}>
          <Icon id="info" size={13} /> Quem fica <strong>Travado</strong> pode parar de receber
          leads da distribuição automática (se "Pausar leads" estiver ativo) até revisão. Salvar
          exige confirmar com senha de diretor — a alteração entra no histórico imutável.
        </div>
        <div className="acc-pills" style={{ marginBottom: 16 }}>
          {(["interno", "rede"] as const).map((b) => (
            <button
              key={b}
              type="button"
              className={`acc-pill ${bloco === b ? "on" : ""}`}
              onClick={() => setBloco(b)}
            >
              {BLOCO_LABEL[b]}
            </button>
          ))}
        </div>

        {!atual ? (
          <div className="muted small">Régua deste bloco não encontrada.</div>
        ) : (
          <>
            <div className="acc-grid">
              <div className="field-group">
                <label>Janela (dias corridos)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={atual.janela_dias}
                  onChange={(e) => patch({ janela_dias: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label>Conversão mínima · Atenção (%)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={atual.conv_atencao_pct}
                  onChange={(e) => patch({ conv_atencao_pct: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label>Conversão mínima · Travado (%)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={atual.conv_travado_pct}
                  onChange={(e) => patch({ conv_travado_pct: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label>Dias sem venda · Atenção</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={atual.dias_atencao}
                  onChange={(e) => patch({ dias_atencao: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label>Dias sem venda · Travado</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={atual.dias_travado}
                  onChange={(e) => patch({ dias_travado: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label>Cancelamentos na janela (limite)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={atual.cancelamentos_limite}
                  onChange={(e) => patch({ cancelamentos_limite: Number(e.target.value) })}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              <label
                className="small"
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={atual.pausa_leads_ativa}
                  onChange={(e) => patch({ pausa_leads_ativa: e.target.checked })}
                />
                Pausar leads de quem está travado
              </label>
              <label
                className="small"
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={atual.notifica_supervisor}
                  onChange={(e) => patch({ notifica_supervisor: e.target.checked })}
                />
                Notificar supervisor ao travar
              </label>
            </div>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-slate btn-sm"
                type="button"
                onClick={() => setConfirmando(true)}
              >
                <Icon id="check" size={13} /> Salvar régua ({BLOCO_LABEL[bloco]})
              </button>
            </div>
          </>
        )}
      </div>

      {confirmando && (
        <SenhaDiretorModal
          label={`a régua de performance · ${BLOCO_LABEL[bloco]}`}
          onConfirm={salvarComSenha}
          onClose={() => setConfirmando(false)}
        />
      )}

      {toast && (
        <div
          className={`toast ${toast.kind === "ok" ? "toast-ok" : "toast-alert"}`}
          style={{
            position: "fixed",
            right: 22,
            bottom: 22,
            background: toast.kind === "ok" ? "var(--ok)" : "var(--alert)",
            color: "#fff",
            padding: "12px 18px",
            borderRadius: 10,
            boxShadow: "var(--shadow-lg)",
            zIndex: 80,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
