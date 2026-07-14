import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/propostas")({
  head: () => ({ meta: [{ title: "Propostas · CoteCerto" }] }),
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
  transmitida_em: string | null;
  cotacao_id: string | null;
  cotacoes: { segurado: { nome: string | null }[] | null } | null;
};

const fmtBRL = (n: number | null) =>
  n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function statusChip(s: string) {
  if (s === "transmitida") return <span className="chip chip-ok">Transmitida</span>;
  if (s === "cancelada") return <span className="chip chip-alert">Cancelada</span>;
  return <span className="chip chip-yellow">Gerada</span>;
}

function Page() {
  const { selected } = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("propostas")
        .select(
          "id,numero,status,seguradora,premio,valor,criado_em,transmitida_em,cotacao_id," +
            "cotacoes(segurado:cotacao_segurado(nome))",
        )
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected || loading) return;
    const el = rowRefs.current[selected];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected, loading, rows.length]);

  return (
    <AppShell title="Propostas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Propostas</h1>
          <div className="sub">
            Geradas automaticamente quando você seleciona um prêmio em uma cotação
          </div>
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
            Nenhuma proposta ainda. Selecione um prêmio em uma cotação para gerar a primeira.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Segurado</th>
                <th>Seguradora</th>
                <th>Prêmio</th>
                <th>Status</th>
                <th>Gerada em</th>
                <th>Transmitida</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  ref={(el) => {
                    rowRefs.current[r.id] = el;
                  }}
                  style={
                    selected === r.id
                      ? {
                          outline: "2px solid var(--brand, #2563eb)",
                          background: "rgba(37,99,235,.06)",
                        }
                      : undefined
                  }
                >
                  <td>
                    <strong>{r.numero || "—"}</strong>
                  </td>
                  <td>{r.cotacoes?.segurado?.[0]?.nome || "—"}</td>
                  <td>{r.seguradora || "—"}</td>
                  <td>{fmtBRL(r.premio ?? r.valor)}</td>
                  <td>{statusChip(r.status)}</td>
                  <td>{new Date(r.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td>
                    {r.transmitida_em ? new Date(r.transmitida_em).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
