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
};

type Lanc = {
  id: string;
  competencia: string | null;
  tipo: "credito" | "debito";
  valor: number;
  descricao: string;
  origem: string;
  criado_em: string;
};

type Meta = {
  ano: number;
  mes: number;
  meta_vendas: number;
  meta_faturamento: number;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

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
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [loadingLancs, setLoadingLancs] = useState(true);
  const [estornos, setEstornos] = useState<Estorno[]>([]);
  const [loadingEstornos, setLoadingEstornos] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  async function load() {
    setLoading(true);
    const ini = new Date(de + "T00:00:00").toISOString();
    const fim = new Date(ate + "T23:59:59").toISOString();
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id,numero,seguradora,premio,valor,transmitida_em," +
          "cotacoes(segurado:cotacao_segurado(nome))",
      )
      .eq("status", "transmitida")
      .gte("transmitida_em", ini)
      .lte("transmitida_em", fim)
      .order("transmitida_em", { ascending: false });
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  async function loadEstornos() {
    setLoadingEstornos(true);
    const ini = new Date(de + "T00:00:00").toISOString();
    const fim = new Date(ate + "T23:59:59").toISOString();
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id,numero,apolice_numero,seguradora,premio,valor,comissao_valor,cancelada_em,cancelamento_motivo",
      )
      .not("cancelada_em", "is", null)
      .gte("cancelada_em", ini)
      .lte("cancelada_em", fim)
      .order("cancelada_em", { ascending: false });
    if (error) setErr(error.message);
    setEstornos((data ?? []) as Estorno[]);
    setLoadingEstornos(false);
  }

  useEffect(() => {
    load();
    loadEstornos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate]);

  // Comissão real do vendedor (fatia G4.6): lançamentos do próprio usuário
  // logado em comissao_lancamentos, agrupados por competência (RLS já
  // restringe a beneficiario_id = auth.uid()).
  useEffect(() => {
    (async () => {
      setLoadingLancs(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLancs([]);
        setLoadingLancs(false);
        return;
      }
      const { data } = await supabase
        .from("comissao_lancamentos")
        .select("id,competencia,tipo,valor,descricao,origem,criado_em")
        .eq("beneficiario_id", u.user.id)
        .order("competencia", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(1000);
      setLancs((data ?? []) as Lanc[]);
      setLoadingLancs(false);
    })();
  }, []);

  // Meta do mês corrente do próprio vendedor. Obs.: a policy de `metas` é
  // permissiva (select using(true)); o recorte por ref_id=uid é aplicado aqui
  // no client — buscamos apenas a meta do próprio usuário.
  useEffect(() => {
    (async () => {
      setLoadingMeta(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setMeta(null);
        setLoadingMeta(false);
        return;
      }
      const now = new Date();
      const { data } = await supabase
        .from("metas")
        .select("ano,mes,meta_vendas,meta_faturamento")
        .eq("escopo", "usuario")
        .eq("ref_id", u.user.id)
        .eq("ano", now.getFullYear())
        .eq("mes", now.getMonth() + 1)
        .maybeSingle();
      setMeta((data as Meta) ?? null);
      setLoadingMeta(false);
    })();
  }, []);

  const porCompetencia = useMemo(() => {
    const map = new Map<string, { creditos: number; debitos: number }>();
    for (const l of lancs) {
      const k = l.competencia || "—";
      const cur = map.get(k) || { creditos: 0, debitos: 0 };
      if (l.tipo === "credito") cur.creditos += Number(l.valor);
      else cur.debitos += Number(l.valor);
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([competencia, v]) => ({
        competencia,
        creditos: v.creditos,
        debitos: v.debitos,
        saldo: v.creditos - v.debitos,
      }))
      .sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  }, [lancs]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.premio ?? r.valor ?? 0), 0),
    [rows],
  );

  // Lançamentos de comissão DENTRO do período selecionado (por criado_em) —
  // os KPIs de comissão/estorno/líquido têm que bater com o mesmo recorte das
  // vendas/estornos, senão "Líquido a receber" enganaria sobre o período.
  // (A seção "comissão por competência" abaixo continua histórica, de propósito.)
  const lancsPeriodo = useMemo(
    () =>
      lancs.filter((l) => {
        const d = l.criado_em?.slice(0, 10);
        return !!d && d >= de && d <= ate;
      }),
    [lancs, de, ate],
  );

  const kpis = useMemo(() => {
    const qtd = rows.length;
    const valor = total;
    const creditos = lancsPeriodo
      .filter((l) => l.tipo === "credito")
      .reduce((s, l) => s + Number(l.valor), 0);
    const debitos = lancsPeriodo
      .filter((l) => l.tipo === "debito")
      .reduce((s, l) => s + Number(l.valor), 0);
    const liquido = creditos - debitos;
    return { qtd, valor, creditos, debitos, liquido };
  }, [rows, lancsPeriodo, total]);

  const metaPct = useMemo(() => {
    if (!meta) return null;
    if (meta.meta_faturamento > 0) {
      return Math.min((kpis.valor / meta.meta_faturamento) * 100, 100);
    }
    if (meta.meta_vendas > 0) {
      return Math.min((kpis.qtd / meta.meta_vendas) * 100, 100);
    }
    return null;
  }, [meta, kpis]);

  return (
    <AppShell title="Extrato de vendas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Extrato de vendas</h1>
          <div className="sub">
            Propostas efetivamente transmitidas à seguradora · período{" "}
            {new Date(de + "T00:00:00").toLocaleDateString("pt-BR")} a{" "}
            {new Date(ate + "T00:00:00").toLocaleDateString("pt-BR")}
          </div>
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

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 18 }}
      >
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-check-circle" />
            </svg>
          </div>
          <div className="lbl">QTD DE VENDAS</div>
          <div className="val">{kpis.qtd}</div>
          <div className="meta">no período selecionado</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-tag" />
            </svg>
          </div>
          <div className="lbl">R$ VENDIDO</div>
          <div className="val" style={{ fontSize: 22 }}>
            {fmtBRL(kpis.valor)}
          </div>
          <div className="meta">
            ticket médio {kpis.qtd > 0 ? fmtBRL(kpis.valor / kpis.qtd) : fmtBRL(0)}
          </div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-dollar" />
            </svg>
          </div>
          <div className="lbl">COMISSÃO BRUTA</div>
          <div className="val" style={{ fontSize: 22 }}>
            {fmtBRL(kpis.creditos)}
          </div>
          <div className="meta">créditos lançados pela Matriz</div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="18" height="18">
              <use href="#i-refresh" />
            </svg>
          </div>
          <div className="lbl">ESTORNOS</div>
          <div className="val" style={{ fontSize: 22, color: "var(--alert)" }}>
            -{fmtBRL(kpis.debitos)}
          </div>
          <div className="meta">{estornos.length} apólices canceladas no período</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap" style={{ background: "rgba(46,139,87,.16)" }}>
            <svg width="18" height="18">
              <use href="#i-check" />
            </svg>
          </div>
          <div className="lbl">LÍQUIDO A RECEBER</div>
          <div className="val" style={{ fontSize: 22, color: "var(--ok)" }}>
            {fmtBRL(kpis.liquido)}
          </div>
          <div className="meta">comissão − estornos</div>
        </div>
        {loadingMeta ? (
          <div className="kpi">
            <div className="ic-wrap">
              <svg width="18" height="18">
                <use href="#i-target" />
              </svg>
            </div>
            <div className="lbl">META DO MÊS</div>
            <div className="muted small">Carregando…</div>
          </div>
        ) : meta && metaPct !== null ? (
          <div className="kpi">
            <div className="ic-wrap">
              <svg width="18" height="18">
                <use href="#i-target" />
              </svg>
            </div>
            <div className="lbl">META DO MÊS</div>
            <div className="val">{Math.round(metaPct)}%</div>
            <div className="bar">
              <div className="fill" style={{ width: `${metaPct}%` }} />
            </div>
            <div className="meta">
              {meta.meta_faturamento > 0
                ? `${fmtBRL(kpis.valor)} de ${fmtBRL(meta.meta_faturamento)}`
                : `${kpis.qtd} de ${meta.meta_vendas} vendas`}
            </div>
          </div>
        ) : (
          <div className="kpi">
            <div className="ic-wrap">
              <svg width="18" height="18">
                <use href="#i-target" />
              </svg>
            </div>
            <div className="lbl">META DO MÊS</div>
            <div className="muted small">Sem meta definida para este mês</div>
          </div>
        )}
      </div>

      {loading && <div className="muted">Carregando…</div>}

      {!loading && rows.length === 0 && (
        <div className="card">
          <div
            className="card-b"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
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

      <div className="card" style={{ marginTop: 18, borderLeft: "4px solid var(--alert)" }}>
        <div className="card-h">
          <h3 style={{ color: "var(--alert)" }}>
            <svg width="16" height="16">
              <use href="#i-refresh" />
            </svg>{" "}
            Estornos do período
          </h3>
          <span className="sub">cancelamentos que reduzem a comissão líquida</span>
        </div>
        <div className="card-b">
          {loadingEstornos && <div className="muted">Carregando…</div>}
          {!loadingEstornos && estornos.length === 0 && (
            <div className="muted">Nenhum estorno registrado no período.</div>
          )}
          {!loadingEstornos && estornos.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table-pipe mtable" style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th>Apólice</th>
                    <th>Seguradora</th>
                    <th>Motivo</th>
                    <th style={{ textAlign: "right" }}>Prêmio</th>
                    <th style={{ textAlign: "right" }}>Comissão revertida</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {estornos.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.apolice_numero || e.numero || "—"}</strong>
                      </td>
                      <td>{e.seguradora || "—"}</td>
                      <td>
                        <span className="chip chip-alert">
                          {e.cancelamento_motivo || "Cancelamento"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {fmtBRL(Number(e.premio ?? e.valor ?? 0))}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong style={{ color: "var(--alert)" }}>
                          − {fmtBRL(Number(e.comissao_valor ?? 0))}
                        </strong>
                      </td>
                      <td>
                        <small className="muted">{fmtDate(e.cancelada_em)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-dollar" />
            </svg>{" "}
            Minha comissão por competência
          </h3>
        </div>
        <div className="card-b">
          {loadingLancs && <div className="muted">Carregando…</div>}
          {!loadingLancs && porCompetencia.length === 0 && (
            <div className="muted">
              Nenhum lançamento de comissão ainda — aparece aqui após o fechamento da competência
              pela Matriz.
            </div>
          )}
          {!loadingLancs && porCompetencia.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table-pipe mtable" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th style={{ textAlign: "right" }}>Créditos</th>
                    <th style={{ textAlign: "right" }}>Débitos</th>
                    <th style={{ textAlign: "right" }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {porCompetencia.map((c) => (
                    <tr key={c.competencia}>
                      <td>
                        <strong>{c.competencia}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>{fmtBRL(c.creditos)}</td>
                      <td style={{ textAlign: "right" }}>{fmtBRL(c.debitos)}</td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{fmtBRL(c.saldo)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* TODO Q3: campanha ativa / próximos pagamentos dependem de fonte de dados não disponível */}
    </AppShell>
  );
}
