import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/aceite")({
  head: () => ({ meta: [{ title: "Aceite & transmissão · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string } => ({
    selected: typeof s.selected === "string" ? s.selected : undefined,
  }),
  component: Page,
});

type Row = {
  id: string;
  numero: string | null;
  status: string;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  forma_pagamento: string | null;
  vencimento: string | null;
  criado_em: string;
  transmitida_em: string | null;
  aceita_em: string | null;
  emitida_em: string | null;
  transmissao_obs: string | null;
  cotacoes: {
    segurado: { nome: string | null }[] | null;
    veiculo:
      | {
          marca_nome: string | null;
          modelo_nome: string | null;
          ano_modelo: string | null;
          placa: string | null;
        }[]
      | null;
  } | null;
  leads: { origem: string | null } | null;
};

const fmtBRL = (n: number | null) =>
  n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtData = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

type TimelineStep = { key: string; label: string; when: string | null };

function Timeline({ r }: { r: Row }) {
  const steps: TimelineStep[] = [
    { key: "gerada", label: "Gerada", when: r.criado_em },
    { key: "transmitida", label: "Transmitida", when: r.transmitida_em },
    { key: "aceita", label: "Aceita", when: r.aceita_em },
    { key: "emitida", label: "Emitida", when: r.emitida_em },
  ];
  const currentIdx = steps.findIndex((s) => !s.when);
  return (
    <div className="timeline">
      <h3>Linha do tempo do aceite</h3>
      <div className="tl-steps">
        {steps.map((s, i) => {
          const cls = s.when ? "done" : i === currentIdx ? "current" : "future";
          return (
            <div key={s.key} className={`tl-step ${cls}`}>
              <div className="dot" />
              <div className="lbl">{s.label}</div>
              <div className="when">{s.when ? fmtData(s.when) : "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Page() {
  const { selected } = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [obs, setObs] = useState<Record<string, string>>({});
  const [conferido, setConferido] = useState<Record<string, boolean>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id,numero,status,seguradora,premio,valor,forma_pagamento,vencimento,criado_em," +
          "transmitida_em,aceita_em,emitida_em,transmissao_obs," +
          "cotacoes(segurado:cotacao_segurado(nome),veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo,placa))," +
          "leads(origem)",
      )
      .eq("status", "gerada")
      .order("criado_em", { ascending: true });
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected || loading) return;
    const el = cardRefs.current[selected];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected, loading, rows.length]);

  async function transmitir(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("transmitir_proposta", {
      p_proposta_id: id,
      p_obs: obs[id] || undefined,
    });
    if (error) {
      setBusy(null);
      setErr(error.message);
      return;
    }

    // G6.2: amarra tipo_venda='renovacao' quando o lead de origem da proposta
    // veio do fluxo de renovação (origem='renovacao'). O motor de comissão
    // (G4) usa propostas.tipo_venda para aplicar o fator de renovação — a RPC
    // transmitir_proposta não define esse campo, então fechamos aqui via
    // update direto (permitido pela RLS "prop_iud": responsavel_id/matriz).
    const row = rows.find((r) => r.id === id);
    if (row?.leads?.origem === "renovacao") {
      const { error: tipoErr } = await supabase
        .from("propostas")
        .update({ tipo_venda: "renovacao" })
        .eq("id", id);
      if (tipoErr)
        // Transmissão OK, só a marcação de renovação falhou — deixar explícito
        // (senão a comissão sai com o fator errado no fechamento do G4).
        setErr(
          `Proposta transmitida, mas falhou ao marcá-la como renovação (corrija o tipo antes do fechamento): ${tipoErr.message}`,
        );
    }

    setBusy(null);
    await load();
  }

  return (
    <AppShell title="Aceite & transmissão">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Aceite & transmissão</h1>
          <div className="sub">
            {rows.length} proposta{rows.length !== 1 ? "s" : ""} aguardando transmissão à seguradora
          </div>
        </div>
      </div>

      {/* TODO Q3: pendência da seguradora depende de novo campo/estado (fora do escopo atual) */}

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && rows.length === 0 && (
        <div className="card">
          <div
            className="card-b"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
            Nenhuma proposta aguardando transmissão.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const segurado = r.cotacoes?.segurado?.[0]?.nome || "—";
          const veiculo = r.cotacoes?.veiculo?.[0];
          const veiculoTexto = veiculo
            ? [veiculo.marca_nome, veiculo.modelo_nome, veiculo.ano_modelo]
                .filter(Boolean)
                .join(" ") + (veiculo.placa ? ` · ${veiculo.placa}` : "")
            : "—";
          const ok = conferido[r.id] ?? false;
          return (
            <div
              key={r.id}
              ref={(el) => {
                cardRefs.current[r.id] = el;
              }}
              className="card"
              style={selected === r.id ? { outline: "2px solid var(--brand, #2563eb)" } : undefined}
            >
              <div className="card-h">
                <div>
                  <strong>{r.numero}</strong> <span className="muted small">· {segurado}</span>
                </div>
                <span className="chip chip-yellow">Aguardando transmissão</span>
              </div>
              <div className="card-b">
                <Timeline r={r} />

                <div className="confer-card" style={{ marginTop: 12 }}>
                  <div className="row">
                    <h3 style={{ margin: 0, color: "var(--slate)", fontSize: 16 }}>
                      Conferência final dos dados
                    </h3>
                  </div>

                  <div className="confer-grid">
                    <div className="confer-item">
                      <div className="k">SEGURADO</div>
                      <div className="v">{segurado}</div>
                    </div>
                    <div className="confer-item">
                      <div className="k">VEÍCULO</div>
                      <div className="v">{veiculoTexto || "—"}</div>
                    </div>
                    <div className="confer-item">
                      <div className="k">SEGURADORA</div>
                      <div className="v">{r.seguradora || "—"}</div>
                    </div>
                    <div className="confer-item">
                      <div className="k">PRÊMIO</div>
                      <div className="v">{fmtBRL(r.premio ?? r.valor)}</div>
                    </div>
                    <div className="confer-item">
                      <div className="k">FORMA DE PAGAMENTO</div>
                      <div className="v">{r.forma_pagamento || "—"}</div>
                    </div>
                    <div className="confer-item">
                      <div className="k">VENCIMENTO</div>
                      <div className="v">{fmtData(r.vencimento)}</div>
                    </div>
                    <div className="confer-item">
                      <div className="k">Nº DA PROPOSTA</div>
                      <div className="v">{r.numero || "—"}</div>
                    </div>
                  </div>

                  <div className="confer-check">
                    <input
                      type="checkbox"
                      id={`okConferi-${r.id}`}
                      checked={ok}
                      onChange={(e) => setConferido((p) => ({ ...p, [r.id]: e.target.checked }))}
                    />
                    <label htmlFor={`okConferi-${r.id}`}>
                      <strong>Conferi todos os dados acima.</strong> Estou autorizado a transmitir a
                      apólice à seguradora.
                    </label>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Observação da transmissão</div>
                  <textarea
                    className="input"
                    rows={2}
                    value={obs[r.id] ?? ""}
                    onChange={(e) => setObs((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="Nº protocolo, observações, etc."
                  />
                </div>
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                  <button
                    className="btn btn-yellow"
                    disabled={busy === r.id || !ok}
                    style={!ok ? { opacity: 0.5 } : undefined}
                    onClick={() => transmitir(r.id)}
                  >
                    {busy === r.id ? "Transmitindo…" : "Registrar transmissão"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
