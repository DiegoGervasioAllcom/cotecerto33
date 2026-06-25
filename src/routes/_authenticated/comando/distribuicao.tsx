import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/comando/distribuicao")({
  head: () => ({ meta: [{ title: "Distribuição · CoteCerto" }] }),
  component: Page,
});

type Criterios = { regiao: boolean; franquia: boolean; disp: boolean; conv: boolean; volume: boolean; horario: boolean };
type Config = {
  id: string; automatico_on: boolean; modo: "regiao" | "performance" | "fila";
  criterios: Criterios; sla_segundos: number;
};
type LeadDev = {
  id: string; nome: string | null; motivo_perda: string | null; submotivo_perda: string | null;
  destino_perda_sugerido: string | null; observacao_perda: string | null; veiculo: string | null;
  responsavel_id: string | null; empresa_id: string | null; atualizado_em: string | null;
};
type LeadFila = {
  id: string; nome: string | null; criado_em: string; cidade: string | null; uf: string | null;
  distribuido_em: string | null;
};
type Vendedor = { id: string; nome: string; empresa_id: string | null; online: boolean };
type Franquia = { id: string; nome: string; cidade: string | null; uf: string | null };

const DEFAULT_CRIT: Criterios = { regiao: true, franquia: true, disp: true, conv: true, volume: true, horario: false };

function Page() {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<Config>({
    id: "default", automatico_on: false, modo: "regiao", criterios: DEFAULT_CRIT, sla_segundos: 180,
  });
  const [devolvidos, setDevolvidos] = useState<LeadDev[]>([]);
  const [fila, setFila] = useState<LeadFila[]>([]);
  const [franquias, setFranquias] = useState<Franquia[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [matrizId, setMatrizId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<{ leadId: string; nome: string; alvo: string; criterio: string }[] | null>(null);
  const [obsDecisao, setObsDecisao] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data: u } = await supabase.auth.getUser();
    let mId: string | null = null;
    if (u.user) {
      const { data: me } = await supabase.from("profiles").select("empresa_id").eq("id", u.user.id).maybeSingle();
      mId = (me?.empresa_id as string) ?? null; setMatrizId(mId);
    }

    const [c, d, f, fr, vd, pr] = await Promise.all([
      supabase.from("distribuicao_config").select("*").eq("id", "default").maybeSingle(),
      supabase.from("leads")
        .select("id,nome,motivo_perda,submotivo_perda,destino_perda_sugerido,observacao_perda,dados_veiculo,responsavel_id,empresa_id,atualizado_em")
        .eq("em_avaliacao_matriz", true).order("atualizado_em", { ascending: false }).limit(200),
      supabase.from("leads")
        .select("id,nome,criado_em,dados,distribuido_em")
        .eq("status_pipeline", "novo").is("responsavel_id", null).is("empresa_id", null)
        .eq("arquivado", false).eq("bloqueado", false).limit(500),
      supabase.from("empresas").select("id,nome,cidade,uf,tipo,status").limit(500),
      supabase.from("profiles").select("id,nome,empresa_id,status").limit(2000),
      supabase.from("v_user_presence").select("user_id,status_efetivo"),
    ]);

    if (c.data) {
      setCfg({
        id: c.data.id, automatico_on: !!c.data.automatico_on,
        modo: (c.data.modo as Config["modo"]) || "regiao",
        criterios: { ...DEFAULT_CRIT, ...(c.data.criterios as object || {}) },
        sla_segundos: c.data.sla_segundos || 180,
      });
    }
    setDevolvidos((d.data ?? []).map((x: any) => ({
      id: x.id, nome: x.nome, motivo_perda: x.motivo_perda, submotivo_perda: x.submotivo_perda,
      destino_perda_sugerido: x.destino_perda_sugerido, observacao_perda: x.observacao_perda,
      responsavel_id: x.responsavel_id ?? null, empresa_id: x.empresa_id ?? null,
      atualizado_em: x.atualizado_em ?? null,
      veiculo: x.dados_veiculo ? `${x.dados_veiculo.marca || ""} ${x.dados_veiculo.modelo || ""} ${x.dados_veiculo.ano || ""}`.trim() : null,
    })));
    setFila(((f.data ?? []) as any[]).map((x) => ({
      id: x.id, nome: x.nome, criado_em: x.criado_em, distribuido_em: x.distribuido_em,
      cidade: x.dados?.cidade ?? null, uf: x.dados?.uf ?? null,
    })));
    setFranquias(((fr.data ?? []) as any[]).filter((e) => e.id !== mId && e.status === "aprovada").map((e) => ({
      id: e.id, nome: e.nome, cidade: e.cidade, uf: e.uf,
    })));
    const presMap = new Map<string, string>(((pr.data ?? []) as any[]).map((x) => [x.user_id, x.status_efetivo]));
    setVendedores(((vd.data ?? []) as any[]).filter((p) => p.empresa_id && p.empresa_id !== mId && p.status === "aprovada").map((p) => ({
      id: p.id, nome: p.nome, empresa_id: p.empresa_id, online: presMap.get(p.id) === "online",
    })));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const tempoMedioManual = useMemo(() => {
    const distribuidosRecentes = fila.filter((l) => l.distribuido_em);
    if (!distribuidosRecentes.length) {
      // sem amostra de distribuídos hoje; usa "mais antigo na fila"
      const oldest = fila.reduce((a, l) => Math.max(a, Date.now() - new Date(l.criado_em).getTime()), 0);
      return Math.round(oldest / 1000);
    }
    return Math.round(distribuidosRecentes.reduce((a, l) =>
      a + (new Date(l.distribuido_em!).getTime() - new Date(l.criado_em).getTime()), 0
    ) / distribuidosRecentes.length / 1000);
  }, [fila]);

  function fmtDur(s: number) {
    const m = Math.floor(s / 60), r = s % 60;
    return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
  }

  async function patchCfg(partial: Partial<Config>) {
    const next = { ...cfg, ...partial };
    setCfg(next); setSaving(true);
    const { error } = await supabase.from("distribuicao_config").update({
      automatico_on: next.automatico_on, modo: next.modo,
      criterios: next.criterios, sla_segundos: next.sla_segundos,
    }).eq("id", "default");
    if (!error && next.automatico_on) {
      const { data: n } = await supabase.rpc("distribuir_fila_pendente");
      if (typeof n === "number" && n > 0) await load();
    }
    setSaving(false);
    if (error) setErr(error.message);
  }

  async function setDestinoPerda(leadId: string, decisao: "Remalho" | "Descarte" | "Reativar") {
    setBusyId(leadId); setErr(null);
    const obs = (obsDecisao[leadId] || "").trim() || null;
    const { error } = await supabase.rpc("avaliar_perda_lead", {
      p_lead_id: leadId, p_decisao: decisao, p_observacao: obs,
    });
    setBusyId(null);
    if (error) { setErr(error.message); return; }
    setObsDecisao((s) => { const n = { ...s }; delete n[leadId]; return n; });
    setDevolvidos((d) => d.filter((x) => x.id !== leadId));
    // Reativar manda o lead de volta à fila — recarrega para refletir a fila atualizada.
    if (decisao === "Reativar") await load();
  }

  function fmtAtras(iso: string | null): string {
    if (!iso) return "—";
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `há ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  }

  function escolherAlvoParaLead(l: LeadFila): { alvo: string; criterio: string } {
    if (!franquias.length) return { alvo: "—", criterio: "Sem franquia cadastrada" };
    const onlyOnline = !!cfg.criterios.disp;
    const vendsAtivos = onlyOnline ? vendedores.filter((v) => v.online) : vendedores;

    let candidatas = franquias;
    // Quando "Vendedor disponível" estiver ativo, só franquias que possuem ao menos
    // 1 vendedor online entram na disputa.
    if (onlyOnline) {
      const comOnline = new Set(vendsAtivos.map((v) => v.empresa_id));
      candidatas = candidatas.filter((c) => comOnline.has(c.id));
      if (!candidatas.length) {
        return { alvo: "— (sem vendedor online)", criterio: "Aguardando vendedor online" };
      }
    }

    if (cfg.criterios.regiao && (l.uf || l.cidade)) {
      const local = candidatas.filter((f) =>
        (l.uf && f.uf && f.uf.toUpperCase() === l.uf.toUpperCase()) ||
        (l.cidade && f.cidade && f.cidade.toLowerCase() === l.cidade.toLowerCase())
      );
      if (local.length) candidatas = local;
    }
    let franq = candidatas[0];
    let criterio = "Região";
    if (cfg.modo === "fila") {
      const count = new Map<string, number>();
      for (const c of candidatas) count.set(c.id, 0);
      for (const x of fila) if (x.id !== l.id) count.set(x.id, (count.get(x.id) || 0) + 1);
      franq = [...candidatas].sort((a, b) => (count.get(a.id) || 0) - (count.get(b.id) || 0))[0];
      criterio = "Rodízio (fila equilibrada)";
    } else if (cfg.modo === "performance") {
      const comVend = candidatas.filter((c) => vendsAtivos.some((v) => v.empresa_id === c.id));
      if (comVend.length) franq = comVend[0];
      criterio = onlyOnline ? "Performance (vendedores online)" : "Performance (vendedores disponíveis)";
    }
    const vends = vendsAtivos.filter((v) => v.empresa_id === franq.id);
    const vendNome = vends.length ? vends[Math.floor(Math.random() * vends.length)].nome : "—";
    return { alvo: `${franq.nome}${vendNome !== "—" ? ` · ${vendNome}` : ""}`, criterio };
  }

  function simular() {
    if (!fila.length) { setSimResult([]); return; }
    setSimResult(fila.slice(0, 20).map((l) => {
      const r = escolherAlvoParaLead(l);
      return { leadId: l.id, nome: l.nome || `Lead ${l.id.slice(0, 6)}`, alvo: r.alvo, criterio: r.criterio };
    }));
  }

  return (
    <AppShell title="Distribuição">
      <ProtoIcons />
      <div className="page-head">
        <div><h1>Distribuição de leads</h1><div className="sub">Defina a regra que controla como cada lead chega até franquias e vendedores</div></div>
        <div className="tools"><button className="btn btn-ghost" onClick={() => navigate({ to: "/comando/leads" })}><svg width="14" height="14"><use href="#i-chevron-left"></use></svg> Voltar à Central</button></div>
      </div>

      {err && <div className="audit-note" style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 12 }}>{err}</div>}
      {loading && <div className="muted small" style={{ marginBottom: 12 }}>Carregando…</div>}

      {/* TRIAGEM */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <h3><svg width="16" height="16"><use href="#i-flag"></use></svg> Leads devolvidos pelos vendedores — triagem</h3>
          <span className="small muted">{devolvidos.length} aguardando · defina remalho ou descarte</span>
        </div>
        <div className="card-b">
          {devolvidos.length === 0 && <div className="muted small" style={{ padding: 6 }}>Nenhum lead devolvido aguardando triagem.</div>}
          {devolvidos.map((l) => (
            <div key={l.id} className="row" style={{ alignItems: "center", gap: 14, padding: "10px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 170 }}>
                <strong style={{ color: "var(--slate)", fontSize: 13 }}>{l.nome || "—"}</strong>
                {l.veiculo && <div className="small muted">{l.veiculo}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <span className="chip chip-slate" style={{ fontSize: 10 }}>{l.motivo_perda || "Sem motivo"} {l.submotivo_perda ? `· ${l.submotivo_perda}` : ""}</span>
                {l.observacao_perda && <div className="small muted" style={{ marginTop: 4 }}><svg width="11" height="11"><use href="#i-message"></use></svg> {l.observacao_perda}</div>}
              </div>
              <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {l.destino_perda_sugerido && (
                  <span className="small muted">sugerido: <strong style={{ color: l.destino_perda_sugerido === "Descarte" ? "var(--alert)" : "var(--ok)" }}>{l.destino_perda_sugerido}</strong></span>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setDestinoPerda(l.id, "Remalho")}><svg width="12" height="12"><use href="#i-refresh"></use></svg> Remalho</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDestinoPerda(l.id, "Descarte")}><svg width="12" height="12"><use href="#i-trash"></use></svg> Descarte</button>
              </div>
            </div>
          ))}
          <div className="audit-note" style={{ marginTop: 12 }}><svg width="16" height="16"><use href="#i-info"></use></svg> O motivo pode virar <strong style={{ margin: "0 4px" }}>regra de distribuição</strong>.</div>
        </div>
      </div>

      {/* MASTER */}
      <div className="card card-yellow" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <h3><svg width="16" height="16"><use href="#i-share"></use></svg> Distribuição automática <span className="chip chip-yellow" style={{ marginLeft: 6 }}>recomendado</span></h3>
          <div className={`switch ${cfg.automatico_on ? "on" : ""}`} onClick={() => patchCfg({ automatico_on: !cfg.automatico_on })} style={{ cursor: "pointer" }}>
            <span className="track"></span><span className="label">{cfg.automatico_on ? "Ligada" : "Desligada"}</span>
          </div>
        </div>
        <div className="card-b">
          {!cfg.automatico_on ? (
            <div className="audit-note" style={{ background: "var(--alert-soft)", color: "var(--alert)" }}>
              <svg width="16" height="16"><use href="#i-alert-triangle"></use></svg> <strong style={{ marginRight: 4 }}>Modo manual ativo.</strong>
              Agora há <strong style={{ margin: "0 4px" }}>{fila.length}</strong> lead{fila.length === 1 ? "" : "s"} na fila.
            </div>
          ) : (
            <div className="audit-note" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
              <svg width="16" height="16"><use href="#i-check-circle"></use></svg> <strong style={{ marginRight: 4 }}>Distribuição automática ligada.</strong>
              Novos leads são distribuídos seguindo a regra abaixo.
            </div>
          )}
          <div className="row" style={{ gap: 22, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div><div className="small muted" style={{ fontWeight: 600 }}>MANUAL (hoje)</div><div style={{ fontSize: 24, fontWeight: 700, color: "var(--alert)" }}>{fmtDur(tempoMedioManual)}</div><div className="small muted">tempo médio até distribuir</div></div>
            <div style={{ color: "var(--muted)" }}><svg width="22" height="22"><use href="#i-arrow-right"></use></svg></div>
            <div><div className="small muted" style={{ fontWeight: 600 }}>AUTOMÁTICO</div><div style={{ fontSize: 24, fontWeight: 700, color: "var(--ok)" }}>~8s</div><div className="small muted">distribuição instantânea por regra</div></div>
            <div className="spacer"></div>
            {!cfg.automatico_on && (
              <button className="btn btn-yellow" onClick={() => patchCfg({ automatico_on: true })} disabled={saving}>
                <svg width="14" height="14"><use href="#i-spark"></use></svg> Ativar automático
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODO */}
      <div className="card" style={{ marginBottom: 18, opacity: cfg.automatico_on ? 1 : 0.6 }}>
        <div className="card-h"><h3><svg width="16" height="16"><use href="#i-settings"></use></svg> Regra do automático</h3><span className="small muted">ativa quando o automático estiver ligado</span></div>
        <div className="card-b"><div className="mode-grid">
          {([
            { k: "regiao", t: "Automático por região", d: "Distribui pela cidade/UF do lead até a franquia mais próxima.", ic: "i-pin" },
            { k: "performance", t: "Automático por performance", d: "Prioriza vendedores com melhor conversão e menor tempo de contato.", ic: "i-gauge" },
            { k: "fila", t: "Fila equilibrada", d: "Rodízio justo: equilibra o volume de leads entre os vendedores.", ic: "i-refresh" },
          ] as const).map((m) => (
            <div key={m.k} className={`mode-card ${cfg.modo === m.k ? "on" : ""}`} onClick={() => patchCfg({ modo: m.k })} style={{ cursor: "pointer" }}>
              <div className="mc-ic"><svg width="18" height="18"><use href={`#${m.ic}`}></use></svg></div>
              <div><div className="mc-t">{m.t}</div><div className="mc-d">{m.d}</div></div>
              <div className="mc-radio"></div>
            </div>
          ))}
        </div></div>
      </div>

      {/* CRITÉRIOS + SLA */}
      <div className="detail-grid">
        <div className="card">
          <div className="card-h"><h3><svg width="16" height="16"><use href="#i-settings"></use></svg> Critérios da regra</h3><span className="small muted">aplicados na automação</span></div>
          <div className="card-b"><div className="crit-list">
            {([
              ["regiao", "Cidade / UF", "Casar a região do lead com a da franquia"],
              ["franquia", "Franquia responsável", "Respeitar carteira/território de cada franquia"],
              ["disp", "Vendedor disponível", "Só enviar para quem está em horário/online"],
              ["conv", "Conversão", "Favorecer quem converte mais"],
              ["volume", "Volume já recebido", "Equilibrar quantos leads cada um já recebeu"],
              ["horario", "Horário de atendimento", "Respeitar janela de trabalho da unidade"],
            ] as [keyof Criterios, string, string][]).map(([k, t, d]) => (
              <div key={k} className="crit-row">
                <div className="cr-body"><div className="cr-t">{t}</div><div className="cr-d">{d}</div></div>
                <div className={`switch ${cfg.criterios[k] ? "on" : ""}`} onClick={() => patchCfg({ criterios: { ...cfg.criterios, [k]: !cfg.criterios[k] } })} style={{ cursor: "pointer" }}>
                  <span className="track"></span>
                </div>
              </div>
            ))}
          </div></div>
        </div>

        <div className="card card-yellow">
          <div className="card-h"><h3><svg width="16" height="16"><use href="#i-clock"></use></svg> SLA de reação</h3></div>
          <div className="card-b">
            <p className="small muted" style={{ marginTop: 0 }}>Quando um lead é distribuído, o vendedor tem um tempo para aceitar ou iniciar o atendimento. Se não reagir, o lead volta para a fila.</p>
            <div className="field-group"><label>Tempo para reagir</label>
              <select className="input" value={String(cfg.sla_segundos)} onChange={(e) => patchCfg({ sla_segundos: parseInt(e.target.value, 10) })}>
                <option value="180">3 minutos</option>
                <option value="300">5 minutos</option>
                <option value="600">10 minutos</option>
              </select>
            </div>
            <div className="audit-note"><svg width="16" height="16"><use href="#i-info"></use></svg> O contador aparece para o vendedor no card do lead, na coluna "Novo" do pipeline.</div>
          </div>
        </div>
      </div>

      {/* SIMULAÇÃO */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <h3><svg width="16" height="16"><use href="#i-gauge"></use></svg> Simulação de distribuição</h3>
          <div className="card-h-actions"><button className="btn btn-slate btn-sm" onClick={simular}><svg width="14" height="14"><use href="#i-spark"></use></svg> Simular com a fila atual ({fila.length})</button></div>
        </div>
        <div className="card-b">
          {simResult === null && <p className="muted small" style={{ margin: 0 }}>Rode a simulação para ver, antes de confirmar, para quem cada lead pendente iria com a regra acima.</p>}
          {simResult !== null && simResult.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nenhum lead na fila no momento.</p>}
          {simResult !== null && simResult.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {simResult.map((r) => (
                <div key={r.leadId} className="row" style={{ alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ minWidth: 160, fontWeight: 600 }}>{r.nome}</div>
                  <div style={{ color: "var(--muted)" }}><svg width="14" height="14"><use href="#i-arrow-right"></use></svg></div>
                  <div style={{ flex: 1, fontWeight: 600 }}>{r.alvo}</div>
                  <span className="chip chip-slate" style={{ fontSize: 10 }}>{r.criterio}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
