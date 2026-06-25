import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/cotacoes")({
  head: () => ({ meta: [{ title: "Cotações · CoteCerto" }] }),
  component: Page,
});

type Premio = { seguradora: string; premio: number };
type Row = {
  id: string;
  numero: number;
  status: string;
  ramo: string;
  criado_em: string;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: { marca_nome: string | null; modelo_nome: string | null; ano_modelo: string | null } | null;
  premios: Premio[];
};

const money = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const pad = (n: number) => String(n).padStart(5, "0");
const cotNum = (numero: number) => `COT-${new Date().getFullYear()}-${pad(numero)}`;

function statusChip(s: string) {
  const label = s === "calculada" ? "Aberta" : s === "proposta" ? "Em ajuste" : s;
  const cls = s === "calculada" ? "chip-info" : s === "proposta" ? "chip-yellow" : "chip-outline";
  return <span className={`chip chip-status ${cls}`}>{label}</span>;
}
function expiraChip(criadoEm: string) {
  const created = new Date(criadoEm).getTime();
  const exp = created + 5 * 24 * 60 * 60 * 1000;
  const d = Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000));
  if (d <= 0) return <span className="chip chip-alert" style={{ minWidth: 72 }}>Hoje</span>;
  if (d <= 3) return <span className="chip chip-alert" style={{ minWidth: 72 }}>{d}d</span>;
  if (d <= 5) return <span className="chip chip-yellow" style={{ minWidth: 72 }}>{d}d</span>;
  return <span className="chip chip-outline" style={{ minWidth: 72 }}>{d}d</span>;
}

function Page() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select(
          "id,numero,status,ramo,criado_em,atualizado_em," +
            "segurado:cotacao_segurado(nome)," +
            "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)," +
            "premios:cotacao_premios(seguradora,premio)"
        )
        .in("status", ["calculada", "proposta"])
        .order("atualizado_em", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const t = `${cotNum(r.numero)} ${r.segurado?.nome ?? ""} ${r.veiculo?.modelo_nome ?? ""}`.toLowerCase();
        return !q || t.includes(q.toLowerCase());
      }),
    [rows, q]
  );

  const totVal = filtered.reduce((a, r) => {
    const best = r.premios?.length ? Math.min(...r.premios.map((p) => Number(p.premio) || 0)) : 0;
    return a + best;
  }, 0);

  return (
    <AppShell title="Cotações">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Cotações</h1>
          <div className="sub">
            {filtered.length} cotações ativas · valor total estimado <strong>{money(totVal)}/ano</strong>
          </div>
        </div>
        <div className="tools">
          <Link to="/venda/novo-lead" className="btn btn-yellow">
            + Nova cotação
          </Link>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <select className="select-mini">
          <option>Período · este mês</option>
          <option>Últimos 30 dias</option>
        </select>
        <select className="select-mini">
          <option>Status · todos</option>
          <option>Aberta</option>
          <option>Em ajuste</option>
        </select>
        <input
          className="select-mini"
          placeholder="Buscar segurado, placa, nº cotação…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-link btn-sm" onClick={() => setQ("")}>Limpar</button>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Nenhuma cotação ativa. Cotações aparecem aqui depois que o cálculo é solicitado.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Nº COTAÇÃO</th>
                <th>SEGURADO</th>
                <th>VEÍCULO</th>
                <th style={{ textAlign: "center" }}>SEGURADORAS</th>
                <th style={{ textAlign: "right" }}>MELHOR PREÇO</th>
                <th>STATUS</th>
                <th>CRIADA</th>
                <th>EXPIRA EM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const best = r.premios?.length
                  ? r.premios.reduce((m, p) => (Number(p.premio) < Number(m.premio) ? p : m))
                  : null;
                const veic = r.veiculo
                  ? `${r.veiculo.marca_nome ?? ""} ${r.veiculo.modelo_nome ?? ""} ${r.veiculo.ano_modelo ?? ""}`.trim()
                  : "—";
                return (
                  <tr
                    key={r.id}
                    onClick={() =>
                      nav({ to: "/venda/novo-lead", search: { id: r.id } })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td className="small muted" style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>
                      #{cotNum(r.numero)}
                    </td>
                    <td><strong>{r.segurado?.nome || "—"}</strong></td>
                    <td>{veic}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="chip chip-outline">{r.premios?.length || 0} cotadas</span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {best ? (
                        <>
                          <strong>{money(Number(best.premio))}</strong>
                          <br />
                          <span className="muted small">{best.seguradora}</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{statusChip(r.status)}</td>
                    <td className="small muted">
                      {new Date(r.criado_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </td>
                    <td>{expiraChip(r.criado_em)}</td>
                    <td>›</td>
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
