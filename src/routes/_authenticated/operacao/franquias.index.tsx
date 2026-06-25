import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/franquias/")({
  head: () => ({ meta: [{ title: "Franquias · CoteCerto" }] }),
  component: Page,
});

type Row = {
  empresa_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  status: string;
  perc_comissao_efetiva: number | null;
  leads_mes: number;
  em_aberto: number;
  perdidos_mes: number;
  vendas_mes: number;
  faturamento_mes: number;
  comissao_mes: number;
  meta_vendas: number | null;
  meta_faturamento: number | null;
};

type Resp = { empresa_id: string; nome: string };

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function statusChip(vendas: number, meta: number | null) {
  if (!meta || meta <= 0) return <span className="chip chip-slate">Sem meta</span>;
  const pct = vendas / meta;
  if (pct >= 1) return <span className="chip chip-ok">Acima da meta</span>;
  if (pct >= 0.8) return <span className="chip chip-info">No ritmo</span>;
  if (pct >= 0.5) return <span className="chip chip-yellow">Atenção</span>;
  return <span className="chip chip-alert">Abaixo da meta</span>;
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
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [resps, setResps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("v_franquia_kpis")
        .select("*")
        .neq("status", "pendente")
        .order("nome");
      if (error) setErr(error.message);
      else {
        const list = (data ?? []) as Row[];
        setRows(list);
        if (list.length) {
          const ids = list.map((r) => r.empresa_id);
          const { data: profs } = await supabase
            .from("profiles")
            .select("empresa_id,nome")
            .in("empresa_id", ids)
            .eq("status", "aprovada");
          const map: Record<string, string> = {};
          (profs as Resp[] | null)?.forEach((p) => {
            if (!map[p.empresa_id]) map[p.empresa_id] = p.nome;
          });
          setResps(map);
        }
      }
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell title="Franquias">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Franquias</h1>
          <div className="sub">Esta visão substitui a planilha de comparativo de franquias</div>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}

      {!loading && rows.length === 0 && (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            Nenhuma franquia aprovada ainda. Aprove cadastros pendentes em{" "}
            <strong>Acessos e permissões</strong>.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Franquia</th>
                <th>Responsável</th>
                <th>Leads</th>
                <th>Em aberto</th>
                <th>Vendas</th>
                <th>Faturamento</th>
                <th>Comissão</th>
                <th>Conv.</th>
                <th>Meta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const conv = r.leads_mes > 0 ? Math.round((r.vendas_mes / r.leads_mes) * 100) : 0;
                return (
                  <tr
                    key={r.empresa_id}
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      navigate({
                        to: "/operacao/franquias/$id",
                        params: { id: r.empresa_id },
                      })
                    }
                  >
                    <td>
                      <div className="mini-cell">
                        <strong>{r.nome}</strong>
                        <small>
                          {r.cidade ? `${r.cidade}${r.uf ? "/" + r.uf : ""}` : "—"}
                        </small>
                      </div>
                    </td>
                    <td>{resps[r.empresa_id] ?? "—"}</td>
                    <td>{r.leads_mes}</td>
                    <td>
                      {r.em_aberto} <small className="muted">/ {r.perdidos_mes} perd.</small>
                    </td>
                    <td>
                      <strong>{r.vendas_mes}</strong>
                    </td>
                    <td>{fmtBRL(Number(r.faturamento_mes) || 0)}</td>
                    <td>{fmtBRL(Number(r.comissao_mes) || 0)}</td>
                    <td>{conv}%</td>
                    <td>{metaBar(r.vendas_mes, r.meta_vendas)}</td>
                    <td>{statusChip(r.vendas_mes, r.meta_vendas)}</td>
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
