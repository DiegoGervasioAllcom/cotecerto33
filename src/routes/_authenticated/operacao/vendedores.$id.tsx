import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/vendedores/$id")({
  head: () => ({ meta: [{ title: "Vendedor · CoteCerto" }] }),
  component: Page,
});

type Kpi = {
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
  (Number(n) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function statusChip(status: string, vendas: number, meta: number | null) {
  if (status !== "aprovada") return <span className="chip chip-slate">{status}</span>;
  if (!meta || meta <= 0) return <span className="chip chip-info">Ativo</span>;
  const pct = vendas / meta;
  if (pct >= 0.8) return <span className="chip chip-ok">Ativo</span>;
  if (pct >= 0.4) return <span className="chip chip-yellow">Atenção</span>;
  return <span className="chip chip-alert">Travado</span>;
}

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="row" style={{ alignItems: "center", gap: 12, marginBottom: 10 }}>
      <div style={{ width: 130, color: "var(--muted)", fontSize: 13, textAlign: "right" }}>
        {label}
      </div>
      <div
        style={{
          flex: 1,
          background: "#e2e8f0",
          borderRadius: 6,
          height: 28,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            background: color,
            height: "100%",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            paddingLeft: 10,
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [counts, setCounts] = useState({ leads: 0, cotacoes: 0, propostas: 0, vendas: 0 });
  const [primeiroContatoMin, setPrimeiroContatoMin] = useState<number | null>(null);
  const [premioTotal, setPremioTotal] = useState(0);
  const [cancelamentos, setCancelamentos] = useState(0);
  const [porSeguradora, setPorSeguradora] = useState<{ nome: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        const [kRes, lRes, pRes, oRes] = await Promise.all([
          supabase.from("v_vendedor_kpis").select("*").eq("user_id", id).maybeSingle(),
          supabase
            .from("leads")
            .select("status_pipeline,criado_em,ultimo_atendimento_em")
            .eq("responsavel_id", id)
            .gte("criado_em", start.toISOString())
            .lt("criado_em", end.toISOString()),
          supabase
            .from("propostas")
            .select("seguradora,status,premio,valor")
            .eq("responsavel_id", id)
            .gte("criado_em", start.toISOString())
            .lt("criado_em", end.toISOString()),
          supabase
            .from("oportunidades")
            .select("valor")
            .eq("responsavel_id", id)
            .gte("criado_em", start.toISOString())
            .lt("criado_em", end.toISOString()),
        ]);
        if (!alive) return;

        if (kRes.error) throw kRes.error;
        const k = kRes.data as Kpi | null;
        setKpi(k);

        const leadsArr = (lRes.data ?? []) as {
          status_pipeline: string | null;
          criado_em: string | null;
          ultimo_atendimento_em: string | null;
        }[];
        let cot = 0,
          prop = 0,
          vend = 0;
        const tempos: number[] = [];
        leadsArr.forEach((l) => {
          const sp = l.status_pipeline ?? "";
          if (
            [
              "cotando",
              "cotacao",
              "proposta_enviada",
              "em_negociacao",
              "proposta",
              "negociacao",
              "ganho",
              "fechado",
            ].includes(sp)
          )
            cot++;
          if (
            [
              "proposta_enviada",
              "em_negociacao",
              "proposta",
              "negociacao",
              "ganho",
              "fechado",
            ].includes(sp)
          )
            prop++;
          if (["ganho", "fechado"].includes(sp)) vend++;
          if (l.criado_em && l.ultimo_atendimento_em) {
            const m =
              (new Date(l.ultimo_atendimento_em).getTime() - new Date(l.criado_em).getTime()) /
              60000;
            if (m >= 0 && m < 60 * 24) tempos.push(m);
          }
        });
        tempos.sort((a, b) => a - b);
        setPrimeiroContatoMin(
          tempos.length ? Math.round(tempos[Math.floor(tempos.length / 2)]) : null,
        );

        const propostas = (pRes.data ?? []) as {
          seguradora: string | null;
          status: string | null;
          premio: number | null;
        }[];
        const segMap = new Map<string, number>();
        let premio = 0;
        propostas.forEach((p) => {
          const s = (p.seguradora || "Outras").trim() || "Outras";
          segMap.set(s, (segMap.get(s) ?? 0) + 1);
          premio += Number(p.premio) || 0;
        });
        const arr = Array.from(segMap.entries())
          .map(([nome, total]) => ({ nome, total }))
          .sort((a, b) => b.total - a.total);
        setPorSeguradora(arr);
        setPremioTotal(premio);

        // cancelamentos: oportunidades não tem coluna status — a fonte correta é propostas (bug pego pelo typegen)
        setCancelamentos(
          propostas.filter((p) =>
            ["cancelada", "estornada", "cancelado", "estornado"].includes(
              (p.status || "").toLowerCase(),
            ),
          ).length,
        );

        const realVendas = k?.vendas_mes ?? vend;
        setCounts({
          leads: k?.leads_mes ?? leadsArr.length,
          cotacoes: cot,
          propostas: prop,
          vendas: realVendas,
        });
      } catch (e: unknown) {
        if (!alive) return;
        setErr((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const conv = counts.leads > 0 ? Math.round((counts.vendas / counts.leads) * 100) : 0;
  const premioMedio = counts.vendas > 0 ? Math.round(premioTotal / counts.vendas) : 0;
  const maxFunil = Math.max(counts.leads, counts.cotacoes, counts.propostas, counts.vendas, 1);
  const maxSeg = Math.max(1, ...porSeguradora.map((s) => s.total));

  return (
    <AppShell title="Vendedores">
      <ProtoIcons />

      <div className="row" style={{ alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Link
          to="/operacao/vendedores"
          style={{
            color: "var(--muted)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
          <svg width="14" height="14">
            <use href="#i-chevron-left"></use>
          </svg>{" "}
          Todos os vendedores
        </Link>
      </div>

      <div className="page-head">
        <div>
          <h1 style={{ marginBottom: 2 }}>{kpi?.nome || kpi?.email || "Vendedor"}</h1>
          <div className="sub">{kpi?.empresa_nome ?? "—"} · performance individual</div>
        </div>
        <div>{kpi && statusChip(kpi.status, counts.vendas, kpi.meta_vendas)}</div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && (
        <div className="card">
          <div className="card-b" style={{ padding: 24, color: "var(--muted)" }}>
            Carregando…
          </div>
        </div>
      )}

      {!loading && kpi && (
        <>
          <div
            className="grid-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <KpiCard
              title="LEADS RECEBIDOS"
              value={String(counts.leads)}
              hint={primeiroContatoMin != null ? `${primeiroContatoMin} min 1º contato` : "—"}
              icon="i-layers"
            />
            <KpiCard
              title="COTAÇÕES"
              value={String(counts.cotacoes)}
              hint={`${counts.propostas} propostas enviadas`}
              icon="i-grid"
            />
            <KpiCard
              title="VENDAS"
              value={String(counts.vendas)}
              hint={kpi.meta_vendas ? `meta ${kpi.meta_vendas}` : "—"}
              icon="i-check-circle"
            />
            <KpiCard title="CONVERSÃO" value={`${conv}%`} hint="lead → apólice" icon="i-percent" />
            <KpiCard
              title="COMISSÃO"
              value={fmtBRL(kpi.comissao_mes)}
              hint={premioMedio ? `prêmio: ${fmtBRL(premioMedio)}` : "—"}
              icon="i-dollar"
            />
            <KpiCard
              title="CANCELAMENTOS"
              value={String(cancelamentos)}
              hint="vinculados a este vendedor"
              icon="i-refresh-cw"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="card">
              <div className="card-h">
                <strong>
                  <svg width="14" height="14" style={{ verticalAlign: -2 }}>
                    <use href="#i-gauge"></use>
                  </svg>{" "}
                  Funil individual
                </strong>
              </div>
              <div className="card-b" style={{ padding: 18 }}>
                <Bar label="Leads recebidos" value={counts.leads} max={maxFunil} color="#1f2a44" />
                <Bar label="Cotações" value={counts.cotacoes} max={maxFunil} color="#324265" />
                <Bar label="Propostas" value={counts.propostas} max={maxFunil} color="#4a5b7e" />
                <Bar label="Vendas" value={counts.vendas} max={maxFunil} color="#f5b400" />
              </div>
            </div>

            <div className="card">
              <div className="card-h">
                <strong>
                  <svg width="14" height="14" style={{ verticalAlign: -2 }}>
                    <use href="#i-shield"></use>
                  </svg>{" "}
                  Performance por seguradora
                </strong>
              </div>
              <div className="card-b" style={{ padding: 18 }}>
                {porSeguradora.length === 0 ? (
                  <div className="small muted">Sem propostas no período.</div>
                ) : (
                  porSeguradora.map((s) => (
                    <Bar key={s.nome} label={s.nome} value={s.total} max={maxSeg} color="#1f2a44" />
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: string;
}) {
  return (
    <div className="card" style={{ borderTop: "3px solid #f5b400" }}>
      <div className="card-b" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div
              style={{ fontSize: 11, color: "var(--muted)", letterSpacing: 0.4, fontWeight: 700 }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "var(--primary, #0f172a)",
                marginTop: 4,
              }}
            >
              {value}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {hint}
            </div>
          </div>
          <svg width="18" height="18" style={{ color: "var(--muted)" }}>
            <use href={`#${icon}`}></use>
          </svg>
        </div>
      </div>
    </div>
  );
}
