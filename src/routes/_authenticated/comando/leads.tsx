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
  atualizado_em: string | null;
  distribuido_em: string | null;
  ultimo_atendimento_em: string | null;
  bloqueado: boolean | null;
  motivo_bloqueio: string | null;
  motivo_perda: string | null;
  submotivo_perda: string | null;
  em_avaliacao_matriz: boolean | null;
  arquivado: boolean | null;
  dados: any;
};
type Empresa = { id: string; nome: string | null };
type Profile = { id: string; nome: string | null; empresa_id?: string | null };
type Evento = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  criado_em: string;
  meta: Record<string, any> | null;
};

const EVENT_ICON: Record<string, string> = {
  redistribuido: "i-share",
  reativado_de_perda: "i-refresh",
  puxado_de_volta: "i-corner-up-left",
  bloqueado: "i-lock",
  desbloqueado: "i-lock",
  sla_expirado: "i-alert-triangle",
  lead_assumido: "i-check",
  arquivado: "i-archive",
  desarquivado: "i-archive",
};

const SLA_SECONDS = 180;

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
  if (s < 3600) return `há ${Math.floor(s / 60)}m`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `há ${h}h ${String(m).padStart(2, "0")}m`;
  }
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

// ordem canônica das etapas do funil
const STAGE_ORDER = ["novo", "contato", "qualificado", "cotacao", "proposta", "negociacao", "ganho", "perdido"];
const STAGE_META: Record<string, { titulo: string; descricao: string; icon: string }> = {
  novo: { titulo: "Lead recebido", descricao: "", icon: "i-layers" },
  contato: { titulo: "1º contato", descricao: "primeira conversa com o cliente", icon: "i-phone" },
  qualificado: { titulo: "Qualificado", descricao: "perfil e veículo confirmados", icon: "i-check" },
  cotacao: { titulo: "Cotado", descricao: "multi-cálculo rodado", icon: "i-layers" },
  proposta: { titulo: "Proposta enviada", descricao: "comparativo enviado ao cliente", icon: "i-file" },
  negociacao: { titulo: "Em negociação", descricao: "ajustes com o cliente", icon: "i-message" },
  ganho: { titulo: "Fechado", descricao: "apólice em emissão", icon: "i-check-circle" },
  perdido: { titulo: "Perdido", descricao: "encerrado sem fechamento", icon: "i-alert-triangle" },
};

function Page() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [empresasList, setEmpresasList] = useState<Empresa[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [fStatus, setFStatus] = useState("");
  const [fUf, setFUf] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [fArquivados, setFArquivados] = useState<"ativos" | "arquivados" | "todos">("ativos");

  // modals
  const [modal, setModal] = useState<null | { kind: "hist" | "redist" | "block"; lead: Lead }>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: lds, error }, { data: emps }, { data: profs }] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "id,nome,contato,origem,status_pipeline,empresa_id,responsavel_id,criado_em,atualizado_em,distribuido_em,ultimo_atendimento_em,bloqueado,motivo_bloqueio,motivo_perda,submotivo_perda,em_avaliacao_matriz,arquivado,dados"
          )
          .order("criado_em", { ascending: false })
          .limit(500),
        supabase.from("empresas").select("id,nome").order("nome"),
        supabase.from("profiles").select("id,nome,empresa_id"),
      ]);
      if (error) setErr(error.message);
      setLeads((lds ?? []) as Lead[]);
      const em: Record<string, Empresa> = {};
      for (const e of (emps ?? []) as Empresa[]) em[e.id] = e;
      setEmpresas(em);
      setEmpresasList((emps ?? []) as Empresa[]);
      const pm: Record<string, Profile> = {};
      for (const p of (profs ?? []) as Profile[]) pm[p.id] = p;
      setProfiles(pm);
      setProfilesList((profs ?? []) as Profile[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const enriched = useMemo(() => leads.map((l) => {
    const uf = (l.dados?.uf as string | undefined) || "";
    const cidade = (l.dados?.cidade as string | undefined) || "";
    const ageSec = Math.floor((now - new Date(l.criado_em).getTime()) / 1000);
    const distribuido = !!(l.empresa_id || l.responsavel_id || l.distribuido_em);
    const slaSec = distribuido && l.distribuido_em
      ? Math.max(0, Math.floor((now - new Date(l.distribuido_em).getTime()) / 1000))
      : ageSec;
    return { ...l, uf, cidade, ageSec, distribuido, slaSec };
  }), [leads, now]);

  const filterOptions = useMemo(() => {
    const ufs = new Set<string>(); const origens = new Set<string>();
    for (const l of enriched) { if (l.uf) ufs.add(l.uf); if (l.origem) origens.add(l.origem); }
    return { ufs: Array.from(ufs).sort(), origens: Array.from(origens).sort() };
  }, [enriched]);

  const filtered = useMemo(() => enriched.filter((l) => {
    if (fArquivados === "ativos" && l.arquivado) return false;
    if (fArquivados === "arquivados" && !l.arquivado) return false;
    if (fStatus) {
      if (fStatus === "Distribuído") { if (!l.distribuido || l.status_pipeline !== "novo") return false; }
      else if (fStatus === "SLA estourado") { if (l.distribuido || l.slaSec <= SLA_SECONDS) return false; }
      else if (fStatus === "Bloqueado") { if (!l.bloqueado) return false; }
      else { const lbl = STATUS_LABEL[l.status_pipeline] || l.status_pipeline; if (lbl !== fStatus) return false; }
    }
    if (fUf && l.uf !== fUf) return false;
    if (fOrigem && (l.origem || "") !== fOrigem) return false;
    return true;
  }), [enriched, fStatus, fUf, fOrigem, fArquivados]);

  const kpis = useMemo(() => {
    const pendentes = enriched.filter((l) => !l.distribuido && l.status_pipeline === "novo");
    const distribuidos = enriched.filter((l) => l.distribuido && l.distribuido_em);
    const oldest = pendentes.reduce((a, l) => Math.max(a, l.ageSec), 0);
    const avgDist = distribuidos.length ? Math.round(distribuidos.reduce((a, l) => a + l.slaSec, 0) / distribuidos.length) : 0;
    const okDist = distribuidos.filter((l) => l.slaSec <= SLA_SECONDS).length;
    const pctDist = distribuidos.length ? Math.round((okDist / distribuidos.length) * 100) : 0;
    const atend = enriched.filter((l) => l.ultimo_atendimento_em);
    const avgAtend = atend.length ? Math.round(atend.reduce((a, l) => a + Math.max(0, (new Date(l.ultimo_atendimento_em!).getTime() - new Date(l.criado_em).getTime()) / 1000), 0) / atend.length) : 0;
    return { oldest, avgDist, pctDist, avgAtend, pendentes: pendentes.length };
  }, [enriched]);

  const chips = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const today = (d: string) => new Date(d).getTime() >= todayStart.getTime();
    return {
      pendentes: enriched.filter((l) => !l.distribuido && l.status_pipeline === "novo").length,
      slaOver: enriched.filter((l) => !l.distribuido && l.status_pipeline === "novo" && l.ageSec > SLA_SECONDS).length,
      emAtend: enriched.filter((l) => ["contato","qualificado","cotacao","proposta","negociacao"].includes(l.status_pipeline)).length,
      filaHoje: enriched.filter((l) => today(l.criado_em)).length,
      fechadosHoje: enriched.filter((l) => l.status_pipeline === "ganho" && today(l.criado_em)).length,
    };
  }, [enriched]);

  function openLead(l: Lead) {
    const st = l.status_pipeline;
    if (st === "novo" || st === "contato" || st === "qualificado" || st === "cotacao") {
      supabase.from("cotacoes").select("id,step_atual").eq("lead_id", l.id).order("atualizado_em",{ascending:false}).limit(1).maybeSingle().then(({ data }) => {
        if (data?.id) navigate({ to: "/venda/novo-lead", search: { id: data.id, step: Math.max(0, Number(data.step_atual ?? 0)) } });
        else navigate({ to: "/venda/novo-lead", search: {} });
      });
      return;
    }
    if (st === "proposta" || st === "negociacao") navigate({ to: "/venda/propostas", search: {} });
    if (st === "ganho") navigate({ to: "/venda/aceite", search: {} });
  }

  async function puxarDeVolta(l: Lead) {
    if (!confirm(`Puxar o lead "${l.nome}" de volta para a matriz?`)) return;
    const { error } = await supabase.rpc("puxar_lead_de_volta", { p_lead: l.id });
    if (error) alert(error.message); else load();
  }

  async function toggleArquivar(l: Lead) {
    const arquivar = !l.arquivado;
    if (arquivar && !confirm(`Arquivar o lead "${l.nome}"? Ele sairá da lista padrão e pode ser visto no filtro "Arquivados".`)) return;
    const { error } = await supabase.rpc(arquivar ? "arquivar_lead" : "desarquivar_lead", { p_lead: l.id });
    if (error) alert(error.message); else load();
  }

  return (
    <AppShell title="Leads">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Central de Leads</h1>
          <div className="sub">Lead de campanha é mídia paga esfriando — <strong>distribua em até 3 min</strong> ou a conversão despenca</div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost" onClick={() => navigate({ to: "/comando/distribuicao" })}><svg width="14" height="14"><use href="#i-settings"></use></svg> Regras</button>
          <button className="btn btn-yellow" onClick={() => navigate({ to: "/comando/distribuicao" })}><svg width="14" height="14"><use href="#i-share"></use></svg> Distribuir pendentes ({kpis.pendentes})</button>
        </div>
      </div>

      {chips.pendentes > 0 && (
        <div className="audit-note" style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 16 }}>
          <svg width="16" height="16"><use href="#i-alert-triangle"></use></svg> <strong style={{ marginRight: 4 }}>Distribuição manual.</strong> {chips.pendentes} leads esperando você distribuir.
        </div>
      )}

      <div className="kpi-grid">
        <div className={`kpi ${kpis.oldest > SLA_SECONDS ? "k-alert" : ""}`}>
          <div className="ic-wrap"><svg width="20" height="20"><use href="#i-clock"></use></svg></div>
          <div className="lbl">LEAD MAIS ANTIGO SEM DISTRIBUIR</div>
          <div className="val" style={{ fontSize: 24 }}>{kpis.oldest > 0 ? fmtDur(kpis.oldest) : "—"}</div>
          <div className="meta"><strong className={kpis.oldest > SLA_SECONDS ? "down" : "up"}>{kpis.oldest > SLA_SECONDS ? "acima do SLA de 3 min" : "dentro do SLA"}</strong></div>
        </div>
        <div className="kpi"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-gauge"></use></svg></div><div className="lbl">TEMPO MÉD. ATÉ DISTRIBUIR</div><div className="val" style={{ fontSize: 24 }}>{kpis.avgDist > 0 ? fmtDur(kpis.avgDist) : "—"}</div><div className="meta">meta: até 3 min</div></div>
        <div className={`kpi ${kpis.pctDist >= 90 ? "k-ok" : ""}`}><div className="ic-wrap"><svg width="20" height="20"><use href="#i-percent"></use></svg></div><div className="lbl">DISTRIBUÍDOS EM &lt; 3 MIN</div><div className="val" style={{ fontSize: 24 }}>{kpis.pctDist}%</div><div className="meta">meta: 90%</div></div>
        <div className="kpi"><div className="ic-wrap"><svg width="20" height="20"><use href="#i-phone"></use></svg></div><div className="lbl">TEMPO MÉD. 1º CONTATO</div><div className="val" style={{ fontSize: 24 }}>{kpis.avgAtend > 0 ? fmtDur(kpis.avgAtend) : "—"}</div><div className="meta">do recebimento à 1ª conversa</div></div>
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
          <option>Novo</option><option>Distribuído</option><option>Em atendimento</option>
          <option>Cotando</option><option>Proposta enviada</option><option>Em negociação</option>
          <option>Fechado</option><option>Perdido</option><option>SLA estourado</option><option>Bloqueado</option>
        </select>
        <select className="select-mini" value={fUf} onChange={(e) => setFUf(e.target.value)}>
          <option value="">Todas as UFs</option>
          {filterOptions.ufs.map((u) => <option key={u}>{u}</option>)}
        </select>
        <select className="select-mini" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {filterOptions.origens.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className="select-mini" value={fArquivados} onChange={(e) => setFArquivados(e.target.value as any)}>
          <option value="ativos">Apenas ativos</option>
          <option value="arquivados">Apenas arquivados</option>
          <option value="todos">Ativos + arquivados</option>
        </select>
        <div className="spacer"></div>
        <span className="small muted">fila ordenada por urgência · {filtered.length} de {leads.length} leads</span>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      <div style={{ overflowX: "auto" }}>
        <table className="table-pipe mtable" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th>Cliente</th><th>Origem</th><th>Cidade/UF</th><th>Entrada</th>
              <th>Status</th><th>SLA / cronômetro</th><th>Atribuição</th>
              <th>Próximo passo</th><th style={{ textAlign: "right" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.sort((a, b) => {
              const aPri = !a.distribuido && a.status_pipeline === "novo" ? (a.ageSec > SLA_SECONDS ? 0 : 1) : 2;
              const bPri = !b.distribuido && b.status_pipeline === "novo" ? (b.ageSec > SLA_SECONDS ? 0 : 1) : 2;
              if (aPri !== bPri) return aPri - bPri;
              return b.ageSec - a.ageSec;
            }).map((l) => {
              const lbl = STATUS_LABEL[l.status_pipeline] || l.status_pipeline;
              const chip = STATUS_CHIP[l.status_pipeline] || "chip-info";
              const slaPill =
                !l.distribuido && l.status_pipeline === "novo"
                  ? l.ageSec > SLA_SECONDS
                    ? { cls: "over", txt: `${fmtDur(l.ageSec)} · estourou!` }
                    : l.ageSec > SLA_SECONDS - 60
                    ? { cls: "warn", txt: `${fmtDur(SLA_SECONDS - l.ageSec)} p/ distribuir` }
                    : { cls: "ok", txt: `${fmtDur(SLA_SECONDS - l.ageSec)} p/ distribuir` }
                  : { cls: l.slaSec > SLA_SECONDS ? "over" : "ok", txt: `distribuído há ${fmtDur(l.slaSec)}` };
              const empresa = l.empresa_id ? empresas[l.empresa_id]?.nome : null;
              const vendedor = l.responsavel_id ? profiles[l.responsavel_id]?.nome : null;
              const rowStyle = !l.distribuido && l.status_pipeline === "novo" && l.ageSec > SLA_SECONDS
                ? { background: "var(--alert-soft)", boxShadow: "inset 4px 0 0 var(--alert)" } : undefined;
              const isPerdido = l.status_pipeline === "perdido";
              const isFechado = l.status_pipeline === "ganho";
              return (
                <tr key={l.id} style={rowStyle}>
                  <td><div className="mini-cell"><strong>{l.nome || "Sem nome"}</strong><small>{l.contato || ""}</small></div></td>
                  <td>
                    {l.origem || "—"}
                    {l.origem && /ads|meta|google/i.test(l.origem) && (<><br /><small className="muted" style={{ color: "#8a6400", fontWeight: 700 }}><svg width="9" height="9"><use href="#i-bolt"></use></svg> campanha paga</small></>)}
                  </td>
                  <td>{l.cidade || "—"}{l.uf && (<><br /><small className="muted">{l.uf}</small></>)}</td>
                  <td><small className="muted">{fmtAgo(l.criado_em)}</small></td>
                  <td>
                    <span className={`chip ${chip}`}>{lbl}</span>
                    {l.bloqueado && <><br /><span className="chip chip-danger" style={{ marginTop: 4 }}>bloqueado</span></>}
                  </td>
                  <td>
                    {isPerdido ? (
                      <span className="chip" style={{ background: "#eee", color: "#666" }}>encerrado</span>
                    ) : (
                      <span className={`sla-pill ${slaPill.cls}`}><svg width="11" height="11"><use href="#i-clock"></use></svg> {slaPill.txt}</span>
                    )}
                  </td>
                  <td>
                    {l.distribuido ? (
                      <div className="mini-cell"><strong style={{ fontSize: 12 }}>{empresa || "—"}</strong>{vendedor && <small>{vendedor}</small>}</div>
                    ) : (<span className="muted small">não distribuído</span>)}
                  </td>
                  <td>
                    <small>
                      {isPerdido ? (
                        <>Motivo: <strong>{l.motivo_perda || l.submotivo_perda || "—"}</strong></>
                      ) : l.bloqueado ? (
                        <>Bloqueado: <strong>{l.motivo_bloqueio || "—"}</strong></>
                      ) : !l.distribuido ? "Distribuir"
                        : l.status_pipeline === "novo" ? "Aguardando atendimento"
                        : `Avançar etapa (${lbl})`}
                    </small>
                  </td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: "flex-end", gap: 4, flexWrap: "nowrap" }}>
                      {!l.bloqueado && !l.distribuido && !isFechado && !isPerdido && (
                        <button className="ic-mini" title="Distribuir" onClick={() => setModal({ kind: "redist", lead: l })}>
                          <svg width="14" height="14"><use href="#i-share"></use></svg>
                        </button>
                      )}
                      {!l.bloqueado && isPerdido && (
                        <button className="ic-mini" title="Reativar e distribuir" onClick={() => setModal({ kind: "redist", lead: l })}>
                          <svg width="14" height="14"><use href="#i-share"></use></svg>
                        </button>
                      )}
                      {!l.bloqueado && l.distribuido && !isFechado && !isPerdido && (
                        <button className="ic-mini" title="Redistribuir" onClick={() => setModal({ kind: "redist", lead: l })}>
                          <svg width="14" height="14"><use href="#i-refresh"></use></svg>
                        </button>
                      )}
                      {!l.bloqueado && l.distribuido && !isFechado && (
                        <button className="ic-mini" title="Puxar de volta" onClick={() => puxarDeVolta(l)}>
                          <svg width="14" height="14"><use href="#i-corner-up-left"></use></svg>
                        </button>
                      )}
                      <button className="ic-mini" title="Histórico" onClick={() => setModal({ kind: "hist", lead: l })}>
                        <svg width="14" height="14"><use href="#i-clock"></use></svg>
                      </button>
                      <button className="ic-mini" title={l.bloqueado ? "Desbloquear" : "Bloquear lead"} onClick={() => setModal({ kind: "block", lead: l })}>
                        <svg width="14" height="14"><use href="#i-lock"></use></svg>
                      </button>
                      {!l.bloqueado && l.distribuido && (
                        <button className="ic-mini" title="Abrir" onClick={() => openLead(l)}>
                          <svg width="14" height="14"><use href="#i-eye"></use></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="muted" style={{ textAlign: "center", padding: 20 }}>Nenhum lead encontrado com os filtros atuais.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal?.kind === "hist" && (
        <HistoricoModal lead={modal.lead} empresas={empresas} profiles={profiles} onClose={() => setModal(null)} />
      )}
      {modal?.kind === "redist" && (
        <RedistModal
          lead={modal.lead}
          empresas={empresasList}
          profiles={profilesList}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
      {modal?.kind === "block" && (
        <BlockModal
          lead={modal.lead}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
    </AppShell>
  );
}

// ====================== MODAIS ======================

function Modal({ children, onClose, title, icon = "i-clock" }: { children: any; onClose: () => void; title: string; icon?: string }) {
  return (
    <div className="modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,50,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(720px, 92vw)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.18)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="18" height="18"><use href={`#${icon}`}></use></svg>
          <h3 style={{ margin: 0, fontSize: 18, flex: 1 }}>{title}</h3>
          <button className="ic-mini" onClick={onClose} title="Fechar"><svg width="14" height="14"><use href="#i-x"></use></svg></button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}

function HistoricoModal({ lead, empresas, profiles, onClose }: { lead: Lead; empresas: Record<string, Empresa>; profiles: Record<string, Profile>; onClose: () => void }) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  useEffect(() => {
    supabase.from("lead_eventos").select("id,tipo,titulo,descricao,criado_em,meta").eq("lead_id", lead.id).order("criado_em").then(({ data }) => setEventos((data ?? []) as Evento[]));
  }, [lead.id]);

  function nomeEmpresa(id?: string | null) { return id ? (empresas[id]?.nome || "—") : null; }
  function nomeVendedor(id?: string | null) { return id ? (profiles[id]?.nome || "—") : null; }

  // sintetiza a linha do tempo a partir dos campos do lead + eventos
  const timeline = useMemo(() => {
    const items: { titulo: string; descricao: string; ts: number; icon: string }[] = [];
    items.push({
      titulo: "Lead recebido",
      descricao: `${lead.origem || "—"}${lead.dados?.cidade ? ` · ${lead.dados.cidade}` : ""}${lead.dados?.uf ? `/${lead.dados.uf}` : ""}`,
      ts: new Date(lead.criado_em).getTime(),
      icon: "i-layers",
    });
    // Distribuição inicial só aparece sintetizada se não existir nenhum evento de redistribuição/assumir
    const temEventoDist = eventos.some((e) => e.tipo === "redistribuido" || e.tipo === "lead_assumido");
    if (lead.distribuido_em && !temEventoDist) {
      const empresaNome = lead.empresa_id ? empresas[lead.empresa_id]?.nome : null;
      const vendNome = lead.responsavel_id ? profiles[lead.responsavel_id]?.nome : null;
      items.push({
        titulo: "Distribuído",
        descricao: [empresaNome && `Franquia: ${empresaNome}`, vendNome ? `Vendedor: ${vendNome}` : "Sem vendedor — fila da franquia"].filter(Boolean).join(" · "),
        ts: new Date(lead.distribuido_em).getTime(),
        icon: "i-share",
      });
    }
    if (lead.ultimo_atendimento_em && !eventos.some((e) => e.tipo === "lead_assumido")) {
      items.push({ titulo: "1º contato", descricao: "primeira conversa com o cliente", ts: new Date(lead.ultimo_atendimento_em).getTime(), icon: "i-phone" });
    }
    const stIdx = STAGE_ORDER.indexOf(lead.status_pipeline);
    if (stIdx >= 0) {
      const passados = ["qualificado", "cotacao", "proposta", "negociacao"].filter((s) => STAGE_ORDER.indexOf(s) <= stIdx);
      const baseTs = lead.atualizado_em ? new Date(lead.atualizado_em).getTime() : Date.now();
      passados.forEach((s, i) => {
        const m = STAGE_META[s];
        items.push({ titulo: m.titulo, descricao: m.descricao, ts: baseTs - (passados.length - i) * 3600_000, icon: m.icon });
      });
      if (lead.status_pipeline === "ganho" || lead.status_pipeline === "perdido") {
        const m = STAGE_META[lead.status_pipeline];
        items.push({
          titulo: m.titulo,
          descricao: lead.status_pipeline === "perdido" ? (lead.motivo_perda || m.descricao) : m.descricao,
          ts: baseTs,
          icon: m.icon,
        });
      }
    }
    for (const e of eventos) {
      const meta = e.meta || {};
      const partes: string[] = [];
      if (e.tipo === "redistribuido" || e.tipo === "lead_assumido" || e.tipo === "reativado_de_perda") {
        const emp = nomeEmpresa(meta.empresa_id);
        const vend = nomeVendedor(meta.responsavel_id);
        if (emp) partes.push(`Franquia: ${emp}`);
        partes.push(vend ? `Vendedor: ${vend}` : "Sem vendedor — fila da franquia");
      } else if (e.tipo === "sla_expirado") {
        const emp = nomeEmpresa(meta.empresa_anterior);
        const vend = nomeVendedor(meta.responsavel_anterior);
        if (emp) partes.push(`Franquia anterior: ${emp}`);
        if (vend) partes.push(`Vendedor anterior: ${vend}`);
      } else if (e.tipo === "puxado_de_volta") {
        const emp = nomeEmpresa(meta.empresa_anterior);
        const vend = nomeVendedor(meta.responsavel_anterior);
        if (emp) partes.push(`Estava em: ${emp}`);
        if (vend) partes.push(`Com: ${vend}`);
      }
      const desc = [e.descricao, partes.join(" · ")].filter(Boolean).join(" — ");
      items.push({ titulo: e.titulo, descricao: desc, ts: new Date(e.criado_em).getTime(), icon: EVENT_ICON[e.tipo] || "i-share" });
    }
    items.sort((a, b) => a.ts - b.ts);
    const dur: number[] = items.map((it, i) => (i === 0 ? Date.now() - it.ts : it.ts - items[i - 1].ts));
    const maxIdx = dur.reduce((mi, v, i) => (v > dur[mi] ? i : mi), 0);
    return items.map((it, i) => ({ ...it, durSec: Math.max(0, Math.floor(dur[i] / 1000)), gargalo: i === maxIdx && items.length > 1 }));
  }, [lead, empresas, profiles, eventos]);

  return (
    <Modal title={`Linha do tempo — ${lead.nome || "lead"}`} onClose={onClose} icon="i-clock">
      <div style={{ background: "#eaf1ff", color: "#1f3a8a", padding: "10px 14px", borderRadius: 10, fontWeight: 600, marginBottom: 16, fontSize: 13 }}>
        O tempo gasto em cada etapa mostra onde o lead travou. A etapa em <span style={{ color: "var(--alert)" }}>vermelho</span> é o <strong>maior gargalo</strong> desta jornada.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {timeline.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: it.gargalo ? "var(--alert)" : "#f4ead5", color: it.gargalo ? "#fff" : "#8a6400", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16"><use href={`#${it.icon}`}></use></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{it.titulo}</div>
              {it.descricao && <div className="muted" style={{ fontSize: 13 }}>{it.descricao}</div>}
            </div>
            <span className={`chip ${it.gargalo ? "chip-danger" : ""}`} style={{ alignSelf: "center" }}>
              {i === 0 ? fmtAgo(new Date(it.ts).toISOString()) : fmtDur(it.durSec)}{it.gargalo ? " · gargalo" : ""}
            </span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-dark" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}

function RedistModal({ lead, empresas, profiles, onClose, onDone }: { lead: Lead; empresas: Empresa[]; profiles: Profile[]; onClose: () => void; onDone: () => void }) {
  const [empresaId, setEmpresaId] = useState<string>(lead.empresa_id || "");
  const [responsavelId, setResponsavelId] = useState<string>(lead.responsavel_id || "");
  const [saving, setSaving] = useState(false);
  const vendedoresDaFranquia = profiles.filter((p) => !empresaId || p.empresa_id === empresaId);

  async function salvar() {
    if (!empresaId) { alert("Selecione a franquia"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("redistribuir_lead", {
      p_lead: lead.id, p_empresa: empresaId, p_responsavel: responsavelId || null,
    });
    setSaving(false);
    if (error) alert(error.message); else onDone();
  }

  const isRedist = !!lead.empresa_id;
  return (
    <Modal title={`${isRedist ? "Redistribuir" : "Distribuir"} — ${lead.nome || "lead"}`} onClose={onClose} icon="i-share">
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label className="label">Franquia</label>
          <select className="input" value={empresaId} onChange={(e) => { setEmpresaId(e.target.value); setResponsavelId(""); }}>
            <option value="">Selecione...</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Vendedor (opcional)</label>
          <select className="input" value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} disabled={!empresaId}>
            <option value="">Distribuir para a franquia</option>
            {vendedoresDaFranquia.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-yellow" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</button>
      </div>
    </Modal>
  );
}

function BlockModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const isUnblock = !!lead.bloqueado;

  async function salvar() {
    setSaving(true);
    let error: any = null;
    if (isUnblock) {
      ({ error } = await supabase.rpc("desbloquear_lead", { p_lead: lead.id }));
    } else {
      if (!motivo.trim()) { setSaving(false); alert("Informe o motivo"); return; }
      ({ error } = await supabase.rpc("bloquear_lead", { p_lead: lead.id, p_motivo: motivo.trim() }));
    }
    setSaving(false);
    if (error) alert(error.message); else onDone();
  }

  return (
    <Modal title={`${isUnblock ? "Desbloquear" : "Bloquear"} lead — ${lead.nome || ""}`} onClose={onClose} icon="i-lock">
      {isUnblock ? (
        <p>O lead será desbloqueado e voltará a ser elegível para distribuição/atendimento.{lead.motivo_bloqueio && <><br /><br /><strong>Motivo do bloqueio anterior:</strong> {lead.motivo_bloqueio}</>}</p>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>Leads bloqueados ficam fora da fila de distribuição. Útil para clientes irregulares, duplicidades ou pedidos de exclusão.</p>
          <label className="label">Motivo do bloqueio</label>
          <textarea className="input" rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente solicitou remoção, dados inválidos, duplicidade..." />
        </>
      )}
      <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className={`btn ${isUnblock ? "btn-yellow" : "btn-danger"}`} onClick={salvar} disabled={saving}>
          {saving ? "Salvando..." : isUnblock ? "Desbloquear" : "Bloquear"}
        </button>
      </div>
    </Modal>
  );
}
