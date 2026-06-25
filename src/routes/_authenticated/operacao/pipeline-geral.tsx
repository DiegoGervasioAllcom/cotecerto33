import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/pipeline-geral")({
  head: () => ({ meta: [{ title: "Pipeline geral · CoteCerto" }] }),
  component: Page,
});

type Stage = { id: string; ordem: number; nome: string; cor: string | null };
type Lead = {
  id: string;
  nome: string;
  contato: string | null;
  status_pipeline: string;
  valor: number | null;
  origem: string | null;
  empresa_id: string | null;
  responsavel_id: string | null;
  criado_em: string;
  dados: any;
};
type Empresa = { id: string; nome: string | null };
type Profile = { id: string; nome: string | null };

const STAGE_KEY: Record<string, string> = {
  Novo: "novo",
  Qualificando: "contato",
  Cotando: "cotacao",
  "Proposta enviada": "proposta",
  "Em negociação": "negociacao",
  Fechado: "ganho",
};

function brl(v: number | null | undefined) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function age(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "1d";
  return `${diff}d`;
}

function Page() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const [fFranq, setFFranq] = useState("");
  const [fVend, setFVend] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [fSeg, setFSeg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: st }, { data: lds, error }, { data: emps }, { data: profs }] = await Promise.all([
          supabase.from("pipeline_stages").select("*").order("ordem"),
          supabase
            .from("leads")
            .select("id,nome,contato,status_pipeline,valor,origem,empresa_id,responsavel_id,criado_em,dados")
            .neq("status_pipeline", "perdido")
            .order("atualizado_em", { ascending: false })
            .limit(1000),
          supabase.from("empresas").select("id,nome"),
          supabase.from("profiles").select("id,nome"),
        ]);
        if (error) setErr(error.message);
        setStages((st ?? []) as Stage[]);
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
    })();
  }, []);

  const filterOptions = useMemo(() => {
    const fr = new Set<string>();
    const vd = new Set<string>();
    const og = new Set<string>();
    const sg = new Set<string>();
    for (const l of leads) {
      const e = l.empresa_id ? empresas[l.empresa_id] : null;
      if (e) fr.add(e.nome || "—");
      const v = l.responsavel_id ? profiles[l.responsavel_id] : null;
      if (v?.nome) vd.add(v.nome);
      if (l.origem) og.add(l.origem);
      const segs = (l.dados?.seguradoras_sel as string[] | undefined) ?? [];
      for (const s of segs) if (s) sg.add(s);
    }
    return {
      franquias: Array.from(fr).sort(),
      vendedores: Array.from(vd).sort(),
      origens: Array.from(og).sort(),
      seguradoras: Array.from(sg).sort(),
    };
  }, [leads, empresas, profiles]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (fFranq) {
        const e = l.empresa_id ? empresas[l.empresa_id] : null;
        const nf = e?.nome || "";
        if (nf !== fFranq) return false;
      }
      if (fVend) {
        const v = l.responsavel_id ? profiles[l.responsavel_id] : null;
        if ((v?.nome || "") !== fVend) return false;
      }
      if (fOrigem && (l.origem || "") !== fOrigem) return false;
      if (fSeg) {
        const segs = (l.dados?.seguradoras_sel as string[] | undefined) ?? [];
        if (!segs.includes(fSeg)) return false;
      }
      return true;
    });
  }, [leads, empresas, profiles, fFranq, fVend, fOrigem, fSeg]);

  const grouped = useMemo(() => {
    const m: Record<string, Lead[]> = {};
    for (const s of stages) m[STAGE_KEY[s.nome] ?? s.nome.toLowerCase()] = [];
    for (const l of filtered) (m[l.status_pipeline] ??= []).push(l);
    return m;
  }, [stages, filtered]);

  async function openLead(l: Lead) {
    setOpening(l.id);
    try {
      const st = l.status_pipeline;
      if (st === "novo" || st === "contato" || st === "cotacao") {
        const { data: cot } = await supabase
          .from("cotacoes")
          .select("id,step_atual")
          .eq("lead_id", l.id)
          .order("atualizado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cot?.id) {
          navigate({ to: "/venda/novo-lead", search: { id: cot.id, step: Math.max(0, Number(cot.step_atual ?? 0)) } });
        } else {
          navigate({ to: "/venda/novo-lead", search: {} });
        }
        return;
      }
      if (st === "proposta" || st === "negociacao" || st === "ganho") {
        const { data: prop } = await supabase
          .from("propostas")
          .select("id")
          .eq("lead_id", l.id)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        const target = st === "ganho" ? "/venda/aceite" : "/venda/propostas";
        navigate({ to: target, search: prop?.id ? { selected: prop.id } : {} });
      }
    } finally {
      setOpening(null);
    }
  }

  return (
    <AppShell title="Pipeline geral">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Pipeline geral</h1>
          <div className="sub">Todos os leads da operação num só funil — a Matriz vê tudo e age onde precisa</div>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTRAR</span>
        <select className="select-mini" value={fFranq} onChange={(e) => setFFranq(e.target.value)}>
          <option value="">Franquia</option>
          {filterOptions.franquias.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select className="select-mini" value={fVend} onChange={(e) => setFVend(e.target.value)}>
          <option value="">Vendedor</option>
          {filterOptions.vendedores.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select className="select-mini" value={fOrigem} onChange={(e) => setFOrigem(e.target.value)}>
          <option value="">Origem</option>
          {filterOptions.origens.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select className="select-mini" value={fSeg} onChange={(e) => setFSeg(e.target.value)}>
          <option value="">Seguradora</option>
          {filterOptions.seguradoras.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <div className="spacer"></div>
        <span className="small muted">{filtered.length} de {leads.length} leads</span>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      <div className="kanban">
        {stages.map((s) => {
          const key = STAGE_KEY[s.nome] ?? s.nome.toLowerCase();
          const list = grouped[key] ?? [];
          const total = list.reduce((a, l) => a + Number(l.valor || 0), 0);
          return (
            <div className="kcol" key={s.id}>
              <div className="kcol-h"><span className="name">{s.nome}</span><span className="count">{list.length}</span></div>
              <div className="kcol-h" style={{ marginTop: -6, paddingTop: 0 }}><span className="value">{brl(total)}</span></div>
              {list.length === 0 && <div className="small muted" style={{ padding: 8 }}>Vazio</div>}
              {list.map((l) => {
                const e = l.empresa_id ? empresas[l.empresa_id] : null;
                const v = l.responsavel_id ? profiles[l.responsavel_id] : null;
                const fr = e?.nome || "—";
                const car = [l.dados?.veiculo_marca, l.dados?.veiculo_modelo, l.dados?.veiculo_ano].filter(Boolean).join(" ") || (l.dados?.veiculo as string | undefined) || "";
                const segs: string[] = (l.dados?.seguradoras_sel as string[] | undefined) ?? [];
                return (
                  <div
                    key={l.id}
                    className="kcard"
                    role="button"
                    tabIndex={0}
                    onClick={() => openLead(l)}
                    onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openLead(l); } }}
                    style={{ cursor: opening === l.id ? "wait" : "pointer", opacity: opening === l.id ? 0.6 : 1 }}
                  >
                    <div className="top"><span className="name">{l.nome || "Sem nome"}</span></div>
                    {car && <div className="car">{car}</div>}
                    {segs.length > 0 && (
                      <div className="kcard-sub" style={{ marginTop: 6 }}>
                        {segs.slice(0, 3).map((sg) => <span key={sg} className="chip chip-outline">{sg}</span>)}
                      </div>
                    )}
                    <div className="next">
                      <svg width="11" height="11"><use href="#i-building"></use></svg> {fr}{v?.nome ? ` · ${v.nome}` : ""}
                    </div>
                    <div className="footer">
                      <span className="val">{brl(l.valor)}</span>
                      <span className="age">{age(l.criado_em)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
