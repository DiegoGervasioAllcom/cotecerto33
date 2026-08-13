import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useGroupScope } from "@/lib/group-scope";
import { veiculoLabel } from "@/lib/veiculo";
import { pipelineColumnKey, resolveExistingLeadDestination } from "@/lib/pipeline-lead-navigation";
import {
  carregarPerfisVisiveis,
  carregarRolesDosPerfis,
  vendedoresAtivosDaRede,
  type UserRole,
} from "@/lib/vendedores-ativos";

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
  dados: Record<string, unknown> | null;
};
type Empresa = { id: string; nome: string | null };
type Profile = Awaited<ReturnType<typeof carregarPerfisVisiveis>>[number];
type Seguradora = { id: string; nome: string };

const STAGE_KEY: Record<string, string> = {
  Novo: "novo",
  Qualificando: "contato",
  Cotando: "cotacao",
  "Proposta enviada": "proposta",
  "Em negociação": "negociacao",
  Fechado: "ganho",
};

function brl(v: number | null | undefined) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
function age(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "1d";
  return `${diff}d`;
}

function Page() {
  const navigate = useNavigate();
  const { isGroupView } = useGroupScope();
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [seguradoras, setSeguradoras] = useState<Seguradora[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const openingRef = useRef(false);

  const [fFranq, setFFranq] = useState("");
  const [fVend, setFVend] = useState("");
  const [fOrigem, setFOrigem] = useState("");
  const [fSeg, setFSeg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: st }, { data: lds, error }, { data: emps }, { data: segs }, profs] =
          await Promise.all([
            supabase.from("pipeline_stages").select("*").order("ordem"),
            supabase
              .from("leads")
              .select(
                "id,nome,contato,status_pipeline,valor,origem,empresa_id,responsavel_id,criado_em,dados",
              )
              .neq("status_pipeline", "perdido")
              .or("arquivado.is.null,arquivado.eq.false")
              .order("atualizado_em", { ascending: false })
              .limit(1000),
            supabase.from("empresas").select("id,nome").order("nome"),
            supabase.from("seguradoras").select("id,nome").eq("ativo", true).order("ordem"),
            carregarPerfisVisiveis(),
          ]);
        if (error) setErr(error.message);
        setStages((st ?? []) as Stage[]);
        setLeads((lds ?? []) as Lead[]);
        const em: Record<string, Empresa> = {};
        for (const e of (emps ?? []) as Empresa[]) em[e.id] = e;
        setEmpresas(em);
        const pm: Record<string, Profile> = {};
        for (const p of profs) pm[p.id] = p;
        setProfiles(pm);
        const loadedRoles = await carregarRolesDosPerfis(Object.keys(pm));
        setUserRoles(loadedRoles);
        const vendedores = vendedoresAtivosDaRede(Object.values(pm), loadedRoles);
        setFVend((current) =>
          current && !vendedores.some((vendedor) => vendedor.id === current) ? "" : current,
        );
        setSeguradoras(((segs ?? []) as Seguradora[]).filter((s) => s.nome));
      } catch (error) {
        setErr(error instanceof Error ? error.message : "Falha ao carregar o pipeline.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filterOptions = useMemo(() => {
    const fr = Object.values(empresas)
      .filter((e) => e.nome)
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
    const vd = vendedoresAtivosDaRede(Object.values(profiles), userRoles).sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || ""),
    );
    const og = new Set<string>();
    for (const l of leads) {
      if (l.origem) og.add(l.origem);
    }
    return {
      franquias: fr,
      vendedores: vd,
      origens: Array.from(og).sort(),
      seguradoras,
    };
  }, [leads, empresas, profiles, seguradoras, userRoles]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (fFranq) {
        if ((l.empresa_id || "") !== fFranq) return false;
      }
      if (fVend) {
        if ((l.responsavel_id || "") !== fVend) return false;
      }
      if (fOrigem && (l.origem || "") !== fOrigem) return false;
      if (fSeg) {
        const segs = (l.dados?.seguradoras_sel as string[] | undefined) ?? [];
        if (!segs.includes(fSeg)) return false;
      }
      return true;
    });
  }, [leads, fFranq, fVend, fOrigem, fSeg]);

  const grouped = useMemo(() => {
    const m: Record<string, Lead[]> = {};
    for (const s of stages) m[STAGE_KEY[s.nome] ?? s.nome.toLowerCase()] = [];
    for (const l of filtered) (m[pipelineColumnKey(l.status_pipeline)] ??= []).push(l);
    return m;
  }, [stages, filtered]);

  async function openLead(l: Lead) {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(l.id);
    try {
      setErr(null);
      const destination = await resolveExistingLeadDestination({
        leadId: l.id,
        status: l.status_pipeline,
        canAssume: false,
      });
      if (destination.kind === "wizard")
        navigate({
          to: "/venda/novo-lead",
          search: { id: destination.id, step: destination.step },
        });
      else if (destination.kind === "proposals")
        navigate({
          to: "/venda/propostas",
          search: destination.selected ? { selected: destination.selected } : {},
        });
      else if (destination.kind === "acceptance")
        navigate({
          to: "/venda/aceite",
          search: destination.selected ? { selected: destination.selected } : {},
        });
      else setErr(destination.message);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Falha ao abrir o lead.");
    } finally {
      openingRef.current = false;
      setOpening(null);
    }
  }

  return (
    <AppShell title="Pipeline geral">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Pipeline geral</h1>
          <div className="sub">
            {isGroupView
              ? "Os leads do seu grupo num só funil — acompanhe e cobre onde precisa"
              : "Todos os leads da operação num só funil — a Matriz vê tudo e age onde precisa"}
          </div>
        </div>
        {!isGroupView && (
          <div className="tools">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate({ to: "/comando/leads" })}
            >
              <svg width="14" height="14">
                <use href="#i-layers"></use>
              </svg>{" "}
              Central de Leads
            </button>
          </div>
        )}
      </div>

      <div className="filters-bar">
        <span className="label">FILTRAR</span>
        <select className="select-mini" value={fFranq} onChange={(e) => setFFranq(e.target.value)}>
          <option value="">Franquia</option>
          {filterOptions.franquias.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select className="select-mini" value={fVend} onChange={(e) => setFVend(e.target.value)}>
          <option value="">Vendedor</option>
          {filterOptions.vendedores.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
        <select
          className="select-mini"
          value={fOrigem}
          onChange={(e) => setFOrigem(e.target.value)}
        >
          <option value="">Origem</option>
          {filterOptions.origens.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <select className="select-mini" value={fSeg} onChange={(e) => setFSeg(e.target.value)}>
          <option value="">Seguradora</option>
          {filterOptions.seguradoras.map((x) => (
            <option key={x.id} value={x.nome}>
              {x.nome}
            </option>
          ))}
        </select>
        <div className="spacer"></div>
        <span className="small muted">
          {filtered.length} de {leads.length} leads
        </span>
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
              <div className="kcol-h">
                <span className="name">{s.nome}</span>
                <span className="count">{list.length}</span>
              </div>
              <div className="kcol-h" style={{ marginTop: -6, paddingTop: 0 }}>
                <span className="value">{brl(total)}</span>
              </div>
              {list.length === 0 && (
                <div className="small muted" style={{ padding: 8 }}>
                  Vazio
                </div>
              )}
              {list.map((l) => {
                const e = l.empresa_id ? empresas[l.empresa_id] : null;
                const v = l.responsavel_id ? profiles[l.responsavel_id] : null;
                const fr = e?.nome || "—";
                const car = veiculoLabel(l.dados);
                const segs: string[] = (l.dados?.seguradoras_sel as string[] | undefined) ?? [];
                return (
                  <div
                    key={l.id}
                    className="kcard"
                    role="button"
                    tabIndex={opening ? -1 : 0}
                    aria-disabled={opening !== null}
                    onClick={() => void openLead(l)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        void openLead(l);
                      }
                    }}
                    style={{
                      cursor: opening ? "wait" : "pointer",
                      opacity: opening ? 0.6 : 1,
                    }}
                  >
                    <div className="top">
                      <span className="name">{l.nome || "Sem nome"}</span>
                    </div>
                    {car !== "—" && <div className="car">{car}</div>}
                    {segs.length > 0 && (
                      <div className="kcard-sub" style={{ marginTop: 6 }}>
                        {segs.slice(0, 3).map((sg) => (
                          <span key={sg} className="chip chip-outline">
                            {sg}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="next">
                      <svg width="11" height="11">
                        <use href="#i-building"></use>
                      </svg>{" "}
                      {fr}
                      {v?.nome ? ` · ${v.nome}` : ""}
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
