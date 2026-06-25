import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/vendedores/")({
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

type Presence = { user_id: string; status_efetivo: "online" | "ausente" | "offline"; last_seen_at: string };

type LeadRow = {
  responsavel_id: string | null;
  status_pipeline: string | null;
  criado_em: string | null;
  assumido_em: string | null;
};

type Extra = { cotacoes: number; propostas: number; primeiroMin: number | null };

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

function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function presenceDot(p?: Presence) {
  const s = p?.status_efetivo ?? "offline";
  const color = s === "online" ? "var(--ok, #16a34a)" : s === "ausente" ? "var(--yellow, #ca8a04)" : "var(--muted, #94a3b8)";
  const label = s === "online" ? "Online" : s === "ausente" ? "Ausente" : "Offline";
  const title = s === "online" ? "Online agora" : s === "ausente" ? `Ausente · visto há ${timeAgo(p?.last_seen_at)}` : p?.last_seen_at ? `Offline · visto há ${timeAgo(p?.last_seen_at)}` : "Nunca conectou";
  return (
    <span className="row" style={{ gap: 6, alignItems: "center" }} title={title}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block", boxShadow: s === "online" ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` : "none" }} />
      <span className="small" style={{ fontWeight: 600 }}>{label}</span>
    </span>
  );
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

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [extras, setExtras] = useState<Record<string, Extra>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const now = new Date();
  const [mesIdx, setMesIdx] = useState(now.getMonth());
  const [ano, setAno] = useState(now.getFullYear());

  const periodo = useMemo(() => {
    const start = new Date(ano, mesIdx, 1, 0, 0, 0, 0);
    const end = new Date(ano, mesIdx + 1, 1, 0, 0, 0, 0);
    return { start, end };
  }, [ano, mesIdx]);

  const opcoes = useMemo(() => {
    const out: { label: string; value: string; m: number; y: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        label: `${MESES_LONG[d.getMonth()]} / ${d.getFullYear()}`,
        value: `${d.getFullYear()}-${d.getMonth()}`,
        m: d.getMonth(),
        y: d.getFullYear(),
      });
    }
    return out;
  }, [now]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [{ data, error }, pres, lq] = await Promise.all([
        supabase.from("v_vendedor_kpis").select("*").order("vendas_mes", { ascending: false }),
        supabase.from("v_user_presence").select("user_id,status_efetivo,last_seen_at"),
        supabase
          .from("leads")
          .select("responsavel_id,status_pipeline,criado_em,assumido_em")
          .gte("criado_em", periodo.start.toISOString())
          .lt("criado_em", periodo.end.toISOString()),
      ]);
      if (!alive) return;
      if (error) setErr(error.message);
      else setRows((data ?? []) as Row[]);

      const map: Record<string, Presence> = {};
      ((pres.data ?? []) as Presence[]).forEach((p) => { map[p.user_id] = p; });
      setPresence(map);

      // métricas por vendedor a partir dos leads
      const ex: Record<string, Extra> = {};
      const acumulaTempo: Record<string, number[]> = {};
      ((lq.data ?? []) as LeadRow[]).forEach((l) => {
        if (!l.responsavel_id) return;
        const cur = ex[l.responsavel_id] ?? { cotacoes: 0, propostas: 0, primeiroMin: null };
        const sp = l.status_pipeline ?? "";
        if (["cotando", "cotacao", "proposta_enviada", "em_negociacao", "proposta", "negociacao", "ganho", "fechado"].includes(sp)) {
          cur.cotacoes += 1;
        }
        if (["proposta_enviada", "em_negociacao", "proposta", "negociacao", "ganho", "fechado"].includes(sp)) {
          cur.propostas += 1;
        }
        ex[l.responsavel_id] = cur;
        if (l.criado_em && l.assumido_em) {
          const min = (new Date(l.assumido_em).getTime() - new Date(l.criado_em).getTime()) / 60000;
          if (min >= 0 && min < 60 * 24) {
            (acumulaTempo[l.responsavel_id] ??= []).push(min);
          }
        }
      });
      Object.entries(acumulaTempo).forEach(([uid, arr]) => {
        if (!arr.length) return;
        arr.sort((a, b) => a - b);
        const median = arr[Math.floor(arr.length / 2)];
        ex[uid] = { ...(ex[uid] ?? { cotacoes: 0, propostas: 0, primeiroMin: null }), primeiroMin: Math.round(median) };
      });
      setExtras(ex);

      setLoading(false);
    };
    void load();
    const t = window.setInterval(load, 30_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [periodo.start, periodo.end]);

  function exportar() {
    const head = ["Vendedor", "Franquia", "Presença", "Leads", "1º contato", "Cotações", "Propostas", "Vendas", "Conv.", "Comissão", "Meta", "Status"];
    const lines = rows.map((r) => {
      const ex = extras[r.user_id] ?? { cotacoes: 0, propostas: 0, primeiroMin: null };
      const conv = r.leads_mes > 0 ? Math.round((r.vendas_mes / r.leads_mes) * 100) : 0;
      const p = presence[r.user_id]?.status_efetivo ?? "offline";
      return [
        r.nome || r.email,
        r.empresa_nome ?? "",
        p,
        r.leads_mes,
        ex.primeiroMin != null ? `${ex.primeiroMin} min` : "—",
        ex.cotacoes,
        ex.propostas,
        r.vendas_mes,
        `${conv}%`,
        fmtBRL(Number(r.comissao_mes) || 0),
        r.meta_vendas ? `${r.vendas_mes}/${r.meta_vendas}` : "—",
        r.status,
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",");
    });
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendedores_${MESES[mesIdx]}_${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Vendedores">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Vendedores</h1>
          <div className="sub">Quem está vendendo, quem travou e quem precisa de apoio</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <select
            className="select-mini"
            value={`${ano}-${mesIdx}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setAno(y);
              setMesIdx(m);
            }}
          >
            {opcoes.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn btn-ghost" onClick={exportar}>
            <svg width="14" height="14"><use href="#i-download"></use></svg> Exportar
          </button>
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
          <table className="table-pipe mtable" style={{ minWidth: 1180 }}>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Franquia</th>
                <th>Presença</th>
                <th>Leads</th>
                <th>1º contato</th>
                <th>Cotações</th>
                <th>Propostas</th>
                <th>Vendas</th>
                <th>Conv.</th>
                <th>Comissão</th>
                <th>Meta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const conv = r.leads_mes > 0 ? Math.round((r.vendas_mes / r.leads_mes) * 100) : 0;
                const ex = extras[r.user_id] ?? { cotacoes: 0, propostas: 0, primeiroMin: null };
                return (
                  <tr key={r.user_id}>
                    <td><strong>{r.nome || r.email}</strong></td>
                    <td><small>{r.empresa_nome ?? "—"}</small></td>
                    <td>{presenceDot(presence[r.user_id])}</td>
                    <td>{r.leads_mes}</td>
                    <td>{ex.primeiroMin != null ? `${ex.primeiroMin} min` : "—"}</td>
                    <td>{ex.cotacoes}</td>
                    <td>{ex.propostas}</td>
                    <td><strong>{r.vendas_mes}</strong></td>
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
