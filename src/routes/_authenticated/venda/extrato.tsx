import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/extrato")({
  head: () => ({ meta: [{ title: "Extrato de vendas · CoteCerto" }] }),
  component: Page,
});

type Row = {
  id: string;
  numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  transmitida_em: string | null;
  cotacoes: { segurado: { nome: string | null }[] | null } | null;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [de, setDe] = useState(firstOfMonth());
  const [ate, setAte] = useState(today());

  async function load() {
    setLoading(true);
    const ini = new Date(de + "T00:00:00").toISOString();
    const fim = new Date(ate + "T23:59:59").toISOString();
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id,numero,seguradora,premio,valor,transmitida_em," +
          "cotacoes(segurado:cotacao_segurado(nome))"
      )
      .eq("status", "transmitida")
      .gte("transmitida_em", ini)
      .lte("transmitida_em", fim)
      .order("transmitida_em", { ascending: false });
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.premio ?? r.valor ?? 0), 0),
    [rows]
  );

  return (
    <AppShell title="Extrato de vendas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Extrato de vendas</h1>
          <div className="sub">Propostas efetivamente transmitidas à seguradora</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b row" style={{ gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <div className="label">De</div>
            <input
              type="date"
              className="input"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div>
            <div className="label">Até</div>
            <input
              type="date"
              className="input"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div className="label">Total no período</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtBRL(total)}</div>
            <div className="small muted">{rows.length} vendas</div>
          </div>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && rows.length === 0 && (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            Nenhuma venda transmitida no período.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Proposta</th>
                <th>Segurado</th>
                <th>Seguradora</th>
                <th style={{ textAlign: "right" }}>Prêmio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.transmitida_em
                      ? new Date(r.transmitida_em).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td>
                    <strong>{r.numero}</strong>
                  </td>
                  <td>{r.cotacoes?.segurado?.[0]?.nome || "—"}</td>
                  <td>{r.seguradora || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtBRL(Number(r.premio ?? r.valor ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
