import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/franquias/$id")({
  head: () => ({ meta: [{ title: "Franquia · CoteCerto" }] }),
  component: Page,
});

type Kpi = {
  empresa_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  status: string;
  leads_mes: number;
  em_aberto: number;
  perdidos_mes: number;
  vendas_mes: number;
  faturamento_mes: number;
  comissao_mes: number;
  meta_vendas: number | null;
  meta_faturamento: number | null;
};

type Vendedor = {
  user_id: string;
  nome: string;
  vendas_mes: number;
  leads_mes: number;
  em_negociacao: number;
};

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

function Page() {
  const { id } = Route.useParams();
  const [k, setK] = useState<Kpi | null>(null);
  const [resp, setResp] = useState<string>("—");
  const [ativos, setAtivos] = useState<number>(0);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [funil, setFunil] = useState({
    recebidos: 0,
    atendidos: 0,
    cotando: 0,
    proposta: 0,
    fechado: 0,
  });
  const [pendNaoPagas, setPendNaoPagas] = useState(0);
  const [estornos, setEstornos] = useState(0);
  const [mesAntVendas, setMesAntVendas] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: kpi, error: e1 }, { data: profs }] = await Promise.all([
        supabase.from("v_franquia_kpis").select("*").eq("empresa_id", id).maybeSingle(),
        supabase
          .from("profiles")
          .select("id,nome,empresa_id,status")
          .eq("empresa_id", id)
          .eq("status", "aprovada"),
      ]);
      if (e1) setErr(e1.message);
      if (kpi) setK(kpi as Kpi);

      // responsável + nº vendedores ativos
      const lista = (profs ?? []) as { id: string; nome: string }[];
      setAtivos(lista.length);
      if (lista[0]) setResp(lista[0].nome);

      // vendedores ranking
      const { data: vk } = await supabase
        .from("v_vendedor_kpis")
        .select("user_id,nome,vendas_mes,leads_mes,em_negociacao")
        .eq("empresa_id", id)
        .order("vendas_mes", { ascending: false })
        .limit(5);
      setVendedores((vk ?? []) as Vendedor[]);

      // funil — usando leads do mês
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { data: leads } = await supabase
        .from("leads")
        .select("status_pipeline,ultimo_atendimento_em,criado_em")
        .eq("empresa_id", id)
        .gte("criado_em", start.toISOString());
      const ll = (leads ?? []) as {
        status_pipeline: string | null;
        ultimo_atendimento_em: string | null;
      }[];
      const has = (s: string) => ll.filter((x) => x.status_pipeline === s).length;
      const recebidos = ll.length;
      const atendidos = ll.filter(
        (x) => x.ultimo_atendimento_em || (x.status_pipeline && x.status_pipeline !== "novo"),
      ).length;
      const cotando = has("cotando") + has("cotacao");
      const proposta =
        has("proposta_enviada") + has("em_negociacao") + has("proposta") + has("negociacao");
      const fechado = has("ganho") + has("fechado");
      setFunil({ recebidos, atendidos, cotando, proposta, fechado });

      // estornos & pendências financeiras
      const { count: estCount } = await supabase
        .from("propostas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", id)
        .eq("status", "estornada")
        .gte("criado_em", start.toISOString());
      setEstornos(estCount ?? 0);

      const { count: pendCount } = await supabase
        .from("oportunidades")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", id)
        .eq("comissao_paga", false);
      setPendNaoPagas(pendCount ?? 0);

      // vendas mês anterior
      const prev = new Date(start);
      prev.setMonth(prev.getMonth() - 1);
      const prevEnd = new Date(start);
      const { count: prevCount } = await supabase
        .from("oportunidades")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", id)
        .gte("criado_em", prev.toISOString())
        .lt("criado_em", prevEnd.toISOString());
      setMesAntVendas(prevCount ?? 0);

      setLoading(false);
    })();
  }, [id]);

  const max = useMemo(
    () =>
      Math.max(1, funil.recebidos, funil.atendidos, funil.cotando, funil.proposta, funil.fechado),
    [funil],
  );

  const vendasMeta = k?.meta_vendas ?? 0;
  const vendas = k?.vendas_mes ?? 0;
  const pct = vendasMeta > 0 ? Math.round((vendas / vendasMeta) * 100) : 0;
  const conv = k && k.leads_mes > 0 ? Math.round((k.vendas_mes / k.leads_mes) * 100) : 0;
  const diff = vendas - mesAntVendas;

  function bar(label: string, value: number, color: string) {
    const w = Math.round((value / max) * 100);
    return (
      <div className="row" style={{ alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div className="small muted" style={{ width: 130, textAlign: "right" }}>
          {label}
        </div>
        <div
          style={{
            flex: 1,
            background: "#f1f3f6",
            borderRadius: 6,
            height: 28,
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${w}%`,
              background: color,
              height: "100%",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              padding: "0 10px",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="Franquias">
      <ProtoIcons />
      {err && <div className="alert alert-err">{err}</div>}

      {/* breadcrumb */}
      <div className="row" style={{ marginBottom: 12 }}>
        <Link
          to="/operacao/franquias"
          className="row"
          style={{ gap: 6, color: "var(--muted)", textDecoration: "none", fontSize: 13 }}
        >
          <svg width="14" height="14">
            <use href="#i-chevron-left"></use>
          </svg>{" "}
          Todas as franquias
        </Link>
      </div>

      {/* título + ações */}
      <div
        className="row"
        style={{ alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}
      >
        <div>
          <h1 style={{ margin: 0 }}>{k?.nome ?? (loading ? "Carregando…" : "Franquia")}</h1>
          <div className="sub" style={{ marginTop: 4 }}>
            {k?.cidade ? `${k.cidade}${k.uf ? "/" + k.uf : ""}` : "—"} · responsável{" "}
            <strong>{resp}</strong> · {ativos} vendedor{ativos === 1 ? "" : "es"} ativo
            {ativos === 1 ? "" : "s"}
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {k && statusChip(k.vendas_mes, k.meta_vendas)}
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <svg width="14" height="14">
              <use href="#i-download"></use>
            </svg>{" "}
            Exportar
          </button>
        </div>
      </div>

      {/* KPIs 3x2 */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="kpi">
          <div className="lbl">LEADS RECEBIDOS</div>
          <div className="val">{k?.leads_mes ?? 0}</div>
          <div className="meta">
            {k?.em_aberto ?? 0} em aberto · {k?.perdidos_mes ?? 0} perdidos
          </div>
          <div className="ic-wrap">
            <svg>
              <use href="#i-layers"></use>
            </svg>
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">CONVERSÃO</div>
          <div className="val">{conv}%</div>
          <div className="meta">lead → apólice</div>
          <div className="ic-wrap">
            <svg>
              <use href="#i-percent"></use>
            </svg>
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">VENDAS</div>
          <div className="val">{vendas}</div>
          <div className="meta">
            meta {vendasMeta || 0}
            {mesAntVendas > 0 && (
              <>
                {" "}
                · {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)} vs. mês ant.
              </>
            )}
          </div>
          <div className="ic-wrap">
            <svg>
              <use href="#i-check"></use>
            </svg>
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">FATURAMENTO</div>
          <div className="val">{fmtBRL(Number(k?.faturamento_mes) || 0)}</div>
          <div className="meta">prêmio emitido</div>
          <div className="ic-wrap">
            <svg>
              <use href="#i-dollar"></use>
            </svg>
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">COMISSÃO</div>
          <div className="val">{fmtBRL(Number(k?.comissao_mes) || 0)}</div>
          <div className="meta">
            {estornos} estorno{estornos === 1 ? "" : "s"}
          </div>
          <div className="ic-wrap">
            <svg>
              <use href="#i-tag"></use>
            </svg>
          </div>
        </div>
        <div className="kpi">
          <div className="lbl">PENDÊNCIAS FIN.</div>
          <div className="val">{pendNaoPagas}</div>
          <div className="meta">vendas não pagas</div>
          <div className="ic-wrap">
            <svg>
              <use href="#i-alert-triangle"></use>
            </svg>
          </div>
        </div>
      </div>

      {/* funil + vendedores */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="14" height="14" style={{ verticalAlign: "-2px", marginRight: 6 }}>
                <use href="#i-gauge"></use>
              </svg>
              Funil da unidade
            </h3>
          </div>
          <div className="card-b">
            {bar("Leads recebidos", funil.recebidos, "var(--slate-dark, #2c3a45)")}
            {bar("Atendidos", funil.atendidos, "var(--slate-dark, #2c3a45)")}
            {bar("Cotando", funil.cotando, "var(--slate-dark, #2c3a45)")}
            {bar("Proposta", funil.proposta, "var(--yellow)")}
            {bar("Fechado", funil.fechado, "var(--ok, #22b07d)")}
          </div>
        </div>

        <div className="card">
          <div className="card-h" style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>
              <svg width="14" height="14" style={{ verticalAlign: "-2px", marginRight: 6 }}>
                <use href="#i-users"></use>
              </svg>
              Vendedores
            </h3>
            <Link to="/operacao/vendedores" style={{ fontSize: 12, color: "var(--muted)" }}>
              Ver todos
            </Link>
          </div>
          <div className="card-b" style={{ paddingTop: 0 }}>
            {vendedores.length === 0 && (
              <div className="small muted" style={{ padding: "12px 0" }}>
                Sem vendedores ativos nesta franquia.
              </div>
            )}
            {vendedores.map((v, i) => {
              const c = v.leads_mes > 0 ? Math.round((v.vendas_mes / v.leads_mes) * 100) : 0;
              return (
                <div
                  key={v.user_id}
                  className="row"
                  style={{
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: i < vendedores.length - 1 ? "1px solid #eef0f3" : "none",
                  }}
                >
                  <div className="row" style={{ gap: 10, alignItems: "center" }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "rgba(255,182,0,.18)",
                        color: "var(--slate-dark)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{v.nome}</div>
                      <div className="small muted">conv. {c}%</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{v.vendas_mes}</div>
                    <div className="small muted">vendas</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* meta + pendências */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 16 }}>
        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="14" height="14" style={{ verticalAlign: "-2px", marginRight: 6 }}>
                <use href="#i-target"></use>
              </svg>
              Meta do mês
            </h3>
          </div>
          <div className="card-b">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <div className="small muted">
                Apólices {vendas} de {vendasMeta || 0}
              </div>
              <div style={{ fontWeight: 700 }}>{pct}%</div>
            </div>
            <div style={{ height: 10, background: "#f1f3f6", borderRadius: 6, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, pct)}%`,
                  height: "100%",
                  background: pct >= 100 ? "var(--ok)" : "var(--yellow)",
                }}
              />
            </div>
            <div className="small muted" style={{ marginTop: 10 }}>
              Mês anterior: {mesAntVendas} apólices
              {diff !== 0 && (
                <>
                  {" "}
                  · {diff > 0 ? "crescimento" : "queda"} de {Math.abs(diff)}.
                </>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="14" height="14" style={{ verticalAlign: "-2px", marginRight: 6 }}>
                <use href="#i-alert-triangle"></use>
              </svg>
              Pendências
            </h3>
          </div>
          <div className="card-b" style={{ paddingTop: 4 }}>
            {pendNaoPagas === 0 && estornos === 0 && (
              <div className="small muted">Sem pendências.</div>
            )}
            {pendNaoPagas > 0 && (
              <div
                className="row"
                style={{
                  gap: 10,
                  padding: 10,
                  background: "#fff1f1",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#ffdada",
                    color: "#c44",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14">
                    <use href="#i-dollar"></use>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {pendNaoPagas} venda{pendNaoPagas === 1 ? "" : "s"} emitida
                    {pendNaoPagas === 1 ? "" : "s"} e não paga{pendNaoPagas === 1 ? "" : "s"}
                  </div>
                  <div className="small muted">Acompanhar baixa financeira</div>
                </div>
              </div>
            )}
            {estornos > 0 && (
              <div
                className="row"
                style={{ gap: 10, padding: 10, background: "#fff7e6", borderRadius: 8 }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: "#ffe5b3",
                    color: "#a76b00",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14">
                    <use href="#i-refresh"></use>
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {estornos} estorno{estornos === 1 ? "" : "s"} no mês
                  </div>
                  <div className="small muted">Revisar motivos e comissão</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
