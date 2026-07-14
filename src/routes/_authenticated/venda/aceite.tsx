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
  criado_em: string;
  cotacoes: { segurado: { nome: string | null }[] | null } | null;
};

const fmtBRL = (n: number | null) =>
  n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function Page() {
  const { selected } = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [obs, setObs] = useState<Record<string, string>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id,numero,status,seguradora,premio,valor,criado_em," +
          "cotacoes(segurado:cotacao_segurado(nome))",
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
    setBusy(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await load();
  }

  return (
    <AppShell title="Aceite & transmissão">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Aceite & transmissão</h1>
          <div className="sub">Propostas aguardando transmissão à seguradora</div>
        </div>
      </div>

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
        {rows.map((r) => (
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
                <strong>{r.numero}</strong>{" "}
                <span className="muted small">· {r.cotacoes?.segurado?.[0]?.nome || "—"}</span>
              </div>
              <span className="chip chip-yellow">Aguardando transmissão</span>
            </div>
            <div className="card-b">
              <div className="grid-3">
                <div>
                  <div className="label">Seguradora</div>
                  <div style={{ fontWeight: 600 }}>{r.seguradora || "—"}</div>
                </div>
                <div>
                  <div className="label">Prêmio</div>
                  <div style={{ fontWeight: 600 }}>{fmtBRL(r.premio ?? r.valor)}</div>
                </div>
                <div>
                  <div className="label">Gerada em</div>
                  <div style={{ fontWeight: 600 }}>
                    {new Date(r.criado_em).toLocaleDateString("pt-BR")}
                  </div>
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
                  className="btn btn-primary"
                  disabled={busy === r.id}
                  onClick={() => transmitir(r.id)}
                >
                  {busy === r.id ? "Transmitindo…" : "Registrar transmissão"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
