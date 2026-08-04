// V11.5b.4 — Aba "Personalização geral" da Franquia Full.
//
// 2 sub-abas (r41, `fullPersoBody()`):
//   1) "Modelo CLT · comissionamento" (default) — leitura resumida do
//      `clt_config` (singleton global da Matriz, mesma régua progressiva/
//      fator/Ituran usada pelo Vendedor Matriz interno) + edição dos
//      "Complementos do time" (comissão de venda/renovação do vendedor,
//      bônus de campanha, meta padrão da equipe) — esses SIM são da própria
//      franquia (`full_comissao_complementos`, V11.5b.3).
//   2) "Histórico" — ver `FullHistoricoPanel`.
//
// Nada aqui edita o `clt_config` global (isso é exclusivo da Matriz, gate de
// diretor, `ModeloCltPanel` em `perso-geral.tsx`) nem a comissão por origem
// (própria × repassada, já implementada em V11.5.8 — `comissao_origem_config`,
// fora de escopo desta tela).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "./icon";
import { FullHistoricoPanel } from "./full-historico-panel";

type Sub = "clt" | "historico";

type Pair = [string, string];
type CltRegras = {
  apuracao_ini: string | null;
  apuracao_fim: string | null;
  pagamento: string | null;
  iof: string | null;
  rules: string[];
};
type CltResumo = {
  progressiva: Pair[];
  regras: CltRegras;
};

function textoOuNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function parseCltResumo(row: { progressiva: unknown; regras: unknown } | null): CltResumo {
  const progressiva = Array.isArray(row?.progressiva)
    ? (row!.progressiva as unknown[]).filter(
        (p): p is Pair => Array.isArray(p) && p.length === 2 && typeof p[0] === "string",
      )
    : [];
  const regrasRaw = (row?.regras ?? {}) as Record<string, unknown>;
  return {
    progressiva,
    regras: {
      apuracao_ini: textoOuNull(regrasRaw.apuracao_ini),
      apuracao_fim: textoOuNull(regrasRaw.apuracao_fim),
      pagamento: textoOuNull(regrasRaw.pagamento),
      iof: textoOuNull(regrasRaw.iof),
      rules: Array.isArray(regrasRaw.rules)
        ? (regrasRaw.rules as unknown[]).filter((r): r is string => typeof r === "string")
        : [],
    },
  };
}

export function FullPersonalizacaoPanel({ empresaId }: { empresaId: string }) {
  const [sub, setSub] = useState<Sub>("clt");

  return (
    <>
      <div className="toggle toggle-sub" style={{ marginBottom: 16 }}>
        <button className={sub === "clt" ? "on" : ""} onClick={() => setSub("clt")}>
          Modelo CLT · comissionamento
        </button>
        <button className={sub === "historico" ? "on" : ""} onClick={() => setSub("historico")}>
          Histórico
        </button>
      </div>
      {sub === "clt" && <ModeloCltEComplementos empresaId={empresaId} />}
      {sub === "historico" && <FullHistoricoPanel empresaId={empresaId} />}
    </>
  );
}

function ModeloCltEComplementos({ empresaId }: { empresaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="clt-note">
        <Icon id="info" size={15} />
        <div>
          O comissionamento do seu time segue o <strong>Modelo CLT</strong> — a mesma régua
          (progressiva, fator, seguradora) usada pela Matriz, aplicada à sua franquia. O repasse
          Matriz → franquia e a comissão por origem do lead (próprio × repassado) são definidos pela
          Matriz nas Configurações — aqui você só acompanha, em modo leitura.
        </div>
      </div>
      <ModeloCltResumo />
      <ComplementosCard empresaId={empresaId} />
      <div className="clt-note">
        <Icon id="info" size={15} />
        <div>
          Este é o modelo <strong>geral</strong> do seu time — aplicado a todo vendedor novo.
          Exceção por vendedor específico é configurada em outra tela.
        </div>
      </div>
    </div>
  );
}

function ModeloCltResumo() {
  const query = useQuery({
    queryKey: ["clt-config-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clt_config")
        .select("progressiva,regras")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;
      return parseCltResumo(data ?? null);
    },
  });

  if (query.isLoading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando o Modelo CLT…</div>
      </div>
    );
  }

  const resumo = query.data ?? {
    progressiva: [],
    regras: { apuracao_ini: null, apuracao_fim: null, pagamento: null, iof: null, rules: [] },
  };

  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="percent" size={16} /> Modelo CLT (informativo)
        </h3>
        <span className="chip chip-slate" style={{ marginLeft: "auto" }}>
          somente leitura
        </span>
      </div>
      {query.error && (
        <div className="card-b">
          <div className="banner alert">{(query.error as Error).message}</div>
        </div>
      )}
      <div className="card-b">
        <div className="acc-grid" style={{ marginBottom: 14 }}>
          <div className="field-group">
            <label>Apuração</label>
            <div>
              do dia {resumo.regras.apuracao_ini ?? "—"} ao dia {resumo.regras.apuracao_fim ?? "—"}
            </div>
          </div>
          <div className="field-group">
            <label>Pagamento</label>
            <div>{resumo.regras.pagamento ?? "—"}</div>
          </div>
          <div className="field-group">
            <label>IOF</label>
            <div>{resumo.regras.iof ?? "—"}</div>
          </div>
        </div>

        <div className="acc-sec-t" style={{ marginTop: 0 }}>
          Comissão de seguros — progressiva (faixas de faturamento)
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Faturamento comissão (R$)</th>
                <th>% comissionado</th>
              </tr>
            </thead>
            <tbody>
              {resumo.progressiva.length === 0 && (
                <tr>
                  <td colSpan={2} className="muted small" style={{ padding: 12 }}>
                    Nenhuma faixa cadastrada.
                  </td>
                </tr>
              )}
              {resumo.progressiva.map(([faixa, pct], i) => (
                <tr key={i}>
                  <td>{faixa}</td>
                  <td>{pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {resumo.regras.rules.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="acc-sec-t">Regras gerais de remuneração</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {resumo.regras.rules.map((r, i) => (
                <li key={i} className="small">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

type Complementos = {
  comissao_venda_pct: number;
  comissao_renovacao_pct: number;
  bonus_campanha: string | null;
  meta_padrao_equipe: string | null;
};

const COMPLEMENTOS_KEY = ["full-complementos"];

function ComplementosCard({ empresaId }: { empresaId: string }) {
  const queryClient = useQueryClient();
  const [rascunho, setRascunho] = useState<Complementos | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const query = useQuery({
    queryKey: [...COMPLEMENTOS_KEY, empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("full_comissao_complementos")
        .select("comissao_venda_pct,comissao_renovacao_pct,bonus_campanha,meta_padrao_equipe")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        comissao_venda_pct: Number(data.comissao_venda_pct),
        comissao_renovacao_pct: Number(data.comissao_renovacao_pct),
        bonus_campanha: data.bonus_campanha,
        meta_padrao_equipe: data.meta_padrao_equipe,
      } as Complementos;
    },
  });

  const padrao: Complementos = {
    comissao_venda_pct: 0,
    comissao_renovacao_pct: 0,
    bonus_campanha: null,
    meta_padrao_equipe: null,
  };
  const atual = rascunho ?? query.data ?? padrao;

  function patch(p: Partial<Complementos>) {
    setRascunho({ ...atual, ...p });
  }

  const salvar = useMutation({
    mutationFn: async (c: Complementos) => {
      const { error } = await supabase.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaId,
        p_comissao_venda_pct: c.comissao_venda_pct,
        p_comissao_renovacao_pct: c.comissao_renovacao_pct,
        // Os tipos gerados marcam estes 2 como `string` (não `string | null`)
        // porque a função SQL não declara DEFAULT — mas o parâmetro `text`
        // aceita null em runtime (é assim que a coluna fica NULL). Cast só
        // para contornar a lacuna do codegen, sem mudar o valor enviado.
        p_bonus_campanha: c.bonus_campanha as string,
        p_meta_padrao_equipe: c.meta_padrao_equipe as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setErr(null);
      setMsg("Complementos do time salvos.");
      setRascunho(null);
      void queryClient.invalidateQueries({ queryKey: [...COMPLEMENTOS_KEY, empresaId] });
    },
    onError: (e: Error) => {
      setMsg(null);
      setErr(e.message);
    },
  });

  function salvarClick() {
    setMsg(null);
    // Mesmas constraints de fn_salvar_complementos_full (V11.5b.3) — checadas
    // aqui só para feedback imediato; o banco valida de novo.
    if (
      !Number.isFinite(atual.comissao_venda_pct) ||
      atual.comissao_venda_pct < 0 ||
      atual.comissao_venda_pct > 100
    ) {
      setErr("Comissão de venda precisa estar entre 0 e 100.");
      return;
    }
    if (
      !Number.isFinite(atual.comissao_renovacao_pct) ||
      atual.comissao_renovacao_pct < 0 ||
      atual.comissao_renovacao_pct > 100
    ) {
      setErr("Comissão na renovação precisa estar entre 0 e 100.");
      return;
    }
    setErr(null);
    salvar.mutate({
      ...atual,
      bonus_campanha: atual.bonus_campanha?.trim() ? atual.bonus_campanha.trim() : null,
      meta_padrao_equipe: atual.meta_padrao_equipe?.trim() ? atual.meta_padrao_equipe.trim() : null,
    });
  }

  if (query.isLoading) {
    return (
      <div className="card">
        <div className="card-b muted small">Carregando os complementos do time…</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="dollar" size={16} /> Complementos do time
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
          <Icon id="info" size={13} /> Aplicado ao vendedor da sua franquia — sem senha, salva
          direto e entra no histórico da sua franquia.
        </div>
        <div className="acc-grid">
          <div className="field-group">
            <label htmlFor="full-com-venda">Comissão de venda do vendedor (%)</label>
            <input
              id="full-com-venda"
              className="input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={atual.comissao_venda_pct}
              onChange={(e) => patch({ comissao_venda_pct: Number(e.target.value) })}
            />
          </div>
          <div className="field-group">
            <label htmlFor="full-com-renov">Comissão na renovação (%)</label>
            <input
              id="full-com-renov"
              className="input"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={atual.comissao_renovacao_pct}
              onChange={(e) => patch({ comissao_renovacao_pct: Number(e.target.value) })}
            />
          </div>
          <div className="field-group">
            <label htmlFor="full-com-bonus">Bônus de campanha</label>
            <input
              id="full-com-bonus"
              className="input"
              placeholder='ex.: "+5% acima da meta"'
              maxLength={200}
              value={atual.bonus_campanha ?? ""}
              onChange={(e) => patch({ bonus_campanha: e.target.value })}
            />
          </div>
          <div className="field-group">
            <label htmlFor="full-com-meta">Meta padrão da equipe</label>
            <input
              id="full-com-meta"
              className="input"
              placeholder='ex.: "12 vendas/mês"'
              maxLength={200}
              value={atual.meta_padrao_equipe ?? ""}
              onChange={(e) => patch({ meta_padrao_equipe: e.target.value })}
            />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button
            className="btn btn-yellow btn-sm"
            type="button"
            disabled={salvar.isPending}
            onClick={salvarClick}
          >
            <Icon id="check" size={13} /> {salvar.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
