import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { printHtml } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/operacao/supervisao")({
  head: () => ({ meta: [{ title: "Supervisão · CoteCerto" }] }),
  component: Page,
});

type Lead = {
  id: string;
  status_pipeline: string;
  responsavel_id: string | null;
  empresa_id: string | null;
  criado_em: string;
};
type Cot = { id: string; lead_id: string | null; responsavel_id: string | null; criado_em: string };
type Prop = { id: string; oportunidade_id: string | null; status: string; criado_em: string };
type Evt = { lead_id: string; tipo: string; criado_em: string };
type Prof = { id: string; nome: string | null; empresa_id: string | null };
type Emp = { id: string; nome: string | null };

const STAGES = [
  "Recebido → Distribuído",
  "Distribuído → 1º contato",
  "1º contato → Qualificado",
  "Qualificado → Cotado",
  "Cotado → Proposta",
  "Proposta → Fechado",
  "Fechado → Emitido",
];

function monthRange(offset = 0) {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const fim = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
  return {
    ini: ini.toISOString(),
    fim: fim.toISOString(),
    label: ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

function fmtDuracao(ms: number | null) {
  if (ms == null || !isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 6) / 10;
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const rh = Math.round(h - d * 24);
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

function Page() {
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cots, setCots] = useState<Cot[]>([]);
  const [props, setProps] = useState<Prop[]>([]);
  const [evts, setEvts] = useState<Evt[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);

  const range = useMemo(() => monthRange(offset), [offset]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [le, co, pr, ev, pf, em] = await Promise.all([
          supabase
            .from("leads")
            .select("id,status_pipeline,responsavel_id,empresa_id,criado_em")
            .gte("criado_em", range.ini)
            .lt("criado_em", range.fim),
          supabase
            .from("cotacoes")
            .select("id,lead_id,responsavel_id,criado_em")
            .gte("criado_em", range.ini)
            .lt("criado_em", range.fim),
          supabase
            .from("propostas")
            .select("id,oportunidade_id,status,criado_em")
            .gte("criado_em", range.ini)
            .lt("criado_em", range.fim),
          supabase
            .from("lead_eventos")
            .select("lead_id,tipo,criado_em")
            .gte("criado_em", range.ini)
            .lt("criado_em", range.fim),
          supabase.from("profiles").select("id,nome,empresa_id"),
          supabase.from("empresas").select("id,nome"),
        ]);
        if (le.error) throw le.error;
        if (co.error) throw co.error;
        if (pr.error) throw pr.error;
        if (ev.error) throw ev.error;
        if (pf.error) throw pf.error;
        if (em.error) throw em.error;
        setLeads((le.data ?? []) as Lead[]);
        setCots((co.data ?? []) as Cot[]);
        setProps((pr.data ?? []) as Prop[]);
        setEvts((ev.data ?? []) as Evt[]);
        setProfs((pf.data ?? []) as Prof[]);
        setEmps((em.data ?? []) as Emp[]);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [range.ini, range.fim]);

  const empMap = useMemo(() => new Map(emps.map((e) => [e.id, e.nome ?? ""])), [emps]);

  // ---------- Caça-gargalos ----------
  const funil = useMemo(() => {
    const has = (s: string, set: string[]) => set.includes(s);
    const adv = {
      distribuido: ["contato", "qualificando", "cotacao", "proposta", "negociacao", "ganho"],
      contato: ["contato", "qualificando", "cotacao", "proposta", "negociacao", "ganho"],
      qualificado: ["qualificando", "cotacao", "proposta", "negociacao", "ganho"],
      cotado: ["cotacao", "proposta", "negociacao", "ganho"],
      proposta: ["proposta", "negociacao", "ganho"],
      fechado: ["ganho"],
    };
    const recebido = leads.length;
    const distribuido = leads.filter((l) => l.empresa_id || l.responsavel_id).length;
    const contato = leads.filter((l) => has(l.status_pipeline, adv.contato)).length;
    const qualif = leads.filter((l) => has(l.status_pipeline, adv.qualificado)).length;
    const cotado = leads.filter((l) => has(l.status_pipeline, adv.cotado)).length;
    const proposta = leads.filter((l) => has(l.status_pipeline, adv.proposta)).length;
    const fechado = leads.filter((l) => has(l.status_pipeline, adv.fechado)).length;
    const emitido = props.filter((p) =>
      ["emitida", "aceita", "transmitida"].includes((p.status ?? "").toLowerCase()),
    ).length;

    // tempo médio entre eventos por lead
    const byLead = new Map<string, Evt[]>();
    for (const e of evts) {
      const arr = byLead.get(e.lead_id) ?? [];
      arr.push(e);
      byLead.set(e.lead_id, arr);
    }
    function avgDelta(fromTipo: string[] | null, toTipo: string[]) {
      const deltas: number[] = [];
      for (const l of leads) {
        const arr = (byLead.get(l.id) ?? [])
          .slice()
          .sort((a, b) => a.criado_em.localeCompare(b.criado_em));
        const from = fromTipo ? arr.find((e) => fromTipo.includes(e.tipo))?.criado_em : l.criado_em;
        const to = arr.find((e) => toTipo.includes(e.tipo))?.criado_em;
        if (from && to) {
          const d = new Date(to).getTime() - new Date(from).getTime();
          if (d > 0) deltas.push(d);
        }
      }
      return deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
    }

    const t1 = avgDelta(null, ["distribuido"]);
    const t2 = avgDelta(["distribuido"], ["contato", "qualificando", "cotando", "cotacao"]);
    const t3 = avgDelta(["contato"], ["qualificando", "qualificado", "cotacao", "cotando"]);
    const t4 = avgDelta(["qualificando", "qualificado"], ["cotacao", "cotando", "calculada"]);
    const t5 = avgDelta(["cotacao", "cotando", "calculada"], ["proposta", "proposta_enviada"]);
    const t6 = avgDelta(["proposta", "proposta_enviada", "em_negociacao", "negociacao"], ["ganho"]);
    const t7 = null;

    const rows = [
      { etapa: STAGES[0], num: distribuido, den: recebido, tempo: t1, alvo: 5 * 60_000 },
      { etapa: STAGES[1], num: contato, den: distribuido, tempo: t2, alvo: 3 * 60_000 },
      { etapa: STAGES[2], num: qualif, den: contato, tempo: t3, alvo: 60 * 60_000 },
      { etapa: STAGES[3], num: cotado, den: qualif, tempo: t4, alvo: 4 * 60 * 60_000 },
      { etapa: STAGES[4], num: proposta, den: cotado, tempo: t5, alvo: 24 * 60 * 60_000 },
      { etapa: STAGES[5], num: fechado, den: proposta, tempo: t6, alvo: 48 * 60 * 60_000 },
      { etapa: STAGES[6], num: emitido, den: fechado, tempo: t7, alvo: 24 * 60 * 60_000 },
    ].map((r) => {
      const pct = r.den > 0 ? Math.round((r.num / r.den) * 100) : 0;
      const over = r.tempo != null && r.tempo > r.alvo;
      return { ...r, pct, over };
    });
    let worstIdx = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].den > 0 && (rows[i].pct < rows[worstIdx].pct || rows[worstIdx].den === 0))
        worstIdx = i;
    }
    return { rows, worstIdx };
  }, [leads, props, evts]);

  // ---------- Comparativo de vendedores ----------
  const comp = useMemo(() => {
    const byVend = new Map<string, { leads: Lead[]; cots: Cot[] }>();
    for (const l of leads) {
      if (!l.responsavel_id) continue;
      const e = byVend.get(l.responsavel_id) ?? { leads: [], cots: [] };
      e.leads.push(l);
      byVend.set(l.responsavel_id, e);
    }
    for (const c of cots) {
      if (!c.responsavel_id) continue;
      const e = byVend.get(c.responsavel_id) ?? { leads: [], cots: [] };
      e.cots.push(c);
      byVend.set(c.responsavel_id, e);
    }
    const evtByLead = new Map<string, Evt[]>();
    for (const e of evts) {
      const arr = evtByLead.get(e.lead_id) ?? [];
      arr.push(e);
      evtByLead.set(e.lead_id, arr);
    }
    const rows = Array.from(byVend.entries()).map(([uid, e]) => {
      const prof = profs.find((p) => p.id === uid);
      const nome = prof?.nome ?? uid.slice(0, 6);
      const unidade = prof?.empresa_id ? (empMap.get(prof.empresa_id) ?? "") : "";
      const volume = e.leads.length;
      const ganhos = e.leads.filter((l) => l.status_pipeline === "ganho").length;
      const propostas = e.leads.filter((l) =>
        ["proposta", "negociacao", "ganho"].includes(l.status_pipeline),
      ).length;
      const cotacoes = e.cots.length;
      const contatos = e.leads.filter((l) =>
        ["contato", "qualificando", "cotacao", "proposta", "negociacao", "ganho"].includes(
          l.status_pipeline,
        ),
      ).length;
      // tempo médio 1º contato (lead.criado_em -> evento contato/qualificando)
      const tempos: number[] = [];
      for (const l of e.leads) {
        const arr = (evtByLead.get(l.id) ?? [])
          .slice()
          .sort((a, b) => a.criado_em.localeCompare(b.criado_em));
        const ev = arr.find((x) => ["contato", "qualificando", "cotacao"].includes(x.tipo));
        if (ev) {
          const d = new Date(ev.criado_em).getTime() - new Date(l.criado_em).getTime();
          if (d > 0) tempos.push(d);
        }
      }
      const tempoContato = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;
      const conv = volume > 0 ? Math.round((ganhos / volume) * 100) : 0;
      return {
        uid,
        nome,
        unidade,
        volume,
        contatos,
        cotacoes,
        propostas,
        ganhos,
        conv,
        tempoContato,
      };
    });
    rows.sort((a, b) => b.volume - a.volume);
    return rows.slice(0, 5);
  }, [leads, cots, evts, profs, empMap]);

  function bestWorstClass(values: number[], v: number, higherBetter = true) {
    if (values.length === 0) return "";
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max === min) return "";
    const best = higherBetter ? max : min;
    const worst = higherBetter ? min : max;
    if (v === best) return "best";
    if (v === worst) return "weak";
    return "";
  }

  const kpiVolume = comp.map((c) => c.volume);
  const kpiContato = comp.map((c) => c.tempoContato ?? Infinity);
  const kpiContatos = comp.map((c) => c.contatos);
  const kpiCot = comp.map((c) => c.cotacoes);
  const kpiProp = comp.map((c) => c.propostas);
  const kpiGanhos = comp.map((c) => c.ganhos);
  const kpiConv = comp.map((c) => c.conv);

  function exportar() {
    const tFunil = `<table><thead><tr><th>Etapa</th><th class="num">Conversão</th><th class="num">Tempo médio</th></tr></thead><tbody>${funil.rows
      .map(
        (r) =>
          `<tr><td>${r.etapa}</td><td class="num">${r.pct}%</td><td class="num">${fmtDuracao(r.tempo)}</td></tr>`,
      )
      .join("")}</tbody></table>`;
    const tComp = `<table><thead><tr><th>Vendedor</th><th>Unidade</th><th class="num">Volume</th><th class="num">Cotações</th><th class="num">Propostas</th><th class="num">Apólices</th><th class="num">Conversão</th></tr></thead><tbody>${
      comp
        .map(
          (c) =>
            `<tr><td>${c.nome}</td><td>${c.unidade || "—"}</td><td class="num">${c.volume}</td><td class="num">${c.cotacoes}</td><td class="num">${c.propostas}</td><td class="num">${c.ganhos}</td><td class="num">${c.conv}%</td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="7" style="text-align:center;color:#94a3b8">Sem vendedores com atividade no período</td></tr>`
    }</tbody></table>`;
    const body = `
      <h1>Supervisão</h1>
      <div class="sub">Período: <b>${range.label}</b></div>
      <h2>Caça-gargalos — jornada do lead</h2>
      ${tFunil}
      <h2>Comparativo de vendedores</h2>
      ${tComp}
    `;
    printHtml(`Supervisão · ${range.label}`, body);
  }

  return (
    <AppShell title="Supervisão">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Supervisão</h1>
          <div className="sub">
            Onde a operação perde tempo e leads — e como está cada vendedor, para agir rápido
          </div>
        </div>
        <div className="tools">
          <select
            className="select-mini"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
          >
            <option value={0}>Mês atual</option>
            <option value={1}>Mês passado</option>
            <option value={2}>Mês retrasado</option>
          </select>
          <button className="btn btn-ghost" onClick={exportar}>
            <svg width="14" height="14">
              <use href="#i-download"></use>
            </svg>{" "}
            Exportar
          </button>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-gauge"></use>
            </svg>{" "}
            Caça-gargalos — jornada do lead
          </h3>
          {funil.rows[funil.worstIdx] && (
            <span className="chip chip-alert">
              Maior gargalo: {funil.rows[funil.worstIdx].etapa}
            </span>
          )}
        </div>
        <div className="card-b">
          <p className="small muted" style={{ marginTop: 0 }}>
            Cada barra é a <strong>conversão</strong> da etapa; à direita, o{" "}
            <strong>tempo médio</strong> gasto nela.
          </p>
          {funil.rows.map((r, i) => (
            <div key={r.etapa} className={`gargalo-row${i === funil.worstIdx ? " worst" : ""}`}>
              <div className="gr-etapa">{r.etapa}</div>
              <div className="gr-track">
                <div
                  className="gr-fill"
                  style={{
                    width: `${Math.max(14, r.pct)}%`,
                    background:
                      r.pct < 50 ? "var(--alert)" : r.pct < 70 ? "var(--yellow)" : "var(--ok)",
                  }}
                >
                  {r.pct}%
                </div>
              </div>
              <div className={`gr-tempo${r.over ? " over" : ""}`}>
                {fmtDuracao(r.tempo)}
                {r.over ? " ⚠" : ""}
              </div>
            </div>
          ))}
          {funil.rows[funil.worstIdx] && funil.rows[funil.worstIdx].den > 0 && (
            <div className="coach-tip">
              <svg width="13" height="13">
                <use href="#i-spark"></use>
              </svg>{" "}
              <strong>
                Maior perda: {funil.rows[funil.worstIdx].etapa} ({funil.rows[funil.worstIdx].pct}
                %).
              </strong>{" "}
              É aqui que o time mais deixa venda na mesa — priorize a ação.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-users"></use>
            </svg>{" "}
            Comparativo de vendedores
          </h3>
          <span className="small muted">top 5 por volume · vermelho = ponto fraco</span>
        </div>
        <div className="card-b" style={{ overflowX: "auto" }}>
          {comp.length === 0 ? (
            <div className="muted" style={{ padding: 24, textAlign: "center" }}>
              Sem vendedores com atividade no período.
            </div>
          ) : (
            <>
              <table className="cmp-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>KPI por vendedor</th>
                    {comp.map((c) => (
                      <th key={c.uid}>
                        {c.nome}
                        <br />
                        <span style={{ fontWeight: 400, opacity: 0.8, fontSize: 11 }}>
                          {c.unidade || "—"}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row
                    label="Volume de leads"
                    values={comp.map((c) => c.volume)}
                    render={(v) => v}
                    cls={(v) => bestWorstClass(kpiVolume, v, true)}
                  />
                  <Row
                    label="Tempo 1º contato"
                    values={comp.map((c) => c.tempoContato)}
                    render={(v) => fmtDuracao(v)}
                    cls={(v) => bestWorstClass(kpiContato as number[], v ?? Infinity, false)}
                  />
                  <Row
                    label="Contatos efetivos"
                    values={comp.map((c) => c.contatos)}
                    render={(v) => v}
                    cls={(v) => bestWorstClass(kpiContatos, v, true)}
                  />
                  <Row
                    label="Cotações enviadas"
                    values={comp.map((c) => c.cotacoes)}
                    render={(v) => v}
                    cls={(v) => bestWorstClass(kpiCot, v, true)}
                  />
                  <Row
                    label="Propostas"
                    values={comp.map((c) => c.propostas)}
                    render={(v) => v}
                    cls={(v) => bestWorstClass(kpiProp, v, true)}
                  />
                  <Row
                    label="Apólices emitidas"
                    values={comp.map((c) => c.ganhos)}
                    render={(v) => v}
                    cls={(v) => bestWorstClass(kpiGanhos, v, true)}
                  />
                  <Row
                    label="Taxa de conversão"
                    values={comp.map((c) => c.conv)}
                    render={(v) => `${v}%`}
                    cls={(v) => bestWorstClass(kpiConv, v, true)}
                    highlight
                  />
                </tbody>
              </table>
              <p className="small muted" style={{ margin: "12px 0 0" }}>
                Cada linha destaca o <strong style={{ color: "var(--alert)" }}>mais fraco</strong> e
                o <strong style={{ color: "var(--ok)" }}>melhor</strong> do grupo.
              </p>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Row<T>({
  label,
  values,
  render,
  cls,
  highlight,
}: {
  label: string;
  values: T[];
  render: (v: T) => ReactNode;
  cls: (v: T) => string;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "conv-row" : undefined}>
      <th>{label}</th>
      {values.map((v, i) => (
        <td key={i} className={cls(v)}>
          {render(v)}
        </td>
      ))}
    </tr>
  );
}
