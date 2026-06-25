import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início · CoteCerto" }] }),
  component: Page,
});

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function diasUteisRestantes(d = new Date()) {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  let count = 0;
  for (let day = d.getDate(); day <= last; day++) {
    const dia = new Date(d.getFullYear(), d.getMonth(), day).getDay();
    if (dia !== 0 && dia !== 6) count++;
  }
  return count;
}

interface DashData {
  apolices: number;
  metaApolices: number;
  premioMes: number;
  missao: { contatos: number; cotacoes: number; propostas: number; followups: number };
  funil: { leads: number; cotacoes: number; propostas: number; fechados: number };
  posicao: { rank: number; total: number; minhaConv: number; mediaConv: number };
  leadsParados: { id: string; nome: string; dias: number; status: string }[];
  tendencia: { dia: string; leads: number; cotacoes: number; fechados: number }[];
  conquistas: { id: string; icon: string; nome: string; ok: boolean }[];
}

function Page() {
  const { profile, session } = useAuth();
  const [d, setD] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    void carregar(session.user.id).then((r) => { setD(r); setLoading(false); });
  }, [session?.user?.id]);

  const today = new Date();
  const headerSub = `${today.getDate()} de ${MESES[today.getMonth()]} · ${DIAS_SEMANA[today.getDay()]} · faltam ${diasUteisRestantes(today)} dias úteis no mês.`;
  const pct = d && d.metaApolices ? Math.min(100, Math.round((d.apolices / d.metaApolices) * 100)) : 0;
  const faltam = d ? Math.max(0, d.metaApolices - d.apolices) : 0;
  const ritmoBadge = pct >= 67 ? { cls: "ritmo-ok", txt: "No ritmo" } : pct >= 33 ? { cls: "ritmo-ok", txt: "Avançando" } : { cls: "ritmo-ok", txt: "Comece já" };
  const diasUteis = diasUteisRestantes(today);
  const ritmo = faltam && diasUteis ? `${Math.max(1, Math.round(diasUteis / Math.max(1, faltam)))}` : "—";
  const previsao = d && d.apolices ? Math.round((d.premioMes / d.apolices) * d.metaApolices) : d?.premioMes || 0;

  const dash = d ?? {
    apolices: 0, metaApolices: 0, premioMes: 0,
    missao: { contatos: 0, cotacoes: 0, propostas: 0, followups: 0 },
    funil: { leads: 0, cotacoes: 0, propostas: 0, fechados: 0 },
    posicao: { rank: 0, total: 0, minhaConv: 0, mediaConv: 0 },
    leadsParados: [], tendencia: [], conquistas: [],
  };

  const missoesMeta = { contatos: 3, cotacoes: 2, propostas: 1, followups: 2 } as const;
  const missoes = [
    { id: "contatos", icon: "i-phone", label: "Fazer 3 primeiros contatos", v: dash.missao.contatos, m: missoesMeta.contatos },
    { id: "cotacoes", icon: "i-compare", label: "Enviar 2 cotações", v: dash.missao.cotacoes, m: missoesMeta.cotacoes },
    { id: "propostas", icon: "i-file", label: "Enviar 1 proposta", v: dash.missao.propostas, m: missoesMeta.propostas },
    { id: "followup", icon: "i-check", label: "Fazer 2 follow-ups", v: dash.missao.followups, m: missoesMeta.followups },
  ];
  const missoesDone = missoes.filter((m) => m.v >= m.m).length;

  const funilMax = Math.max(1, dash.funil.leads, dash.funil.cotacoes, dash.funil.propostas, dash.funil.fechados);
  const fnW = (n: number) => `${Math.round((n / funilMax) * 100)}%`;

  // Tendência: viewBox 720x200; eixo x: 30..690, y: 30..170
  const trend = dash.tendencia.length ? dash.tendencia : Array.from({ length: 7 }, (_, i) => ({
    dia: ["Sex","Sáb","Dom","Seg","Ter","Qua","Qui"][i], leads: 0, cotacoes: 0, fechados: 0,
  }));
  const tMax = Math.max(1, ...trend.map((t) => Math.max(t.leads, t.cotacoes, t.fechados)));
  const xs = trend.map((_, i) => 30 + (i * 660) / (trend.length - 1));
  const yv = (v: number) => 170 - (v / tMax) * 140;
  const path = (key: "leads" | "cotacoes" | "fechados") =>
    trend.map((t, i) => `${i === 0 ? "M" : "L"}${xs[i]},${yv(t[key])}`).join(" ");
  const area = (key: "leads" | "cotacoes" | "fechados") =>
    `${path(key)} L ${xs[xs.length - 1]},170 L ${xs[0]},170 Z`;

  return (
    <AppShell title="Início">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Olá, {profile?.nome?.split(" ")[0] ?? "vendedor"} 👋</h1>
          <div className="sub">{headerSub} {loading ? "Carregando…" : "Bora fechar a meta! 💪"}</div>
        </div>
        <div className="tools">
          <Link to="/venda/mensagens-prontas" className="btn btn-ghost">
            <svg width="14" height="14"><use href="#i-message" /></svg> Mensagens
          </Link>
          <Link to="/venda/pipeline" className="btn btn-slate">
            <svg width="14" height="14"><use href="#i-kanban" /></svg> Abrir pipeline
          </Link>
        </div>
      </div>

      {/* PLACAR DO MÊS */}
      <div className="card card-yellow" style={{ marginBottom: 20 }}>
        <div className="card-h">
          <h3><svg width="16" height="16"><use href="#i-target" /></svg> Seu placar do mês</h3>
          <span className={`ritmo-badge ${ritmoBadge.cls}`}>{ritmoBadge.txt}</span>
        </div>
        <div className="card-b">
          <div className="hero-placar">
            <div className="ring-wrap">
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="58" fill="none" stroke="var(--offwhite)" strokeWidth="13" />
                <circle cx="70" cy="70" r="58" fill="none" stroke="var(--yellow)" strokeWidth="13"
                  strokeLinecap="round" strokeDasharray="364.4"
                  strokeDashoffset={364.4 - (364.4 * pct) / 100}
                  transform="rotate(-90 70 70)" />
              </svg>
              <div className="ring-txt"><div className="ring-pct">{pct}%</div><div className="ring-sub">da meta</div></div>
            </div>
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hs-lbl">APÓLICES</div>
                <div className="hs-val">{dash.apolices} <span style={{ color: "var(--muted)", fontSize: 15 }}>/ {dash.metaApolices || "—"}</span></div>
                <div className="hs-sub">{dash.metaApolices ? <>faltam <strong>{faltam}</strong> pra meta</> : <>defina a meta em metas mensais</>}</div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">PRÊMIO NO MÊS</div>
                <div className="hs-val" style={{ color: "var(--ok)" }}>{BRL(dash.premioMes)}</div>
                <div className="hs-sub">de propostas transmitidas</div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">RITMO NECESSÁRIO</div>
                <div className="hs-val">{faltam ? `1 a cada ${ritmo} dia${ritmo === "1" ? "" : "s"}` : "Meta batida"}</div>
                <div className="hs-sub">{faltam} apólice{faltam === 1 ? "" : "s"} em {diasUteis} dias</div>
              </div>
              <div className="hero-stat">
                <div className="hs-lbl">PREVISÃO FECHAMENTO</div>
                <div className="hs-val">{BRL(previsao)}</div>
                <div className="hs-sub">no ritmo atual</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="col">
          {/* MISSÃO DE HOJE */}
          <div className="card">
            <div className="card-h">
              <h3><svg width="16" height="16"><use href="#i-check-circle" /></svg> Sua missão de hoje</h3>
              <span className="chip chip-yellow">{missoesDone}/{missoes.length} concluídas</span>
            </div>
            <div className="card-b">
              <p className="small muted" style={{ marginTop: 0 }}>Pequenos passos todo dia = meta batida no fim do mês.</p>
              {missoes.map((m) => (
                <div key={m.id} className={`mission-row ${m.v >= m.m ? "done" : ""}`}>
                  <div className="m-check"><svg width="15" height="15"><use href={`#${m.icon}`} /></svg></div>
                  <div className="m-label">{m.label}</div>
                  <div className="m-prog">{m.v}/{m.m}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FUNIL */}
          <div className="card">
            <div className="card-h">
              <h3><svg width="16" height="16"><use href="#i-gauge" /></svg> Meu funil — onde melhorar</h3>
              <span className="small muted">{MESES[today.getMonth()].slice(0,3)}/{String(today.getFullYear()).slice(-2)}</span>
            </div>
            <div className="card-b">
              <div className="funnel">
                <div className="funnel-row"><div className="fn-lbl">Leads</div><div className="funnel-track"><div className="funnel-bar" style={{ width: fnW(dash.funil.leads), background: "#2F3D48" }}>{dash.funil.leads}</div></div></div>
                <div className="funnel-row"><div className="fn-lbl">Cotações</div><div className="funnel-track"><div className="funnel-bar" style={{ width: fnW(dash.funil.cotacoes), background: "#425563" }}>{dash.funil.cotacoes}</div></div></div>
                <div className="funnel-row"><div className="fn-lbl">Propostas</div><div className="funnel-track"><div className="funnel-bar" style={{ width: fnW(dash.funil.propostas), background: "#FFB600" }}>{dash.funil.propostas}</div></div></div>
                <div className="funnel-row"><div className="fn-lbl">Fechados</div><div className="funnel-track"><div className="funnel-bar" style={{ width: fnW(dash.funil.fechados), background: "#2E8B57" }}>{dash.funil.fechados}</div></div></div>
              </div>
            </div>
          </div>

          {/* LEADS PARADOS */}
          <div className="card">
            <div className="card-h">
              <h3><svg width="16" height="16"><use href="#i-clock" /></svg> Leads parados</h3>
              <span className="small muted">+5 dias sem mexer</span>
            </div>
            <div className="card-b">
              {dash.leadsParados.length === 0 && <p className="small muted" style={{ margin: 0 }}>Nenhum lead parado. 🎯</p>}
              {dash.leadsParados.map((l) => (
                <div key={l.id} className="task-item">
                  <div className="ic"><svg width="16" height="16"><use href="#i-alert" /></svg></div>
                  <div className="body">
                    <h4>{l.nome || "Lead sem nome"}</h4>
                    <p>parado há {l.dias} dias — "{l.status}"</p>
                  </div>
                  <Link to="/venda/pipeline" className="meta ok">retomar agora</Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col">
          {/* POSIÇÃO */}
          <div className="card">
            <div className="card-h"><h3><svg width="16" height="16"><use href="#i-award" /></svg> Sua posição na equipe</h3></div>
            <div className="card-b">
              <div className="pos-row">
                <div className="pos-num">{dash.posicao.rank ? `${dash.posicao.rank}º` : "—"}</div>
                <div>
                  <div className="bold" style={{ color: "var(--slate)" }}>de {dash.posicao.total} vendedor{dash.posicao.total === 1 ? "" : "es"}</div>
                  <div className="small muted">ranking por propostas transmitidas no mês</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="small muted">Sua conversão</span>
                  <span className="bold" style={{ color: "var(--slate)" }}>{dash.posicao.minhaConv}%</span>
                </div>
                <div className="posbar"><div style={{ width: `${dash.posicao.minhaConv}%`, height: "100%", background: "var(--yellow)", borderRadius: 6 }} /></div>
                <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                  <span className="small muted">Média da equipe</span>
                  <span className="bold" style={{ color: "var(--slate)" }}>{dash.posicao.mediaConv}%</span>
                </div>
                <div className="posbar"><div style={{ width: `${dash.posicao.mediaConv}%`, height: "100%", background: "var(--slate-soft)", borderRadius: 6 }} /></div>
              </div>
            </div>
          </div>

          {/* CONQUISTAS */}
          <div className="card">
            <div className="card-h">
              <h3><svg width="16" height="16"><use href="#i-spark" /></svg> Suas conquistas</h3>
              <span className="small muted">{dash.conquistas.filter(c => c.ok).length}/{dash.conquistas.length}</span>
            </div>
            <div className="card-b">
              <div className="badge-grid">
                {dash.conquistas.map((c) => (
                  <div key={c.id} className={`badge-item ${c.ok ? "" : "locked"}`}>
                    <div className="b-ic">{c.icon}</div>
                    <div className="b-t">{c.nome}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TENDÊNCIA */}
          <div className="card chart-card">
            <div className="card-h">
              <h3><svg width="16" height="16"><use href="#i-trending-up" /></svg> Tendência · 7 dias</h3>
              <div className="chart-legend">
                <div className="it"><div className="dot" style={{ background: "var(--slate)" }} />Leads</div>
                <div className="it"><div className="dot" style={{ background: "var(--yellow)" }} />Cotações</div>
                <div className="it"><div className="dot" style={{ background: "var(--ok)" }} />Fecham.</div>
              </div>
            </div>
            <div className="card-b">
              <svg viewBox="0 0 720 200" preserveAspectRatio="none" style={{ width: "100%", height: 200 }}>
                {[30, 65, 100, 135, 170].map((y) => <line key={y} x1="30" x2="690" y1={y} y2={y} stroke="#EFEAD9" strokeWidth="1" />)}
                <path d={area("leads")} fill="#425563" opacity="0.07" />
                <path d={path("leads")} fill="none" stroke="#425563" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={area("cotacoes")} fill="#FFB600" opacity="0.07" />
                <path d={path("cotacoes")} fill="none" stroke="#FFB600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d={area("fechados")} fill="#2E8B57" opacity="0.07" />
                <path d={path("fechados")} fill="none" stroke="#2E8B57" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {trend.map((t, i) => (
                  <g key={i}>
                    <circle cx={xs[i]} cy={yv(t.leads)} r="3" fill="#425563" />
                    <circle cx={xs[i]} cy={yv(t.cotacoes)} r="3" fill="#FFB600" />
                    <circle cx={xs[i]} cy={yv(t.fechados)} r="3" fill="#2E8B57" />
                    <text x={xs[i]} y="192" textAnchor="middle" fontSize="11" fill="#7A8794" fontFamily="Heebo">{t.dia}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

async function carregar(userId: string): Promise<DashData> {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const inicioDia = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const cincoDiasAtras = new Date(now.getTime() - 5 * 86400000).toISOString();
  const seteDiasAtras = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();

  // perfil para empresa
  const { data: prof } = await supabase.from("profiles").select("empresa_id").eq("id", userId).maybeSingle();
  const empresaId = prof?.empresa_id;

  // 1) Placar — propostas transmitidas no mês
  const { data: propsMes } = await supabase
    .from("propostas")
    .select("premio, transmitida_em, status")
    .eq("responsavel_id", userId)
    .eq("status", "transmitida")
    .gte("transmitida_em", inicioMes);
  const apolices = propsMes?.length ?? 0;
  const premioMes = (propsMes ?? []).reduce((s, p: any) => s + Number(p.premio || 0), 0);

  // meta
  const { data: meta } = await supabase
    .from("metas")
    .select("meta_vendas")
    .eq("escopo", "usuario").eq("ref_id", userId)
    .eq("ano", now.getFullYear()).eq("mes", now.getMonth() + 1)
    .maybeSingle();
  const metaApolices = Number(meta?.meta_vendas ?? 0);

  // 2) Missão de hoje
  const [{ data: leadsHoje }, { data: cotacoesHoje }, { data: propostasHoje }, { data: followHoje }] = await Promise.all([
    supabase.from("leads").select("id").eq("responsavel_id", userId).gte("atualizado_em", inicioDia),
    supabase.from("cotacoes").select("id").eq("responsavel_id", userId).gte("criado_em", inicioDia),
    supabase.from("propostas").select("id").eq("responsavel_id", userId).gte("criado_em", inicioDia),
    supabase.from("leads").select("id").eq("responsavel_id", userId).in("status_pipeline", ["negociacao", "proposta"]).gte("atualizado_em", inicioDia),
  ]);

  // 3) Funil do mês
  const [{ data: lMes }, { data: cMes }, { data: pMes }, { data: tMes }] = await Promise.all([
    supabase.from("leads").select("id").eq("responsavel_id", userId).gte("criado_em", inicioMes),
    supabase.from("cotacoes").select("id").eq("responsavel_id", userId).gte("criado_em", inicioMes),
    supabase.from("propostas").select("id").eq("responsavel_id", userId).gte("criado_em", inicioMes),
    supabase.from("propostas").select("id").eq("responsavel_id", userId).eq("status", "transmitida").gte("transmitida_em", inicioMes),
  ]);
  const funil = {
    leads: lMes?.length ?? 0,
    cotacoes: cMes?.length ?? 0,
    propostas: pMes?.length ?? 0,
    fechados: tMes?.length ?? 0,
  };

  // 4) Leads parados
  const { data: parados } = await supabase
    .from("leads")
    .select("id,nome,status_pipeline,atualizado_em")
    .eq("responsavel_id", userId)
    .not("status_pipeline", "in", "(ganho,perdido)")
    .lt("atualizado_em", cincoDiasAtras)
    .order("atualizado_em", { ascending: true })
    .limit(5);
  const leadsParados = (parados ?? []).map((l: any) => ({
    id: l.id, nome: l.nome,
    dias: Math.max(5, Math.floor((Date.now() - new Date(l.atualizado_em).getTime()) / 86400000)),
    status: String(l.status_pipeline),
  }));

  // 5) Posição na equipe (propostas transmitidas no mês)
  let posicao = { rank: 0, total: 0, minhaConv: 0, mediaConv: 0 };
  if (empresaId) {
    const { data: ranking } = await supabase
      .from("propostas")
      .select("responsavel_id")
      .eq("empresa_id", empresaId)
      .eq("status", "transmitida")
      .gte("transmitida_em", inicioMes);
    const counts = new Map<string, number>();
    (ranking ?? []).forEach((r: any) => counts.set(r.responsavel_id, (counts.get(r.responsavel_id) ?? 0) + 1));

    const { data: vendedores } = await supabase
      .from("profiles").select("id").eq("empresa_id", empresaId);
    const ids = (vendedores ?? []).map((v: any) => v.id);
    const total = ids.length;
    const sorted = ids
      .map((id) => ({ id, n: counts.get(id) ?? 0 }))
      .sort((a, b) => b.n - a.n);
    const rank = sorted.findIndex((s) => s.id === userId) + 1;

    // conversão = propostas transmitidas / leads do mês
    const { data: leadsEmpresa } = await supabase
      .from("leads").select("responsavel_id")
      .eq("empresa_id", empresaId)
      .gte("criado_em", inicioMes);
    const leadsPor = new Map<string, number>();
    (leadsEmpresa ?? []).forEach((l: any) => leadsPor.set(l.responsavel_id, (leadsPor.get(l.responsavel_id) ?? 0) + 1));
    const minhaConv = leadsPor.get(userId) ? Math.round((funil.fechados / (leadsPor.get(userId) || 1)) * 100) : 0;
    const totalLeads = (leadsEmpresa ?? []).length;
    const totalFech = (ranking ?? []).length;
    const mediaConv = totalLeads ? Math.round((totalFech / totalLeads) * 100) : 0;
    posicao = { rank, total, minhaConv, mediaConv };
  }

  // 6) Tendência últimos 7 dias
  const dias: { dia: string; date: Date; leads: number; cotacoes: number; fechados: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dias.push({ dia: ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][dt.getDay()], date: dt, leads: 0, cotacoes: 0, fechados: 0 });
  }
  const [{ data: l7 }, { data: c7 }, { data: t7 }] = await Promise.all([
    supabase.from("leads").select("criado_em").eq("responsavel_id", userId).gte("criado_em", seteDiasAtras),
    supabase.from("cotacoes").select("criado_em").eq("responsavel_id", userId).gte("criado_em", seteDiasAtras),
    supabase.from("propostas").select("transmitida_em").eq("responsavel_id", userId).eq("status", "transmitida").gte("transmitida_em", seteDiasAtras),
  ]);
  const bucket = (rows: any[] | null, key: string, field: "leads"|"cotacoes"|"fechados") => {
    (rows ?? []).forEach((r) => {
      const dt = new Date(r[key]);
      const ix = dias.findIndex((d) => d.date.toDateString() === new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).toDateString());
      if (ix >= 0) dias[ix][field]++;
    });
  };
  bucket(l7, "criado_em", "leads");
  bucket(c7, "criado_em", "cotacoes");
  bucket(t7, "transmitida_em", "fechados");

  // 7) Conquistas
  const { data: anyVenda } = await supabase.from("propostas").select("id").eq("responsavel_id", userId).eq("status", "transmitida").limit(1);
  const inicioSemana = new Date(now); inicioSemana.setDate(now.getDate() - 6);
  const propsSemana = funil.propostas; // aproximação 7d
  const diasComContato = new Set(dias.filter((d) => d.leads + d.cotacoes + d.fechados > 0).map((d) => d.date.toDateString()));
  let seq = 0, melhor = 0;
  dias.forEach((d) => { if (diasComContato.has(d.date.toDateString())) { seq++; melhor = Math.max(melhor, seq); } else seq = 0; });
  const conquistas = [
    { id: "primeira", icon: "🏅", nome: "1ª venda", ok: (anyVenda?.length ?? 0) > 0 },
    { id: "rapido", icon: "⚡", nome: "Atender hoje", ok: (leadsHoje?.length ?? 0) > 0 },
    { id: "seq", icon: "🔥", nome: "Sequência 3 dias", ok: melhor >= 3 },
    { id: "prop5", icon: "📄", nome: "5 propostas/semana", ok: propsSemana >= 5 },
    { id: "meta", icon: "🎯", nome: "Bater meta do mês", ok: metaApolices > 0 && apolices >= metaApolices },
    { id: "top3", icon: "👑", nome: "Top 3 da equipe", ok: posicao.rank > 0 && posicao.rank <= 3 },
  ];

  return {
    apolices, metaApolices, premioMes,
    missao: {
      contatos: leadsHoje?.length ?? 0,
      cotacoes: cotacoesHoje?.length ?? 0,
      propostas: propostasHoje?.length ?? 0,
      followups: followHoje?.length ?? 0,
    },
    funil, posicao, leadsParados,
    tendencia: dias.map((d) => ({ dia: d.dia, leads: d.leads, cotacoes: d.cotacoes, fechados: d.fechados })),
    conquistas,
  };
}
