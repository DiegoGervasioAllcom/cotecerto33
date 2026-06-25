import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/vendedores")({
  head: () => ({ meta: [{ title: "Vendedores · CoteCerto" }] }),
  component: Page,
});

type Row = {
  user_id: string;
  nome: string;
  email: string;
  status: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  leads_mes: number;
  em_negociacao: number;
  vendas_mes: number;
  comissao_mes: number;
  faturamento_mes: number;
  meta_vendas: number | null;
};

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function statusChip(status: string, vendas: number, meta: number | null) {
  if (status !== "aprovada") return <span className="chip chip-slate">{status}</span>;
  if (!meta || meta <= 0) return <span className="chip chip-info">Ativo</span>;
  const pct = vendas / meta;
  if (pct >= 0.8) return <span className="chip chip-ok">Ativo</span>;
  if (pct >= 0.4) return <span className="chip chip-yellow">Atenção</span>;
  return <span className="chip chip-alert">Travado</span>;
}

function metaBar(vendas: number, meta: number | null) {
  if (!meta || meta <= 0) return <span className="small muted">—</span>;
  const pct = Math.min(100, Math.round((vendas / meta) * 100));
  const color = pct >= 100 ? "var(--ok)" : pct >= 80 ? "var(--yellow)" : "var(--alert)";
  return (
    <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
      <div className="mini-bar">
        <div className="mini-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="small muted" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
        {vendas}/{meta}
      </span>
    </div>
  );
}

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_vendedor_kpis")
        .select("*")
        .order("vendas_mes", { ascending: false });
      if (error) setErr(error.message);
      else setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell title="Vendedores">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Vendedores</h1>
          <div className="sub">Quem está vendendo, quem travou e quem precisa de apoio</div>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}

      {!loading && rows.length === 0 && (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            Nenhum vendedor cadastrado.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 1020 }}>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Franquia</th>
                <th>Leads</th>
                <th>Em negoc.</th>
                <th>Vendas</th>
                <th>Faturamento</th>
                <th>Conv.</th>
                <th>Comissão</th>
                <th>Meta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const conv = r.leads_mes > 0 ? Math.round((r.vendas_mes / r.leads_mes) * 100) : 0;
                return (
                  <tr key={r.user_id}>
                    <td>
                      <strong>{r.nome || r.email}</strong>
                    </td>
                    <td>
                      <small>{r.empresa_nome ?? "—"}</small>
                    </td>
                    <td>{r.leads_mes}</td>
                    <td>{r.em_negociacao}</td>
                    <td>
                      <strong>{r.vendas_mes}</strong>
                    </td>
                    <td>{fmtBRL(Number(r.faturamento_mes) || 0)}</td>
                    <td>{conv}%</td>
                    <td>{fmtBRL(Number(r.comissao_mes) || 0)}</td>
                    <td>{metaBar(r.vendas_mes, r.meta_vendas)}</td>
                    <td>{statusChip(r.status, r.vendas_mes, r.meta_vendas)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
