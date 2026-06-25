import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/comando/visao-geral")({
  head: () => ({ meta: [{ title: "Visão geral · CoteCerto" }] }),
  component: Page,
});

const SLA_SECONDS = 180;
const BRL = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtDur = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
};
const monthLabel = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

type Lead = {
  id: string; status_pipeline: string; empresa_id: string | null; responsavel_id: string | null;
  criado_em: string; distribuido_em: string | null; ultimo_atendimento_em: string | null;
  bloqueado: boolean | null; arquivado: boolean | null; valor: number | null;
};
type Empresa = { id: string; nome: string; tipo: string; parent_id: string | null };
type Profile = { id: string; nome: string; empresa_id: string | null };
type Proposta = { id: string; status: string; valor: number | null; responsavel_id: string | null; criado_em: string; atualizado_em: string | null };

function Page() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [matrizId, setMatrizId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const since = new Date(); since.setMonth(since.getMonth() - 11); since.setDate(1); since.setHours(0,0,0,0);
    const { data: u } = await supabase.auth.getUser();
    let mId: string | null = null;
    if (u.user) {
      const { data: me } = await supabase.from("profiles").select("empresa_id").eq("id", u.user.id).maybeSingle();
      mId = (me?.empresa_id as string) ?? null;
      setMatrizId(mId);
    }
    const [l, e, pr, pp] = await Promise.all([
      supabase.from("leads").select("id,status_pipeline,empresa_id,responsavel_id,criado_em,distribuido_em,ultimo_atendimento_em,bloqueado,arquivado,valor").gte("criado_em", since.toISOString()).limit(5000),
      supabase.from("empresas").select("id,nome,tipo,parent_id").limit(500),
      supabase.from("profiles").select("id,nome,empresa_id").limit(2000),
      supabase.from("propostas").select("id,status,valor,responsavel_id,criado_em,atualizado_em").gte("criado_em", since.toISOString()).limit(5000),
    ]);
    if (l.error) setErr(l.error.message);
    setLeads((l.data ?? []) as Lead[]);
    setEmpresas((e.data ?? []) as Empresa[]);
    setProfiles((pr.data ?? []) as Profile[]);
    setPropostas((pp.data ?? []) as Proposta[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Franquias = todas as empresas exceto a matriz do usuário logado
  const franquias = useMemo(
    () => empresas.filter((x) => x.id !== matrizId),
    [empresas, matrizId]
  );
  // Vendedores = profiles vinculados a uma franquia (não à matriz) e diferentes do usuário logado matriz
  const vendedores = useMemo(
    () => profiles.filter((x) => x.empresa_id && x.empresa_id !== matrizId),
    [profiles, matrizId]
  );


  // Janela do mês atual
  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; }, []);
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const leadsMes = useMemo(() => leads.filter((x) => new Date(x.criado_em) >= monthStart && !x.arquivado), [leads, monthStart]);
  const leadsHoje = useMemo(() => leads.filter((x) => new Date(x.criado_em) >= todayStart && !x.arquivado), [leads, todayStart]);

  const propostasMes = useMemo(() => propostas.filter((x) => new Date(x.criado_em) >= monthStart), [propostas, monthStart]);
  const emitidasMes = propostasMes.filter((x) => x.status === "gerada" || x.status === "transmitida");
  const pagasMes = propostasMes.filter((x) => x.status === "transmitida");
  const naoPagasMes = emitidasMes.length - pagasMes.length;
  const comissaoMes = pagasMes.reduce((a, x) => a + Number(x.valor || 0), 0);

  // Speed-to-lead
  const pendentes = useMemo(() => leadsMes.filter((l) => !l.distribuido_em && !l.responsavel_id && !l.empresa_id && l.status_pipeline === "novo"), [leadsMes]);
  const distribuidos = useMemo(() => leadsMes.filter((l) => l.distribuido_em), [leadsMes]);
  const oldestSec = pendentes.reduce((a, l) => Math.max(a, Math.floor((now - new Date(l.criado_em).getTime()) / 1000)), 0);
  const avgDistSec = distribuidos.length
    ? Math.round(distribuidos.reduce((a, l) => a + Math.max(0, (new Date(l.distribuido_em!).getTime() - new Date(l.criado_em).getTime()) / 1000), 0) / distribuidos.length)
    : 0;
  const sub3min = distribuidos.length
    ? Math.round((distribuidos.filter((l) => (new Date(l.distribuido_em!).getTime() - new Date(l.criado_em).getTime()) / 1000 <= SLA_SECONDS).length / distribuidos.length) * 100)
    : 0;
  const atendidos = leadsMes.filter((l) => l.ultimo_atendimento_em);
  const avg1Contato = atendidos.length
    ? Math.round(atendidos.reduce((a, l) => a + Math.max(0, (new Date(l.ultimo_atendimento_em!).getTime() - new Date(l.criado_em).getTime()) / 1000), 0) / atendidos.length)
    : 0;

  const semAtendimento = leadsMes.filter((l) => !l.ultimo_atendimento_em && l.status_pipeline === "novo" && !l.bloqueado);
  const slaEstourado = pendentes.filter((l) => (now - new Date(l.criado_em).getTime()) / 1000 > SLA_SECONDS);
  const fechadosHoje = leadsHoje.filter((l) => l.status_pipeline === "ganho");
  const emTransmissao = propostas.filter((x) => x.status === "gerada");
  const pendTransmHoje = propostas.filter((x) => x.status === "gerada" && new Date(x.atualizado_em || x.criado_em) >= todayStart);

  const recebidosMes = leadsMes.length;
  const distribuidosMes = distribuidos.length;
  const convMes = recebidosMes ? Math.round((emitidasMes.length / recebidosMes) * 100) : 0;

  // Evolução mensal (últimos 6 meses)
  const evol = useMemo(() => {
    const out: { label: string; emitidas: number; pagas: number }[] = [];
    const base = new Date(); base.setDate(1); base.setHours(0,0,0,0);
    for (let i = 5; i >= 0; i--) {
      const start = new Date(base); start.setMonth(base.getMonth() - i);
      const end = new Date(start); end.setMonth(start.getMonth() + 1);
      const ps = propostas.filter((x) => { const d = new Date(x.criado_em); return d >= start && d < end; });
      out.push({
        label: start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").replace(/^\w/, (c) => c.toUpperCase()),
        emitidas: ps.filter((x) => x.status === "gerada" || x.status === "transmitida").length,
        pagas: ps.filter((x) => x.status === "transmitida").length,
      });
    }
    return out;
  }, [propostas]);
  const maxEvol = Math.max(10, ...evol.flatMap((m) => [m.emitidas, m.pagas]));

  // Rankings
  const rankFranq = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; vendas: number; conv: number; leads: number }>();
    for (const f of franquias) map.set(f.id, { id: f.id, nome: f.nome, vendas: 0, conv: 0, leads: 0 });
    for (const l of leadsMes) {
      if (!l.empresa_id) continue;
      const r = map.get(l.empresa_id); if (!r) continue;
      r.leads += 1;
      if (l.status_pipeline === "ganho") r.vendas += 1;
    }
    for (const r of map.values()) r.conv = r.leads ? Math.round((r.vendas / r.leads) * 100) : 0;
    return Array.from(map.values()).sort((a, b) => b.vendas - a.vendas);
  }, [franquias, leadsMes]);

  const rankVend = useMemo(() => {
    const fmap = new Map(franquias.map((f) => [f.id, f.nome]));
    const map = new Map<string, { id: string; nome: string; franq: string; vendas: number; conv: number; leads: number }>();
    for (const p of vendedores) map.set(p.id, { id: p.id, nome: p.nome || "—", franq: fmap.get(p.empresa_id || "") || "—", vendas: 0, conv: 0, leads: 0 });
    for (const l of leadsMes) {
      if (!l.responsavel_id) continue;
      const r = map.get(l.responsavel_id); if (!r) continue;
      r.leads += 1;
      if (l.status_pipeline === "ganho") r.vendas += 1;
    }
    for (const r of map.values()) r.conv = r.leads ? Math.round((r.vendas / r.leads) * 100) : 0;
    return Array.from(map.values()).filter((r) => r.leads > 0 || r.vendas > 0).sort((a, b) => b.vendas - a.vendas).slice(0, 8);
  }, [vendedores, franquias, leadsMes]);

  const alertasCount = (pendTransmHoje.length > 0 ? 1 : 0) + (semAtendimento.length > 0 ? 1 : 0) + (slaEstourado.length > 0 ? 1 : 0) + (naoPagasMes > 0 ? 1 : 0);

  return (
    <AppShell title="Visão geral">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Operação CoteCerto</h1>
          <div className="sub">
            {monthLabel(new Date())} · <strong>{franquias.length} franquias</strong> · <strong>{vendedores.length} vendedores</strong> ativos · dados de {new Date().toLocaleDateString("pt-BR", { month: "long", year: "2-digit" })}
          </div>
        </div>
        <div className="tools">
          <button className="btn btn-slate" onClick={() => navigate({ to: "/comando/leads" })}>
            <svg width="14" height="14"><use href="#i-layers"></use></svg> Central de Leads
          </button>
        </div>
      </div>

      {err && <div className="audit-note" style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 12 }}>{err}</div>}
      {loading && <div className="muted small" style={{ marginBottom: 12 }}>Carregando…</div>}

      <div className="card card-yellow" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3><svg width="16" height="16"><use href="#i-target"></use></svg> Resumo do dia — meta diária da Matriz</h3><span className="small muted">atualizado agora</span></div>
        <div className="card-b" style={{ paddingTop: 14 }}>
          <div className="summary-chips" style={{ marginBottom: 0 }}>
            <div className="sum-chip" style={{ cursor: "pointer" }}><span className="sc-val">{emTransmissao.length}</span><span className="sc-lbl">Em transmissão</span></div>
            <div className="sum-chip alert" style={{ cursor: "pointer" }}><span className="sc-val">{pendTransmHoje.length}</span><span className="sc-lbl">Com pendência hoje</span></div>
            <div className="sum-chip alert" style={{ cursor: "pointer" }} onClick={() => navigate({ to: "/comando/leads" })}><span className="sc-val">{semAtendimento.length}</span><span className="sc-lbl">Leads sem atendimento</span></div>
            <div className="sum-chip" style={{ cursor: "pointer" }} onClick={() => navigate({ to: "/comando/leads" })}><span className="sc-val">{slaEstourado.length}</span><span className="sc-lbl">SLA estourado</span></div>
            <div className="sum-chip info"><span className="sc-val">{fechadosHoje.length}</span><span className="sc-lbl">Fechados hoje</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h"><h3><svg width="16" height="16"><use href="#i-gauge"></use></svg> Speed-to-lead — velocidade de resposta</h3><button className="btn-link btn-sm" onClick={() => navigate({ to: "/comando/leads" })}>Abrir Central de Leads</button></div>
        <div className="card-b" style={{ paddingTop: 14 }}>
          <div className="summary-chips" style={{ marginBottom: 0 }}>
            <div className="sum-chip alert" style={{ cursor: "pointer" }} onClick={() => navigate({ to: "/comando/leads" })}><span className="sc-val">{fmtDur(oldestSec)}</span><span className="sc-lbl">Mais antigo sem distribuir</span></div>
            <div className="sum-chip"><span className="sc-val">{fmtDur(avgDistSec)}</span><span className="sc-lbl">Tempo médio até distribuir</span></div>
            <div className={`sum-chip ${sub3min >= 70 ? "ok" : "alert"}`}><span className="sc-val">{sub3min}%</span><span className="sc-lbl">Distribuídos em &lt; 3 min</span></div>
            <div className="sum-chip"><span className="sc-val">{fmtDur(avg1Contato)}</span><span className="sc-lbl">Tempo médio 1º contato</span></div>
          </div>
          <p className="small muted" style={{ margin: "12px 0 0" }}>Lead de campanha é onde está o maior custo e a menor conversão. Quanto mais rápido distribuir e atender, mais barato e mais conversão. <strong>Meta: distribuir em até 3 min.</strong></p>
        </div>
      </div>

      <div className="mkpi-grid">
        <div className="kpi"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-layers"></use></svg></div><div className="lbl">LEADS RECEBIDOS</div><div className="val">{recebidosMes}</div><div className="meta">no mês corrente</div></div>
        <div className="kpi k-info"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-share"></use></svg></div><div className="lbl">LEADS DISTRIBUÍDOS</div><div className="val">{distribuidosMes}</div><div className="meta">{recebidosMes ? Math.round((distribuidosMes / recebidosMes) * 100) : 0}% da fila</div></div>
        <div className="kpi k-alert"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-alert-triangle"></use></svg></div><div className="lbl">SEM ATENDIMENTO</div><div className="val">{semAtendimento.length}</div><div className="meta">precisam de ação imediata</div></div>
        <div className="kpi"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-clock"></use></svg></div><div className="lbl">TEMPO MÉD. 1º CONTATO</div><div className="val">{(avg1Contato / 60).toFixed(1)} min</div><div className="meta">no mês</div></div>
        <div className="kpi"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-check-circle"></use></svg></div><div className="lbl">VENDAS EMITIDAS</div><div className="val">{emitidasMes.length}</div><div className="meta">propostas geradas + transmitidas</div></div>
        <div className="kpi k-ok"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-dollar"></use></svg></div><div className="lbl">VENDAS PAGAS</div><div className="val">{pagasMes.length}</div><div className="meta">{emitidasMes.length ? Math.round((pagasMes.length / emitidasMes.length) * 100) : 0}% das emitidas</div></div>
        <div className="kpi k-alert"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-tag"></use></svg></div><div className="lbl">VENDAS NÃO PAGAS</div><div className="val">{Math.max(0, naoPagasMes)}</div><div className="meta">aguardando baixa financeira</div></div>
        <div className="kpi"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-percent"></use></svg></div><div className="lbl">CONVERSÃO GERAL</div><div className="val">{convMes}%</div><div className="meta">emitidas / recebidos</div></div>
        <div className="kpi"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-dollar"></use></svg></div><div className="lbl">PRÊMIO PAGO</div><div className="val">{BRL(comissaoMes)}</div><div className="meta">somatório das transmitidas</div></div>
      </div>

      <div className="dash-grid">
        <div className="col">
          <div className="card chart-card">
            <div className="card-h">
              <h3><svg width="16" height="16"><use href="#i-trending-up"></use></svg> Evolução mensal</h3>
              <div className="mchart-legend"><span className="it"><span className="dot" style={{ background: "var(--slate)" }}></span>Emitidas</span><span className="it"><span className="dot" style={{ background: "var(--yellow)" }}></span>Pagas</span></div>
            </div>
            <div className="card-b">
              <svg viewBox="0 0 560 200" width="100%" height={200} preserveAspectRatio="xMidYMid meet">
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                  const y = 178 - p * 164;
                  return (
                    <g key={i}>
                      <line x1={30} y1={y} x2={560} y2={y} stroke="var(--border-soft)" strokeWidth={1} />
                      <text x={2} y={y + 3} fontSize={9} fill="var(--muted)">{Math.round(maxEvol * p)}</text>
                    </g>
                  );
                })}
                {evol.map((m, i) => {
                  const colW = (560 - 40) / evol.length;
                  const x0 = 40 + i * colW;
                  const he = (m.emitidas / maxEvol) * 164;
                  const hp = (m.pagas / maxEvol) * 164;
                  return (
                    <g key={i}>
                      <rect x={x0} y={178 - he} width={22} height={he} rx={4} fill="var(--slate)" />
                      <rect x={x0 + 24} y={178 - hp} width={22} height={hp} rx={4} fill="var(--yellow)" />
                      <text x={x0 + 23} y={196} textAnchor="middle" fontSize={11} fill="var(--muted)">{m.label}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="card card-yellow">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-bolt"></use></svg> Alertas críticos do dia</h3><span className="chip chip-alert">{alertasCount} pendência{alertasCount === 1 ? "" : "s"}</span></div>
            <div className="card-b"><div className="actions-list">
              {pendTransmHoje.length > 0 && (
                <div className="action-row">
                  <div className="ic-square alert"><svg width="18" height="18"><use href="#i-upload"></use></svg></div>
                  <div className="body"><h4>{pendTransmHoje.length} proposta(s) em transmissão hoje</h4><p>Seguradora aguardando — resolver antes da emissão</p></div>
                  <div className="meta">Resolver</div>
                </div>
              )}
              {semAtendimento.length > 0 && (
                <div className="action-row" onClick={() => navigate({ to: "/comando/leads" })} style={{ cursor: "pointer" }}>
                  <div className="ic-square alert"><svg width="18" height="18"><use href="#i-alert-triangle"></use></svg></div>
                  <div className="body"><h4>{semAtendimento.length} leads sem atendimento</h4><p>Aguardando distribuição ou 1º contato</p></div>
                  <div className="meta">Agir</div>
                </div>
              )}
              {slaEstourado.length > 0 && (
                <div className="action-row" onClick={() => navigate({ to: "/comando/leads" })} style={{ cursor: "pointer" }}>
                  <div className="ic-square alert"><svg width="18" height="18"><use href="#i-clock"></use></svg></div>
                  <div className="body"><h4>{slaEstourado.length} leads com SLA estourado</h4><p>Voltaram para a fila — redistribuir agora</p></div>
                  <div className="meta">Urgente</div>
                </div>
              )}
              {naoPagasMes > 0 && (
                <div className="action-row">
                  <div className="ic-square warn"><svg width="18" height="18"><use href="#i-dollar"></use></svg></div>
                  <div className="body"><h4>{naoPagasMes} vendas emitidas e não pagas</h4><p>Acompanhar baixa financeira no mês</p></div>
                  <div className="meta muted">Cobrar</div>
                </div>
              )}
              {alertasCount === 0 && (
                <div className="muted small" style={{ padding: 12 }}>Sem pendências críticas — bom trabalho. 🎉</div>
              )}
            </div></div>
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-award"></use></svg> Ranking de franquias</h3><button className="btn-link btn-sm" onClick={() => navigate({ to: "/operacao/franquias" })}>Ver todas</button></div>
            <div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {rankFranq.slice(0, 8).map((r, i) => (
                <div key={r.id} className="rank-row">
                  <div className={`rank-pos ${i === 0 ? "top" : ""}`}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rk-name">{r.nome}</div>
                    <div className="rk-sub">{r.leads} leads · conv. {r.conv}%</div>
                  </div>
                  <div className="rk-val">{r.vendas} <small>vendas</small></div>
                </div>
              ))}
              {rankFranq.length === 0 && <div className="muted small" style={{ padding: 12 }}>Sem franquias cadastradas.</div>}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-users"></use></svg> Ranking de vendedores</h3><button className="btn-link btn-sm" onClick={() => navigate({ to: "/operacao/vendedores" })}>Ver todos</button></div>
            <div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {rankVend.map((r, i) => (
                <div key={r.id} className="rank-row">
                  <div className={`rank-pos ${i === 0 ? "top" : ""}`}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rk-name">{r.nome}</div>
                    <div className="rk-sub">{r.franq} · conv. {r.conv}%</div>
                  </div>
                  <div className="rk-val">{r.vendas} <small>vendas</small></div>
                </div>
              ))}
              {rankVend.length === 0 && <div className="muted small" style={{ padding: 12 }}>Ainda não há atividade de vendedores no mês.</div>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
