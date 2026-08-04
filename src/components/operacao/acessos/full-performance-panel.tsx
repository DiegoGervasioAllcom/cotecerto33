// V11.5b.4 — Aba "Performance" da Franquia Full: a régua própria do time.
//
// Diferente de `PerformancePanel` (D7, blocos interno/rede): aqui NÃO existe
// `SenhaDiretorModal` — a Full nunca é diretora — e NÃO existe o toggle
// "Notificar o supervisor" (r41: `perfRulesCard('full')` omite esse campo de
// propósito, não é esquecimento). Salvar chama `fn_salvar_regua_performance_full`
// (V11.5b.2) direto, com gate por identidade no banco (franqueado dono da
// empresa + modalidade Full via `fn_bloco_performance`).
//
// O bloco `'full'` é UMA LINHA COMPARTILHADA em `regua_performance_config`
// (D1) — não uma linha por empresa: qualquer Full que salvar muda o critério
// de todas as Fulls ao mesmo tempo (mesmo comportamento de D2 para os outros
// blocos). O aviso abaixo deixa isso explícito para quem está editando.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "./icon";

type Regua = {
  janela_dias: number;
  conv_atencao_pct: number;
  conv_travado_pct: number;
  dias_atencao: number;
  dias_travado: number;
  cancelamentos_limite: number;
  pausa_leads_ativa: boolean;
};

const REGUA_KEY = ["regua-performance-full"];

export function FullPerformancePanel({ empresaId }: { empresaId: string }) {
  const queryClient = useQueryClient();
  const [rascunho, setRascunho] = useState<Regua | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const query = useQuery({
    queryKey: REGUA_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regua_performance_config")
        .select(
          "janela_dias,conv_atencao_pct,conv_travado_pct,dias_atencao,dias_travado,cancelamentos_limite,pausa_leads_ativa",
        )
        .eq("bloco", "full")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        janela_dias: data.janela_dias,
        conv_atencao_pct: Number(data.conv_atencao_pct),
        conv_travado_pct: Number(data.conv_travado_pct),
        dias_atencao: data.dias_atencao,
        dias_travado: data.dias_travado,
        cancelamentos_limite: data.cancelamentos_limite,
        pausa_leads_ativa: data.pausa_leads_ativa,
      } as Regua;
    },
  });

  const atual = rascunho ?? query.data ?? null;

  function patch(p: Partial<Regua>) {
    if (!atual) return;
    setRascunho({ ...atual, ...p });
  }

  const salvar = useMutation({
    mutationFn: async (r: Regua) => {
      const { error } = await supabase.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaId,
        p_janela_dias: r.janela_dias,
        p_conv_atencao_pct: r.conv_atencao_pct,
        p_conv_travado_pct: r.conv_travado_pct,
        p_dias_atencao: r.dias_atencao,
        p_dias_travado: r.dias_travado,
        p_cancelamentos_limite: r.cancelamentos_limite,
        p_pausa_leads_ativa: r.pausa_leads_ativa,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setErr(null);
      setMsg("Régua de performance do seu time atualizada.");
      setRascunho(null);
      void queryClient.invalidateQueries({ queryKey: REGUA_KEY });
    },
    onError: (e: Error) => {
      setMsg(null);
      setErr(e.message);
    },
  });

  function salvarClick() {
    if (!atual) return;
    setMsg(null);
    // Mesmas validações de negócio da RPC (D2/V11.5b.2) — checadas aqui só
    // para dar feedback imediato; quem decide de fato é o banco.
    if (atual.conv_travado_pct > atual.conv_atencao_pct) {
      setErr("A conversão de Travado não pode ser maior que a de Atenção.");
      return;
    }
    if (atual.dias_atencao > atual.dias_travado) {
      setErr("Os dias de Travado não podem ser menores que os de Atenção.");
      return;
    }
    setErr(null);
    salvar.mutate(atual);
  }

  if (query.isLoading) {
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
          <Icon id="gauge" size={16} /> Régua de performance do seu time
        </h3>
      </div>
      {query.error && (
        <div className="card-b">
          <div className="banner alert">{(query.error as Error).message}</div>
        </div>
      )}
      {err && (
        <div className="card-b">
          <div className="banner alert">{err}</div>
        </div>
      )}
      {msg && !err && (
        <div className="card-b">
          <div className="banner ok">{msg}</div>
        </div>
      )}
      <div className="card-b">
        <div className="muted small" style={{ marginBottom: 12 }}>
          <Icon id="info" size={13} /> Quem fica <strong>Travado</strong> pode parar de receber
          leads da distribuição automática (se "Pausar leads" estiver ativo) até revisão. Esta régua
          vale para todo o seu time — como você é a única franqueada da sua franquia com esta
          autonomia, salvar é direto, sem senha, e entra no histórico da sua franquia.
        </div>

        {!atual ? (
          <div className="muted small">Régua não encontrada.</div>
        ) : (
          <>
            <div className="acc-grid">
              <div className="field-group">
                <label htmlFor="full-perf-janela">Janela (dias corridos)</label>
                <input
                  id="full-perf-janela"
                  className="input"
                  type="number"
                  min={1}
                  value={atual.janela_dias}
                  onChange={(e) => patch({ janela_dias: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label htmlFor="full-perf-conv-atencao">Conversão mínima · Atenção (%)</label>
                <input
                  id="full-perf-conv-atencao"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={atual.conv_atencao_pct}
                  onChange={(e) => patch({ conv_atencao_pct: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label htmlFor="full-perf-conv-travado">Conversão mínima · Travado (%)</label>
                <input
                  id="full-perf-conv-travado"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={atual.conv_travado_pct}
                  onChange={(e) => patch({ conv_travado_pct: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label htmlFor="full-perf-dias-atencao">Dias sem venda · Atenção</label>
                <input
                  id="full-perf-dias-atencao"
                  className="input"
                  type="number"
                  min={0}
                  value={atual.dias_atencao}
                  onChange={(e) => patch({ dias_atencao: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label htmlFor="full-perf-dias-travado">Dias sem venda · Travado</label>
                <input
                  id="full-perf-dias-travado"
                  className="input"
                  type="number"
                  min={0}
                  value={atual.dias_travado}
                  onChange={(e) => patch({ dias_travado: Number(e.target.value) })}
                />
              </div>
              <div className="field-group">
                <label htmlFor="full-perf-cancelamentos">Cancelamentos na janela (limite)</label>
                <input
                  id="full-perf-cancelamentos"
                  className="input"
                  type="number"
                  min={0}
                  value={atual.cancelamentos_limite}
                  onChange={(e) => patch({ cancelamentos_limite: Number(e.target.value) })}
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
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
            </div>
            <div style={{ marginTop: 16 }}>
              <button
                className="btn btn-yellow btn-sm"
                type="button"
                disabled={salvar.isPending}
                onClick={salvarClick}
              >
                <Icon id="check" size={13} /> {salvar.isPending ? "Salvando…" : "Salvar política"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
