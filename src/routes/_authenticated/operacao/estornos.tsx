import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/estornos")({
  head: () => ({ meta: [{ title: "Estornos · CoteCerto" }] }),
  component: Page,
});

function maskCpfCnpj(v: string): string {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 11)
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4").replace(/[-.]+$/, "");
  return d
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5")
    .replace(/[-./]+$/, "");
}

type Estorno = {
  id: string;
  numero: string | null;
  apolice_numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  comissao_valor: number | null;
  cancelada_em: string | null;
  cancelamento_motivo: string | null;
  empresa_id: string | null;
  responsavel_id: string | null;
  cotacoes: {
    segurado: { nome: string | null; cpf_cnpj: string | null }[] | null;
  } | null;
};
type Empresa = { id: string; nome: string };
type Profile = { id: string; nome: string };

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "—";

function monthRange(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const ini = new Date(d.getFullYear(), d.getMonth(), 1);
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const label = ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return {
    ini: ini.toISOString(),
    fim: fim.toISOString(),
    label: label.charAt(0).toUpperCase() + label.slice(1),
    iniDate: ini,
    fimDate: fim,
  };
}

function Page() {
  const [periodOffset, setPeriodOffset] = useState(0);
  const period = useMemo(() => monthRange(periodOffset), [periodOffset]);
  const [rows, setRows] = useState<Estorno[]>([]);
  const [vendasMes, setVendasMes] = useState<number>(0);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const [props, vendas, emps, profs] = await Promise.all([
        supabase
          .from("propostas")
          .select(
            "id,numero,apolice_numero,seguradora,premio,valor,comissao_valor,cancelada_em,cancelamento_motivo,empresa_id,responsavel_id," +
              "cotacoes(segurado:cotacao_segurado(nome,cpf_cnpj))",
          )
          .not("cancelada_em", "is", null)
          .gte("cancelada_em", period.ini)
          .lt("cancelada_em", period.fim)
          .order("cancelada_em", { ascending: false })
          .limit(2000),
        supabase
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .not("emitida_em", "is", null)
          .gte("emitida_em", period.ini)
          .lt("emitida_em", period.fim),
        supabase.from("empresas").select("id,nome"),
        supabase.from("profiles").select("id,nome"),
      ]);
      if (props.error) setErr(props.error.message);
      setRows((props.data ?? []) as unknown as Estorno[]);
      setVendasMes(vendas.count ?? 0);
      const em: Record<string, Empresa> = {};
      for (const e of (emps.data ?? []) as Empresa[]) em[e.id] = e;
      setEmpresas(em);
      const pm: Record<string, Profile> = {};
      for (const p of (profs.data ?? []) as Profile[]) pm[p.id] = p;
      setProfiles(pm);
      setLoading(false);
    })();
  }, [period.ini, period.fim]);

  const kpis = useMemo(() => {
    const n = rows.length;
    const premio = rows.reduce((s, r) => s + Number(r.premio ?? r.valor ?? 0), 0);
    const com = rows.reduce((s, r) => s + Number(r.comissao_valor ?? 0), 0);
    const taxa = vendasMes > 0 ? (n / vendasMes) * 100 : 0;
    return { n, premio, com, taxa };
  }, [rows, vendasMes]);

  const periodOpts = useMemo(
    () => [0, -1, -2, -3].map((o) => ({ off: o, label: monthRange(o).label })),
    [],
  );

  function exportCsv() {
    const headers = [
      "Apólice",
      "Seguradora",
      "Segurado",
      "CPF/CNPJ",
      "Vendedor",
      "Franquia",
      "Prêmio",
      "Comissão revertida",
      "Data",
      "Motivo",
    ];
    const lines = [headers.join(";")];
    for (const r of rows) {
      const seg = r.cotacoes?.segurado?.[0];
      lines.push(
        [
          r.apolice_numero || r.numero || "",
          r.seguradora || "",
          seg?.nome || "",
          maskCpfCnpj(seg?.cpf_cnpj || ""),
          profiles[r.responsavel_id || ""]?.nome || "",
          empresas[r.empresa_id || ""]?.nome || "",
          fmtBRL(Number(r.premio ?? r.valor ?? 0)),
          fmtBRL(Number(r.comissao_valor ?? 0)),
          fmtDate(r.cancelada_em),
          r.cancelamento_motivo || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estornos-${period.label.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Estornos">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Estornos e cancelamentos</h1>
          <div className="sub">Onde a comissão volta e por quê — para a Matriz agir rápido</div>
        </div>
        <div className="tools">
          <select
            className="select-mini"
            value={periodOffset}
            onChange={(e) => setPeriodOffset(Number(e.target.value))}
          >
            {periodOpts.map((p) => (
              <option key={p.off} value={p.off}>
                {p.label}
              </option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={exportCsv}>
            <svg width="14" height="14">
              <use href="#i-download" />
            </svg>{" "}
            Exportar
          </button>
        </div>
      </div>

      <div className="mkpi-grid">
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-refresh" />
            </svg>
          </div>
          <div className="lbl">ESTORNOS NO MÊS</div>
          <div className="val" style={{ fontSize: 22 }}>
            {kpis.n}
          </div>
          <div className="meta">taxa de {kpis.taxa.toFixed(1)}% das vendas</div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-dollar" />
            </svg>
          </div>
          <div className="lbl">PRÊMIO ESTORNADO</div>
          <div className="val" style={{ fontSize: 22 }}>
            {fmtBRL(kpis.premio)}
          </div>
          <div className="meta">em apólices canceladas</div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-percent" />
            </svg>
          </div>
          <div className="lbl">COMISSÃO REVERTIDA</div>
          <div className="val" style={{ fontSize: 22 }}>
            {fmtBRL(kpis.com)}
          </div>
          <div className="meta">descontada no fechamento</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table-pipe mtable" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>Apólice</th>
              <th>Seguradora</th>
              <th>Segurado</th>
              <th>Vendedor</th>
              <th>Franquia</th>
              <th>Prêmio</th>
              <th>Comissão revertida</th>
              <th>Data</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 16 }}>
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && err && (
              <tr>
                <td colSpan={9} style={{ color: "var(--alert)", padding: 16 }}>
                  {err}
                </td>
              </tr>
            )}
            {!loading && !err && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 16 }}>
                  Nenhum estorno registrado em {period.label}.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const seg = r.cotacoes?.segurado?.[0];
              return (
                <tr key={r.id}>
                  <td>
                    <strong>{r.apolice_numero || r.numero || "—"}</strong>
                  </td>
                  <td>{r.seguradora || "—"}</td>
                  <td>
                    <div className="mini-cell">
                      <strong>{seg?.nome || "—"}</strong>
                      <small>{maskCpfCnpj(seg?.cpf_cnpj || "")}</small>
                    </div>
                  </td>
                  <td>
                    <small>{profiles[r.responsavel_id || ""]?.nome || "—"}</small>
                  </td>
                  <td>
                    <small>{empresas[r.empresa_id || ""]?.nome || "—"}</small>
                  </td>
                  <td>{fmtBRL(Number(r.premio ?? r.valor ?? 0))}</td>
                  <td>
                    <strong style={{ color: "var(--alert)" }}>
                      − {fmtBRL(Number(r.comissao_valor ?? 0))}
                    </strong>
                  </td>
                  <td>
                    <small className="muted">{fmtDate(r.cancelada_em)}</small>
                  </td>
                  <td>
                    <span className="chip chip-alert">
                      {r.cancelamento_motivo || "Cancelamento"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
