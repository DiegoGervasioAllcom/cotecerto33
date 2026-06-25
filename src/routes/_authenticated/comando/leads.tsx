import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/comando/leads")({
  head: () => ({ meta: [{ title: "Leads · CoteCerto" }] }),
  component: Page,
});

type Lead = {
  id: string;
  nome: string;
  contato: string | null;
  origem: string | null;
  status_pipeline: string;
  empresa_id: string | null;
  responsavel_id: string | null;
  criado_em: string;
  distribuido_em: string | null;
  ultimo_atendimento_em: string | null;
  dados: any;
};
type Empresa = { id: string; nome: string | null };
type Profile = { id: string; nome: string | null };

const SLA_SECONDS = 180; // 3 min

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  contato: "Em atendimento",
  qualificado: "Em atendimento",
  cotacao: "Cotando",
  proposta: "Proposta enviada",
  negociacao: "Em negociação",
  ganho: "Fechado",
  perdido: "Perdido",
};
const STATUS_CHIP: Record<string, string> = {
  novo: "chip-yellow",
  contato: "chip-info",
  qualificado: "chip-info",
  cotacao: "chip-info",
  proposta: "chip-info",
  negociacao: "chip-info",
  ganho: "chip-ok",
  perdido: "chip-danger",
};

function fmtAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}
function fmtDur(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${String(s).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function Page() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [fStatus, setFStatus] = useState("");
  const [fUf, setFUf] = useState("");
  const [fOrigem, setFOrigem] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [{ data: lds, error }, { data: emps }, { data: profs }] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "id,nome,contato,origem,status_pipeline,empresa_id,responsavel_id,criado_em,distribuido_em,ultimo_atendimento_em,dados"
          )
          .order("criado_em", { ascending: false })
          .limit(500),
        supabase.from("empresas").select("id,nome").order("nome"),
        supabase.from("profiles").select("id,nome"),
      ]);
      if (error) setErr(error.message);
      setLeads((lds ?? []) as Lead[]);
      const em: Record<string, Empresa> = {};
      for (const e of (emps ?? []) as Empresa[]) em[e.id] = e;
      setEmpresas(em);
      const pm: Record<string, Profile> = {};
      for (const p of (profs ?? []) as Profile[]) pm[p.id] = p;
      setProfiles(pm);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const enriched = useMemo(() => {
    return leads.map((l) => {
      const uf = (l.dados?.uf as string | undefined) || "";
      const cidade = (l.dados?.cidade as string | undefined) || "";
      const ageSec = Math.floor((now - new Date(l.criado_em).getTime()) / 1000);
      const distribuido = !!(l.empresa_id || l.responsavel_id || l.distribuido_em);
      const slaSec = distribuido
        ? Math.max(
            0,
            Math.floor(
              ((l.distribuido_em ? new Date(l.distribuido_em).getTime() : new Date(l.criado_em).getTime()) -
                new Date(l.criado_em).getTime()) /
                1000
            )
          )
        : ageSec;
      return { ...l, uf, cidade, ageSec, distribuido, slaSec };
    });
  }, [leads, now]);

  const filterOptions = useMemo(() => {
    const ufs = new Set<string>();
    const origens = new Set<string>();
    for (const l of enriched) {
      if (l.uf) ufs.add(l.uf);
      if (l.origem) origens.add(l.origem);
    }
    return {
      ufs: Array.from(ufs).sort(),
      origens: Array.from(origens).sort(),
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter((l) => {
      if (fStatus) {
        if (fStatus === "Distribuído") {
          if (!l.distribuido || l.status_pipeline !== "novo") return false;
        } else if (fStatus === "SLA estourado") {
          if (l.distribuido || l.slaSec <= SLA_SECONDS) return false;
        } else {
          const lbl = STATUS_LABEL[l.status_pipeline] || l.status_pipeline;
          if (lbl !== fStatus) return false;
        }
      }
      if (fUf && l.uf !== fUf) return false;
      if (fOrigem && (l.origem || "") !== fOrigem) return false;
      return true;
    });
  }, [enriched, fStatus, fUf, fOrigem]);

  const kpis = useMemo(() => {
    const pendentes = enriched.filter((l) => !l.distribuido && l.status_pipeline === "novo");
    const distribuidos = enriched.filter((l) => l.distribuido && l.distribuido_em);
    const oldest = pendentes.reduce((a, l) => Math.max(a, l.ageSec), 0);
    const avgDist = distribuidos.length
      ? Math.round(distribuidos.reduce((a, l) => a + l.slaSec, 0) / distribuidos.length)
      : 0;
    const okDist = distribuidos.filter((l) => l.slaSec <= SLA_SECONDS).length;
    const pctDist = distribuidos.length ? Math.round((okDist / distribuidos.length) * 100) : 0;
    const atend = enriched.filter((l) => l.ultimo_atendimento_em);
    const avgAtend = atend.length
      ? Math.round(
          atend.reduce((a, l) => a + Math.max(0, (new Date(l.ultimo_atendimento_em!).getTime() - new Date(l.criado_em).getTime()) / 1000), 0) /
            atend.length
        )
      : 0;
    return { oldest, avgDist, pctDist, avgAtend, pendentes: pendentes.length };
  }, [enriched]);

  const chips = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = (d: string) => new Date(d).getTime() >= todayStart.getTime();
    return {
      pendentes: enriched.filter((l) => !l.distribuido && l.status_pipeline === "novo").length,
      slaOver: enriched.filter((l) => !l.distribuido && l.status_pipeline === "novo" && l.ageSec > SLA_SECONDS).length,
      emAtend: enriched.filter((l) => ["contato", "qualificado", "cotacao", "proposta", "negociacao"].includes(l.status_pipeline)).length,
      filaHoje: enriched.filter((l) => today(l.criado_em)).length,
      fechadosHoje: enriched.filter((l) => l.status_pipeline === "ganho" && today(l.criado_em)).length,
    };
  }, [enriched]);

  function openLead(l: Lead) {
    const st = l.status_pipeline;
    if (st === "novo" || st === "contato" || st === "qualificado" || st === "cotacao") {
      supabase
        .from("cotacoes")
        .select("id,step_atual")
        .eq("lead_id", l.id)
        .order("atualizado_em", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.id) navigate({ to: "/venda/novo-lead", search: { id: data.id, step: Math.max(0, Number(data.step_atual ?? 0)) } });
          else navigate({ to: "/venda/novo-lead", search: {} });
        });
      return;
    }
    if (st === "proposta" || st === "negociacao") navigate({ to: "/venda/propostas", search: {} });
    if (st === "ganho") navigate({ to: "/venda/aceite", search: {} });
  }

  return (
    <AppShell title="Leads">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Central de Leads</h1>
          <div className="sub">
            Lead de campanha é mídia paga esfriando — <strong>distribua em até 3 min</strong> ou a conversão despenca
          </div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost" onClick={() => navigate({ to: "/comando/distribuicao" })}>
            <svg width="14" height="14"><use href="#i-settings"></use></svg> Regras
          </button>
          <button className="btn btn-yellow" onClick={() => navigate({ to: "/comando/distribuicao" })}>
            <svg width="14" height="14"><use href="#i-share"></use></svg> Distribuir pendentes ({kpis.pendentes})
          </button>
        </div>
      </div>

      {chips.pendentes > 0 && (
        <div className="audit-note" style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 16 }}>
          <svg width="16" height="16"><use href="#i-alert-triangle"></use></svg>{" "}
          <strong style={{ marginRight: 4 }}>Distribuição manual.</strong> {chips.pendentes} leads esperando você distribuir.
        </div>
      )}

      <div className="kpi-grid">
        <div className={`kpi ${kpis.oldest > SLA_SECONDS ? "k-alert" : ""}`}>
          <div className="ic-wrap"><svg width="20" height="20"><use href="#i-clock"></use></svg></div>
          <div className="lbl">LEAD MAIS ANTIGO SEM DISTRIBUIR</div>
          <div className="val" style={{ fontSize: 24 }}>{kpis.oldest > 0 ? fmtDur(kpis.oldest) : "—"}</div>
          <div className="meta">
            <strong className={kpis.oldest > SLA_SECONDS ? "down" : "up"}>
              {kpis.oldest > SLA_SECONDS ? "acima do SLA de 3 min" : "dentro do SLA"}
            </strong>
          </div>
        </div>
        <div className="kpi">
          <div className="ic-wrap"><svg width="20" height="20"><use href="#i-gauge"></use></svg></div>
          <div className="lbl">TEMPO MÉD. ATÉ DISTRIBUIR</div>
          <div className="val" style={{ fontSize: 24 }}>{kpis.avgDist > 0 ? fmtDur(kpis.avgDist) : "—"}</div>
          <div className="meta">meta: até 3 min</div>
        </div>
        <div className={`kpi ${kpis.pctDist >= 90 ? "k-ok" : ""}`}>
          <div className="ic-wrap"><svg width="20" height="20"><use href="#i-percent"></use></svg></div>
          <div className="lbl">DISTRIBUÍDOS EM &lt; 3 MIN</div>
          <div className="val" style={{ fontSize: 24 }}>{kpis.pctDist}%</div>
          <div className="meta">meta: 90%</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap"><svg width="20" height="20"><use href="#i-phone"></use></svg></div>
          <div className="lbl">TEMPO MÉD. 1º CONTATO</div>
          <div className="val" style={{ fontSize: 24 }}>{kpis.avgAtend > 0 ? fmtDur(kpis.avgAtend) : "—"}</div>
          <div className="meta">do recebimento à 1ª conversa</div>
        </div>
      </div>

      <div className="summary-chips">
        <div className="sum-chip alert"><span className="sc-val">{chips.pendentes}</span><span className="sc-lbl">Aguardando distribuição</span></div>
        <div className="sum-chip alert"><span className="sc-val">{chips.slaOver}</span><span className="sc-lbl">SLA estourado</span></div>
        <div className="sum-chip info"><span className="sc-val">{chips.emAtend}</span><span className="sc-lbl">Em atendimento</span></div>
        <div className="sum-chip"><span className="sc-val">{chips.filaHoje}</span><span className="sc-lbl">Na fila hoje</span></div>
        <div className="sum-chip ok"><span className="sc-val">{chips.fechadosHoje}</span><span className="sc-lbl">Fechados hoje</span></div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTRAR</span>
        <select className="select-mini" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option>Novo</option>
          <option>Distribuído</option>
          <option>Em atendimento</option>
          <option>Cotando</option>
          <option>Proposta enviada</option>
          <option>Em negociação</option>
          <option>Fechado</option>
          <option>Perdido</option>
          <option>SLA estourado</option>
        </select>
        <select className="select-mini" value={fUf} onChange={(e) => setFUf(e.target.value)}>
          <option value="">Todas as UFs</option>
          {filterOptions.ufs.map((u) => <option key={u}>{u}</option>)}
        </select>
        <select className="select-mini" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {filterOptions.origens.map((o) => <option key={o}>{o}</option>)}
        </select>
        <div className="spacer"></div>
        <span className="small muted">fila ordenada por urgência · {filtered.length} de {leads.length} leads</span>
      </div>

      <div className="row" style={{ gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span className="small muted" style={{ fontWeight: 700, letterSpacing: ".06em" }}>CRONÔMETRO DE DISTRIBUIÇÃO:</span>
        <span className="sla-pill ok"><svg width="11" height="11"><use href="#i-clock"></use></svg> no prazo</span>
        <span className="sla-pill warn"><svg width="11" height="11"><use href="#i-clock"></use></svg> atenção</span>
        <span className="sla-pill over"><svg width="11" height="11"><use href="#i-clock"></use></svg> estourou (+3 min)</span>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="table-pipe mtable" style={{ minWidth: 1120 }}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Origem</th>
              <th>Cidade/UF</th>
              <th>Entrada</th>
              <th>Status</th>
              <th>SLA / cronômetro</th>
              <th>Atribuição</th>
              <th>Próximo passo</th>
              <th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .sort((a, b) => {
                // pendentes vencidos primeiro
                const aPri = !a.distribuido && a.status_pipeline === "novo" ? (a.ageSec > SLA_SECONDS ? 0 : 1) : 2;
                const bPri = !b.distribuido && b.status_pipeline === "novo" ? (b.ageSec > SLA_SECONDS ? 0 : 1) : 2;
                if (aPri !== bPri) return aPri - bPri;
                return b.ageSec - a.ageSec;
              })
              .map((l) => {
                const lbl = STATUS_LABEL[l.status_pipeline] || l.status_pipeline;
                const chip = STATUS_CHIP[l.status_pipeline] || "chip-info";
                const slaPill =
                  !l.distribuido && l.status_pipeline === "novo"
                    ? l.ageSec > SLA_SECONDS
                      ? { cls: "over", txt: `${fmtDur(l.ageSec)} · estourou!` }
                      : l.ageSec > SLA_SECONDS - 60
                      ? { cls: "warn", txt: `${fmtDur(SLA_SECONDS - l.ageSec)} p/ distribuir` }
                      : { cls: "ok", txt: `${fmtDur(SLA_SECONDS - l.ageSec)} p/ distribuir` }
                    : { cls: l.slaSec > SLA_SECONDS ? "over" : "ok", txt: `distribuído em ${fmtDur(l.slaSec)}` };
                const empresa = l.empresa_id ? empresas[l.empresa_id]?.nome : null;
                const vendedor = l.responsavel_id ? profiles[l.responsavel_id]?.nome : null;
                const rowStyle =
                  !l.distribuido && l.status_pipeline === "novo" && l.ageSec > SLA_SECONDS
                    ? { background: "var(--alert-soft)", boxShadow: "inset 4px 0 0 var(--alert)" }
                    : undefined;
                return (
                  <tr key={l.id} style={rowStyle}>
                    <td>
                      <div className="mini-cell">
                        <strong>{l.nome || "Sem nome"}</strong>
                        <small>{l.contato || ""}</small>
                      </div>
                    </td>
                    <td>
                      {l.origem || "—"}
                      {l.origem && /ads|meta|google/i.test(l.origem) && (
                        <>
                          <br />
                          <small className="muted" style={{ color: "#8a6400", fontWeight: 700 }}>
                            <svg width="9" height="9"><use href="#i-bolt"></use></svg> campanha paga
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {l.cidade || "—"}
                      {l.uf && (<><br /><small className="muted">{l.uf}</small></>)}
                    </td>
                    <td><small className="muted">{fmtAgo(l.criado_em)}</small></td>
                    <td><span className={`chip ${chip}`}>{lbl}</span></td>
                    <td><span className={`sla-pill ${slaPill.cls}`}><svg width="11" height="11"><use href="#i-clock"></use></svg> {slaPill.txt}</span></td>
                    <td>
                      {l.distribuido ? (
                        <div className="mini-cell">
                          <strong style={{ fontSize: 12 }}>{empresa || "—"}</strong>
                          {vendedor && <small>{vendedor}</small>}
                        </div>
                      ) : (
                        <span className="muted small">não distribuído</span>
                      )}
                    </td>
                    <td>
                      <small>
                        {!l.distribuido
                          ? "Distribuir"
                          : l.status_pipeline === "novo"
                          ? "Aguardando atendimento"
                          : `Avançar etapa (${lbl})`}
                      </small>
                    </td>
                    <td>
                      <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                        {!l.distribuido ? (
                          <button className="btn btn-yellow btn-sm" title="Distribuir" onClick={() => navigate({ to: "/comando/distribuicao" })}>
                            <svg width="12" height="12"><use href="#i-share"></use></svg> Distribuir
                          </button>
                        ) : (
                          <button className="ic-mini" title="Abrir" onClick={() => openLead(l)}>
                            <svg width="15" height="15"><use href="#i-eye"></use></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  Nenhum lead encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
