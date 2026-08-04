import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * V11.5.2b — Central da Franquia › Distribuição · SLA · Canais, visão da
 * Franquia Full. Substitui a tela de Distribuição da Matriz (que edita o
 * singleton `distribuicao_config`, global da rede) por uma visão reduzida:
 * só o SLA próprio da Full (`sla_empresa_config`/`fn_salvar_sla_empresa`,
 * V11.5.3) e os canais próprios de captação dela (`canais`, V11.0.4). Nada
 * aqui toca `distribuicao_config` — ver decisão no `distribuicao.tsx`.
 */

type Canal = { id: string; nome: string; tipo: string; ativo: boolean; ordem: number };

function fmtDur(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}m ${s}s`;
}

export function FullDistribuicaoSlaCanais({ empresaId }: { empresaId: string }) {
  const queryClient = useQueryClient();
  const [slaMinInput, setSlaMinInput] = useState<string | null>(null);
  const [novoCanal, setNovoCanal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const slaKey = ["full-sla-empresa", empresaId];
  const canaisKey = ["full-canais-proprios", empresaId];

  const slaQuery = useQuery({
    queryKey: slaKey,
    queryFn: async () => {
      const [efetivoRes, overrideRes] = await Promise.all([
        supabase.rpc("fn_sla_efetivo", { p_empresa_id: empresaId }),
        supabase
          .from("sla_empresa_config")
          .select("sla_segundos")
          .eq("empresa_id", empresaId)
          .maybeSingle(),
      ]);
      if (efetivoRes.error) throw efetivoRes.error;
      if (overrideRes.error) throw overrideRes.error;
      return {
        efetivo: typeof efetivoRes.data === "number" ? efetivoRes.data : 180,
        temOverride: !!overrideRes.data,
      };
    },
  });

  const canaisQuery = useQuery({
    queryKey: canaisKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("canais")
        .select("id,nome,tipo,ativo,ordem")
        .eq("empresa_id", empresaId)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Canal[];
    },
  });

  const salvarSla = useMutation({
    mutationFn: async (segundos: number) => {
      const { error } = await supabase.rpc("fn_salvar_sla_empresa", {
        p_empresa_id: empresaId,
        p_sla_segundos: segundos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setErr(null);
      setMsg("SLA da sua franquia salvo.");
      queryClient.invalidateQueries({ queryKey: slaKey });
    },
    onError: (e: Error) => {
      setMsg(null);
      setErr(e.message);
    },
  });

  const criarCanal = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase
        .from("canais")
        .insert({ nome, tipo: "manual", empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => {
      setErr(null);
      setNovoCanal("");
      queryClient.invalidateQueries({ queryKey: canaisKey });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const alternarCanal = useMutation({
    mutationFn: async (canal: Canal) => {
      const { error } = await supabase
        .from("canais")
        .update({ ativo: !canal.ativo })
        .eq("id", canal.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: canaisKey }),
    onError: (e: Error) => setErr(e.message),
  });

  function salvarSlaClick() {
    const efetivoMin = slaQuery.data ? Math.round(slaQuery.data.efetivo / 60) : 3;
    const minutos = parseInt(slaMinInput ?? String(efetivoMin), 10);
    if (isNaN(minutos) || minutos <= 0) {
      setMsg(null);
      setErr("Informe um número de minutos maior que zero.");
      return;
    }
    salvarSla.mutate(minutos * 60);
  }

  function adicionarCanalClick() {
    const nome = novoCanal.trim();
    if (!nome) return;
    setMsg(null);
    criarCanal.mutate(nome);
  }

  const canais = canaisQuery.data ?? [];
  const efetivoMin = slaQuery.data ? Math.round(slaQuery.data.efetivo / 60) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {err && (
        <div
          className="audit-note"
          style={{
            gridColumn: "1 / -1",
            background: "var(--alert-soft)",
            color: "var(--alert)",
          }}
        >
          {err}
        </div>
      )}
      {msg && !err && (
        <div
          className="audit-note"
          style={{ gridColumn: "1 / -1", background: "var(--ok-soft)", color: "var(--ok)" }}
        >
          {msg}
        </div>
      )}

      <div className="card">
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-clock"></use>
            </svg>{" "}
            SLA próprio
          </h3>
        </div>
        <div className="card-b">
          {slaQuery.isLoading ? (
            <div className="muted small">Carregando…</div>
          ) : (
            <>
              <p className="small muted" style={{ marginTop: 0 }}>
                O SLA é <strong>seu</strong>, definido por você — independente do SLA da Matriz.
                {slaQuery.data?.temOverride
                  ? ` Atualmente: ${fmtDur(slaQuery.data.efetivo)}.`
                  : ` Você ainda não definiu um SLA próprio — sua franquia usa o padrão da rede (${fmtDur(slaQuery.data?.efetivo ?? 180)}).`}
              </p>
              <div className="field-group">
                <label htmlFor="full-sla-min">Minutos para o vendedor atender o lead</label>
                <input
                  id="full-sla-min"
                  className="input"
                  inputMode="numeric"
                  value={slaMinInput ?? String(efetivoMin ?? 3)}
                  onChange={(e) => setSlaMinInput(e.target.value)}
                  style={{ maxWidth: 140 }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <button
                  className="btn btn-yellow btn-sm"
                  onClick={salvarSlaClick}
                  disabled={salvarSla.isPending}
                >
                  <svg width="13" height="13">
                    <use href="#i-check"></use>
                  </svg>{" "}
                  {salvarSla.isPending ? "Salvando…" : "Salvar SLA"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-message"></use>
            </svg>{" "}
            Canais próprios de captação
          </h3>
        </div>
        <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
          <table className="table-pipe">
            <tbody>
              {canaisQuery.isLoading && (
                <tr>
                  <td className="muted small" style={{ padding: 14 }}>
                    Carregando…
                  </td>
                </tr>
              )}
              {!canaisQuery.isLoading && canais.length === 0 && (
                <tr>
                  <td className="muted small" style={{ padding: 14 }}>
                    Nenhum canal próprio ainda.
                  </td>
                </tr>
              )}
              {canais.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.nome}</strong>
                    {!c.ativo && (
                      <span className="chip chip-slate" style={{ fontSize: 9.5, marginLeft: 6 }}>
                        inativo
                      </span>
                    )}
                    <div className="small muted">canal próprio · leads entram na sua Central</div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => alternarCanal.mutate(c)}
                      disabled={alternarCanal.isPending}
                    >
                      <svg width="12" height="12">
                        <use href={c.ativo ? "#i-x" : "#i-refresh"}></use>
                      </svg>{" "}
                      {c.ativo ? "Desativar" : "Reativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, padding: "12px 14px" }}>
            <input
              className="input"
              value={novoCanal}
              onChange={(e) => setNovoCanal(e.target.value)}
              placeholder="Novo canal (ex.: WhatsApp da loja)"
              style={{ flex: 1 }}
              maxLength={60}
            />
            <button
              className="btn btn-yellow btn-sm"
              onClick={adicionarCanalClick}
              disabled={criarCanal.isPending || !novoCanal.trim()}
            >
              <svg width="13" height="13">
                <use href="#i-plus"></use>
              </svg>{" "}
              Adicionar
            </button>
          </div>
        </div>
      </div>

      <div className="clt-note" style={{ gridColumn: "1 / -1" }}>
        <svg width="15" height="15">
          <use href="#i-info"></use>
        </svg>
        <div>
          A comissão muda pela <strong>origem</strong> do lead — canal próprio tem regra diferente
          do repassado pela Matriz; os percentuais são definidos pela Matriz nas Configurações.
        </div>
      </div>
    </div>
  );
}
