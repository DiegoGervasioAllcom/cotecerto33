import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/renovacoes")({
  head: () => ({ meta: [{ title: "Renovações · CoteCerto" }] }),
  component: Page,
});

type Proposta = {
  id: string;
  apolice_numero: string | null;
  numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  vencimento: string | null;
  emitida_em: string | null;
  cancelada_em: string | null;
  tipo_venda: string | null;
  empresa_id: string | null;
  responsavel_id: string | null;
  cotacoes: {
    segurado: { nome: string | null }[] | null;
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

function daysUntil(s: string | null): number | null {
  if (!s) return null;
  const d = new Date(s);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function Page() {
  const [windowDays, setWindowDays] = useState<number>(90);
  const [rows, setRows] = useState<Proposta[]>([]);
  const [renovadas, setRenovadas] = useState<number>(0);
  const [perdidas, setPerdidas] = useState<number>(0);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit = new Date(today);
      limit.setDate(limit.getDate() + windowDays);
      const iniIso = today.toISOString().slice(0, 10);
      const fimIso = limit.toISOString().slice(0, 10);

      // janela retroativa = mesmo tamanho para "renovadas/perdidas no período"
      const retro = new Date(today);
      retro.setDate(retro.getDate() - windowDays);

      const [vencendo, renov, perd, emps, profs] = await Promise.all([
        supabase
          .from("propostas")
          .select(
            "id,apolice_numero,numero,seguradora,premio,valor,vencimento,emitida_em,cancelada_em,tipo_venda,empresa_id,responsavel_id," +
              "cotacoes(segurado:cotacao_segurado(nome))",
          )
          .not("vencimento", "is", null)
          .is("cancelada_em", null)
          .gte("vencimento", iniIso)
          .lte("vencimento", fimIso)
          .order("vencimento", { ascending: true })
          .limit(1000),
        supabase
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .eq("tipo_venda", "renovacao")
          .not("emitida_em", "is", null)
          .gte("emitida_em", retro.toISOString()),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("origem", "renovacao")
          .eq("status_pipeline", "perdido")
          .gte("atualizado_em", retro.toISOString()),
        supabase.from("empresas").select("id,nome"),
        supabase.from("profiles").select("id,nome"),
      ]);

      if (vencendo.error) setErr(vencendo.error.message);
      setRows((vencendo.data ?? []) as unknown as Proposta[]);
      setRenovadas(renov.count ?? 0);
      setPerdidas(perd.error ? 0 : perd.count ?? 0);
      const em: Record<string, Empresa> = {};
      for (const e of (emps.data ?? []) as Empresa[]) em[e.id] = e;
      setEmpresas(em);
      const pm: Record<string, Profile> = {};
      for (const p of (profs.data ?? []) as Profile[]) pm[p.id] = p;
      setProfiles(pm);
      setLoading(false);
    })();
  }, [windowDays]);

  const kpis = useMemo(() => {
    const total = renovadas + perdidas;
    const taxa = total > 0 ? Math.round((renovadas / total) * 100) : 0;
    return { aVencer: rows.length, renovadas, perdidas, taxa };
  }, [rows.length, renovadas, perdidas]);

  function exportCsv() {
    const headers = [
      "Cliente",
      "Apólice",
      "Seguradora",
      "Vencimento",
      "Prazo (dias)",
      "Prêmio atual",
      "Vendedor",
      "Franquia",
    ];
    const lines = [headers.join(";")];
    for (const r of rows) {
      const cliente = r.cotacoes?.segurado?.[0]?.nome || "";
      lines.push(
        [
          cliente,
          r.apolice_numero || r.numero || "",
          r.seguradora || "",
          fmtDate(r.vencimento),
          String(daysUntil(r.vencimento) ?? ""),
          fmtBRL(Number(r.premio ?? r.valor ?? 0)),
          profiles[r.responsavel_id || ""]?.nome || "",
          empresas[r.empresa_id || ""]?.nome || "",
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
    a.download = `renovacoes-${windowDays}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Renovações">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Renovações</h1>
          <div className="sub">
            CRM de renovação — algo que hoje a Supper não tem estruturado
          </div>
        </div>
        <div className="tools">
          <select
            className="select-mini"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            <option value={90}>Próximos 90 dias</option>
            <option value={60}>Próximos 60 dias</option>
            <option value={30}>Próximos 30 dias</option>
          </select>
          <button className="btn btn-ghost" onClick={exportCsv}>
            <svg width="14" height="14">
              <use href="#i-download" />
            </svg>{" "}
            Exportar
          </button>
        </div>
      </div>

      <div className="audit-note" style={{ marginBottom: 16 }}>
        <svg width="16" height="16">
          <use href="#i-refresh" />
        </svg>{" "}
        <strong style={{ marginRight: 4 }}>Gatilho automático.</strong> 60 dias
        antes do vencimento, o sistema cria um lead{" "}
        <strong style={{ margin: "0 4px" }}>"Renovação"</strong> na coluna
        "Novo" do pipeline e atribui ao vendedor da apólice — sem ninguém
        precisar lembrar.
      </div>

      <div className="mkpi-grid">
        <div className="kpi k-info">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-clock" />
            </svg>
          </div>
          <div className="lbl">A VENCER ({windowDays} DIAS)</div>
          <div className="val" style={{ fontSize: 22 }}>
            {kpis.aVencer}
          </div>
          <div className="meta">apólices ativas no período</div>
        </div>
        <div className="kpi k-ok">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-check-circle" />
            </svg>
          </div>
          <div className="lbl">RENOVADAS</div>
          <div className="val" style={{ fontSize: 22 }}>
            {kpis.renovadas}
          </div>
          <div className="meta">no período</div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-x" />
            </svg>
          </div>
          <div className="lbl">PERDIDAS</div>
          <div className="val" style={{ fontSize: 22 }}>
            {kpis.perdidas}
          </div>
          <div className="meta">não renovaram</div>
        </div>
        <div className="kpi ">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-percent" />
            </svg>
          </div>
          <div className="lbl">TAXA DE RENOVAÇÃO</div>
          <div className="val" style={{ fontSize: 22 }}>
            {kpis.taxa}%
          </div>
          <div className="meta">renovadas / encerradas</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table-pipe mtable" style={{ minWidth: 1000 }}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Apólice</th>
              <th>Seguradora</th>
              <th>Vencimento</th>
              <th>Prazo</th>
              <th>Prêmio atual</th>
              <th>Vendedor</th>
              <th>Franquia</th>
              <th>Status</th>
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
                <td
                  colSpan={9}
                  style={{ color: "var(--alert)", padding: 16 }}
                >
                  {err}
                </td>
              </tr>
            )}
            {!loading && !err && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ padding: 16 }}>
                  Nenhuma apólice vencendo nos próximos {windowDays} dias.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const cliente = r.cotacoes?.segurado?.[0]?.nome || "—";
              const dias = daysUntil(r.vencimento);
              const sla =
                dias === null
                  ? ""
                  : dias <= 15
                  ? "alert"
                  : dias <= 45
                  ? "warn"
                  : "ok";
              const chip = dias !== null && dias <= 60 ? "Lead criado" : "Monitorando";
              return (
                <tr key={r.id}>
                  <td>
                    <strong>{cliente}</strong>
                  </td>
                  <td>{r.apolice_numero || r.numero || "—"}</td>
                  <td>{r.seguradora || "—"}</td>
                  <td>
                    <small className="muted">{fmtDate(r.vencimento)}</small>
                  </td>
                  <td>
                    <span className={`sla-pill ${sla}`}>
                      {dias !== null ? `${dias} dias` : "—"}
                    </span>
                  </td>
                  <td>{fmtBRL(Number(r.premio ?? r.valor ?? 0))}</td>
                  <td>
                    <small>
                      {profiles[r.responsavel_id || ""]?.nome || "—"}
                    </small>
                  </td>
                  <td>
                    <small>{empresas[r.empresa_id || ""]?.nome || "—"}</small>
                  </td>
                  <td>
                    <span
                      className={`chip ${
                        chip === "Lead criado" ? "chip-yellow" : "chip-info"
                      }`}
                    >
                      {chip}
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
