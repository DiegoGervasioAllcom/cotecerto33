// Aba "Personalização geral" — sub-abas Modelo Franquia / Modelo CLT.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { maskPct } from "@/lib/masks";
import { modeloFranquiaNomeSchema } from "@/lib/schemas/catalogos.schema";
import { DescontoPoliticaPanel } from "@/components/acessos/desconto-politica-panel";
import { RespostasPadraoPanel } from "@/components/acessos/respostas-padrao-panel";
import { Icon } from "./icon";
import { PARAMS } from "./constants";
import { DynamicRangeCard, DynamicTrioCard } from "./dynamic-cards";
import type { CltConfig, Modelo, ModeloParams, PersoSub } from "./types";

export function PersoGeral({
  sub,
  setSub,
  modelos,
  setModelos,
  clt,
  setClt,
  onToast,
  onError,
  reload,
}: {
  sub: PersoSub;
  setSub: (s: PersoSub) => void;
  modelos: Modelo[];
  setModelos: (updater: (prev: Modelo[]) => Modelo[]) => void;
  clt: CltConfig;
  setClt: (c: CltConfig) => void;
  onToast: (msg: string, kind: "ok" | "alert") => void;
  onError: (e: string) => void;
  reload: () => Promise<void>;
}) {
  return (
    <>
      <div className="toggle toggle-sub" style={{ marginBottom: 16 }}>
        <button className={sub === "franquia" ? "on" : ""} onClick={() => setSub("franquia")}>
          Modelo Franquia
        </button>
        <button className={sub === "clt" ? "on" : ""} onClick={() => setSub("clt")}>
          Modelo CLT
        </button>
      </div>
      {sub === "franquia" ? (
        <ModeloFranquiaPanel
          modelos={modelos}
          setModelos={setModelos}
          onToast={onToast}
          onError={onError}
          reload={reload}
        />
      ) : (
        <ModeloCltPanel clt={clt} setClt={setClt} onToast={onToast} onError={onError} />
      )}
      <DescontoPoliticaPanel />
      <RespostasPadraoPanel />
    </>
  );
}

function ModeloFranquiaPanel({
  modelos,
  setModelos,
  onToast,
  onError,
  reload,
}: {
  modelos: Modelo[];
  setModelos: (updater: (prev: Modelo[]) => Modelo[]) => void;
  onToast: (msg: string, kind: "ok" | "alert") => void;
  onError: (e: string) => void;
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  function patchModelo(id: string, patch: Partial<Modelo> & { params?: ModeloParams }) {
    setModelos((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...patch, params: { ...m.params, ...(patch.params ?? {}) } } : m,
      ),
    );
  }
  function patchParam(id: string, key: string, value: string) {
    setModelos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, params: { ...m.params, [key]: value } } : m)),
    );
  }

  async function salvar() {
    for (const m of modelos) {
      const check = modeloFranquiaNomeSchema.safeParse(m.nome);
      if (!check.success) {
        onError(check.error.issues[0]?.message ?? "Nome de modelo inválido.");
        return;
      }
    }
    setBusy(true);
    const updates = modelos.map((m) =>
      supabase
        .from("modelos_franquia")
        .update({
          nome: m.nome,
          params: m.params,
          ordem: m.ordem,
          modalidade: m.tipo === "franqueada" ? (m.modalidade ?? "individual") : null,
        })
        .eq("id", m.id),
    );
    const res = await Promise.all(updates);
    setBusy(false);
    const erro = res.find((r) => r.error);
    if (erro?.error) {
      onError(erro.error.message);
      return;
    }
    onToast("Parâmetros dos modelos atualizados", "ok");
  }

  async function adicionar() {
    const check = modeloFranquiaNomeSchema.safeParse(novoNome);
    if (!check.success) {
      onError(check.error.issues[0]?.message ?? "Nome de modelo inválido.");
      return;
    }
    setBusy(true);
    const ordem = (modelos.reduce((a, m) => Math.max(a, m.ordem), 0) ?? 0) + 1;
    const { error } = await supabase.from("modelos_franquia").insert({
      nome: check.data,
      tipo: "franqueada",
      perc_comissao_padrao: 0,
      ordem,
      modalidade: "individual",
      params: {
        leads: "—",
        comVenda: "—",
        comRenov: "—",
        incentivo: "—",
        software: "—",
        franquia: "—",
        royalties: "—",
      },
    });
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    setNovoNome("");
    setAddOpen(false);
    onToast(`Modelo "${novoNome.trim()}" adicionado`, "ok");
    await reload();
  }

  async function remover(m: Modelo) {
    if (!confirm(`Remover o modelo "${m.nome}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("modelos_franquia").delete().eq("id", m.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onToast(`Modelo "${m.nome}" removido`, "alert");
    await reload();
  }

  return (
    <div className="card">
      <div className="card-h">
        <h3>
          <Icon id="building" size={16} /> Modelo Franquia
        </h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen((v) => !v)}>
            <Icon id="plus" size={13} /> Adicionar modelo
          </button>
          <button className="btn btn-slate btn-sm" disabled={busy} onClick={salvar}>
            <Icon id="check" size={13} /> Salvar parâmetros
          </button>
        </div>
      </div>
      {addOpen && (
        <div className="card-b" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            placeholder="Nome do novo modelo"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            style={{ maxWidth: 320 }}
            maxLength={150}
          />
          <button
            className="btn btn-yellow btn-sm"
            disabled={busy || !novoNome.trim()}
            onClick={adicionar}
          >
            <Icon id="check" size={13} /> Criar
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setAddOpen(false);
              setNovoNome("");
            }}
          >
            Cancelar
          </button>
        </div>
      )}
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe acc-modelos">
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Modalidade</th>
              {PARAMS.map((p) => (
                <th key={p.k}>{p.l}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {modelos.length === 0 && (
              <tr>
                <td
                  colSpan={PARAMS.length + 3}
                  style={{ textAlign: "center", color: "var(--muted)", padding: 32 }}
                >
                  Nenhum modelo cadastrado. Use “Adicionar modelo”.
                </td>
              </tr>
            )}
            {modelos.map((m) => (
              <tr key={m.id}>
                <td>
                  <input
                    className="input input-mini"
                    value={m.nome}
                    onChange={(e) => patchModelo(m.id, { nome: e.target.value })}
                    style={{ fontWeight: 700, minWidth: 110 }}
                    maxLength={150}
                  />
                </td>
                <td>
                  {m.tipo === "franqueada" ? (
                    <div className="acc-pills" style={{ gap: 4 }}>
                      <button
                        type="button"
                        className={`acc-pill ${m.modalidade !== "full" ? "on" : ""}`}
                        onClick={() => patchModelo(m.id, { modalidade: "individual" })}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        className={`acc-pill ${m.modalidade === "full" ? "on" : ""}`}
                        onClick={() => patchModelo(m.id, { modalidade: "full" })}
                      >
                        Full
                      </button>
                    </div>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
                {PARAMS.map((p) => (
                  <td key={p.k}>
                    <input
                      className="input input-mini"
                      value={m.params[p.k] ?? ""}
                      onChange={(e) => patchParam(m.id, p.k, e.target.value)}
                    />
                  </td>
                ))}
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => remover(m)}
                    title="Remover"
                  >
                    <Icon id="trash" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-b">
        <div className="muted small">
          <Icon id="info" size={13} /> Valores padrão aplicados ao classificar um franqueado (PJ)
          neste modelo — a matriz pode sobrescrever caso a caso na aprovação.
        </div>
      </div>
    </div>
  );
}

function ModeloCltPanel({
  clt,
  setClt,
  onToast,
  onError,
}: {
  clt: CltConfig;
  setClt: (c: CltConfig) => void;
  onToast: (msg: string, kind: "ok" | "alert") => void;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setBusy(true);
    const { error } = await supabase
      .from("clt_config")
      .update({
        progressiva: clt.progressiva,
        fator_novas: clt.fator_novas,
        fator_remalho: clt.fator_remalho,
        seguradora_planos: clt.seguradora_planos,
        seguradora_adic: clt.seguradora_adic,
        regras: clt.regras,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", "default");
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onToast("Modelo CLT atualizado", "ok");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="muted small">
          <Icon id="info" size={13} /> Regras de remuneração do vendedor CLT (equipe interna), com
          base nas políticas SUP_POL_01 e SUP_POL_04.
        </div>
        <button className="btn btn-slate btn-sm" disabled={busy} onClick={salvar}>
          <Icon id="check" size={13} /> Salvar Modelo CLT
        </button>
      </div>

      <DynamicRangeCard
        title="Comissão de seguros — progressiva"
        icon="percent"
        lh="Faturamento comissão (R$)"
        vh="% comissionado"
        rows={clt.progressiva}
        onChange={(rows) => setClt({ ...clt, progressiva: rows })}
        rangeMask="brl"
        valueMask="pct"
        footer={
          <div className="muted small">
            <Icon id="info" size={13} /> Base: prêmio líquido = prêmio bruto − juros − IOF (7,38%).
            O % vem da faixa do faturamento mensal de comissão.
          </div>
        }
      />

      <div className="acc-two">
        <DynamicRangeCard
          title="Fator comissão média · Novas Vendas"
          icon="users"
          lh="Comissão média"
          vh="Fator"
          rows={clt.fator_novas}
          onChange={(rows) => setClt({ ...clt, fator_novas: rows })}
          rangeMask="pct"
          valueMask="pct"
        />
        <DynamicRangeCard
          title="Fator comissão média · Remalho"
          icon="users"
          lh="Comissão média"
          vh="Fator"
          rows={clt.fator_remalho}
          onChange={(rows) => setClt({ ...clt, fator_remalho: rows })}
          rangeMask="pct"
          valueMask="pct"
        />
      </div>

      <DynamicTrioCard
        title="Seguradora — comissão por plano (R$)"
        icon="car"
        lh="Plano"
        vh="Comissão (R$)"
        rows={clt.seguradora_planos}
        onChange={(rows) => setClt({ ...clt, seguradora_planos: rows })}
        valueMask="brl"
      />
      <DynamicTrioCard
        title="Seguradora — serviços adicionais (R$)"
        icon="shield"
        lh="Adicional"
        vh="Comissão (R$)"
        rows={clt.seguradora_adic}
        onChange={(rows) => setClt({ ...clt, seguradora_adic: rows })}
        valueMask="brl"
      />

      <div className="card">
        <div className="card-h">
          <h3>
            <Icon id="info" size={16} /> Regras gerais de remuneração
          </h3>
        </div>
        <div className="card-b">
          <div className="acc-grid">
            <div className="field-group">
              <label>Apuração — do dia</label>
              <input
                className="input"
                value={clt.regras.apuracao_ini}
                onChange={(e) =>
                  setClt({ ...clt, regras: { ...clt.regras, apuracao_ini: e.target.value } })
                }
              />
            </div>
            <div className="field-group">
              <label>…até o dia</label>
              <input
                className="input"
                value={clt.regras.apuracao_fim}
                onChange={(e) =>
                  setClt({ ...clt, regras: { ...clt.regras, apuracao_fim: e.target.value } })
                }
              />
            </div>
            <div className="field-group">
              <label>Pagamento</label>
              <input
                className="input"
                value={clt.regras.pagamento}
                onChange={(e) =>
                  setClt({ ...clt, regras: { ...clt.regras, pagamento: e.target.value } })
                }
              />
            </div>
            <div className="field-group">
              <label>IOF</label>
              <input
                className="input"
                value={clt.regras.iof}
                placeholder="0%"
                onChange={(e) =>
                  setClt({ ...clt, regras: { ...clt.regras, iof: maskPct(e.target.value) } })
                }
              />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="acc-sec-t" style={{ marginTop: 0 }}>
              Regras adicionais
            </div>
            {clt.regras.rules.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                <input
                  className="input"
                  value={r}
                  onChange={(e) => {
                    const next = [...clt.regras.rules];
                    next[i] = e.target.value;
                    setClt({ ...clt, regras: { ...clt.regras, rules: next } });
                  }}
                />
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const next = clt.regras.rules.filter((_, j) => j !== i);
                    setClt({ ...clt, regras: { ...clt.regras, rules: next } });
                  }}
                >
                  <Icon id="trash" size={13} />
                </button>
              </div>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setClt({ ...clt, regras: { ...clt.regras, rules: [...clt.regras.rules, ""] } });
              }}
            >
              <Icon id="plus" size={13} /> Adicionar regra
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
