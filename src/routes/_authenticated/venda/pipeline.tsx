import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

export const Route = createFileRoute("/_authenticated/venda/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline · CoteCerto" }] }),
  component: Page,
});

type Stage = { id: string; ordem: number; nome: string; cor: string | null };
type Lead = {
  id: string;
  nome: string;
  contato: string | null;
  status_pipeline: string;
  valor: number | null;
  criado_em: string;
  origem: string | null;
  motivo_perda: string | null;
  bloqueado: boolean | null;
  em_avaliacao_matriz: boolean | null;
};

const STAGE_KEY: Record<string, string> = {
  Novo: "novo",
  Qualificando: "contato",
  Cotando: "cotacao",
  "Proposta enviada": "proposta",
  "Em negociação": "negociacao",
  Fechado: "ganho",
};

const PERIOD_OPTIONS = [
  { value: "todos", label: "Período · todos" },
  { value: "mes_atual", label: "Mês atual" },
  { value: "mes_passado", label: "Mês passado" },
  { value: "90dias", label: "Últimos 90 dias" },
] as const;

function money(v: number | null) {
  return v
    ? Number(v).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      })
    : "—";
}

function ageDays(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function matchesPeriod(iso: string, period: string) {
  if (period === "todos") return true;
  const d = new Date(iso);
  const now = new Date();
  if (period === "90dias") {
    return now.getTime() - d.getTime() <= 90 * 24 * 60 * 60 * 1000;
  }
  if (period === "mes_atual") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (period === "mes_passado") {
    const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
  }
  return true;
}

function Page() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "tabela">("kanban");

  const [fPeriod, setFPeriod] = useState<string>("todos");
  const [fOrigem, setFOrigem] = useState<string>("todas");
  const [fEtapa, setFEtapa] = useState<string>("todas");
  const [fMotivo, setFMotivo] = useState<string>("todos");

  function clearFilters() {
    setFPeriod("todos");
    setFOrigem("todas");
    setFEtapa("todas");
    setFMotivo("todos");
  }

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
          navigate({
            to: "/venda/novo-lead",
            search: { id: cot.id, step: Math.max(0, Number(cot.step_atual ?? 0)) },
          });
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
        return;
      }
      navigate({ to: "/venda/novo-lead", search: {} });
    } finally {
      setOpening(null);
    }
  }

  async function load() {
    setLoading(true);
    const [{ data: st }, { data: lds, error }] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("ordem"),
      supabase
        .from("leads")
        .select(
          "id,nome,contato,status_pipeline,valor,criado_em,origem,motivo_perda,bloqueado,em_avaliacao_matriz",
        )
        .order("atualizado_em", { ascending: false })
        .limit(500),
    ]);
    if (error) setErr(error.message);
    setStages((st ?? []) as Stage[]);
    setLeads((lds ?? []) as Lead[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const origens = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.origem) set.add(l.origem);
    return [...set].sort();
  }, [leads]);

  const motivos = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.motivo_perda) set.add(l.motivo_perda);
    return [...set].sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (!matchesPeriod(l.criado_em, fPeriod)) return false;
      if (fOrigem !== "todas" && l.origem !== fOrigem) return false;
      if (fEtapa !== "todas" && l.status_pipeline !== fEtapa) return false;
      if (fMotivo !== "todos" && l.motivo_perda !== fMotivo) return false;
      return true;
    });
  }, [leads, fPeriod, fOrigem, fEtapa, fMotivo]);

  const grouped = useMemo(() => {
    const m: Record<string, Lead[]> = {};
    for (const s of stages) m[STAGE_KEY[s.nome] ?? s.nome.toLowerCase()] = [];
    for (const l of filtered) {
      (m[l.status_pipeline] ??= []).push(l);
    }
    return m;
  }, [stages, filtered]);

  const headerStats = useMemo(() => {
    const ativos = leads.filter(
      (l) => l.status_pipeline !== "ganho" && l.status_pipeline !== "perdido",
    );
    const total = ativos.reduce((a, b) => a + Number(b.valor ?? 0), 0);
    return { count: ativos.length, total };
  }, [leads]);

  async function move(lead: Lead, novo: string) {
    setLeads((prev) => prev.map((x) => (x.id === lead.id ? { ...x, status_pipeline: novo } : x)));
    const { error } = await supabase
      .from("leads")
      .update({
        status_pipeline: novo as Database["public"]["Enums"]["lead_status"],
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", lead.id);
    if (error) {
      setErr(error.message);
      load();
    }
  }

  function renderCard(l: Lead, stageNome: string) {
    const isPerdido = stageNome === "Perdido" || l.status_pipeline === "perdido";
    return (
      <div
        key={l.id}
        className="kcard"
        draggable
        role="button"
        tabIndex={0}
        onDragStart={(e) => e.dataTransfer.setData("text/lead", l.id)}
        onClick={() => openLead(l)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openLead(l);
          }
        }}
        style={{
          opacity: opening === l.id ? 0.6 : isPerdido ? 0.85 : 1,
          cursor: opening === l.id ? "wait" : "grab",
        }}
      >
        {isPerdido && l.motivo_perda && (
          <div className="kcard-sub">
            <span
              className="chip chip-alert"
              style={{ fontSize: 9.5, padding: "2px 8px", width: "100%" }}
            >
              {l.motivo_perda}
            </span>
          </div>
        )}
        {l.em_avaliacao_matriz && (
          <div className="kcard-matrix" title="Aguardando avaliação da Matriz">
            <div className="kcard-matrix-info">
              <svg width={10} height={10}>
                <use href="#i-clock" />
              </svg>
              <span style={{ fontWeight: 700 }}>Aguardando Matriz</span>
            </div>
          </div>
        )}
        <div className="top">
          <span className="name">{l.nome || "Sem nome"}</span>
          {l.bloqueado && (
            <span title="Lead bloqueado">
              <svg width={13} height={13}>
                <use href="#i-lock" />
              </svg>
            </span>
          )}
        </div>
        <div className="small muted">{l.contato || "—"}</div>
        {l.origem && (
          <div style={{ marginTop: 4 }}>
            <span className="chip chip-slate" style={{ fontSize: 10 }}>
              {l.origem}
            </span>
          </div>
        )}
        <div className="footer">
          <span className="val">{money(l.valor)}</span>
          <span className={`age ${ageDays(l.criado_em) >= 7 ? "warn" : ""}`}>
            {ageDays(l.criado_em)}d
          </span>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="Pipeline">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Pipeline de leads</h1>
          <div className="sub">
            {headerStats.count} leads ativos · valor estimado {money(headerStats.total)}
          </div>
        </div>
        <div className="tools">
          <div className="toggle">
            <button className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")}>
              <svg width={13} height={13}>
                <use href="#i-kanban" />
              </svg>{" "}
              Kanban
            </button>
            <button className={view === "tabela" ? "on" : ""} onClick={() => setView("tabela")}>
              <svg width={13} height={13}>
                <use href="#i-list" />
              </svg>{" "}
              Tabela
            </button>
          </div>
          <Link to="/venda/novo-lead" className="btn btn-yellow">
            <svg width={14} height={14}>
              <use href="#i-plus" />
            </svg>{" "}
            Novo lead
          </Link>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <select
          className="select-mini"
          value={fPeriod}
          onChange={(e) => setFPeriod(e.target.value)}
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="select-mini"
          value={fOrigem}
          onChange={(e) => setFOrigem(e.target.value)}
        >
          <option value="todas">Origem · todas</option>
          {origens.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className="select-mini" value={fEtapa} onChange={(e) => setFEtapa(e.target.value)}>
          <option value="todas">Etapa · todas</option>
          {stages.map((s) => (
            <option key={s.id} value={STAGE_KEY[s.nome] ?? s.nome.toLowerCase()}>
              {s.nome}
            </option>
          ))}
        </select>
        <select
          className="select-mini"
          value={fMotivo}
          onChange={(e) => setFMotivo(e.target.value)}
        >
          <option value="todos">Motivo de perda · todos</option>
          {motivos.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button className="btn-link btn-sm" onClick={clearFilters}>
          Limpar
        </button>
        {/* TODO Q3: filtro por seguradora depende de join com cotações/propostas (sem cobertura barata no schema atual) */}
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {view === "kanban" ? (
        <div className="kanban">
          {stages.map((s) => {
            const key = STAGE_KEY[s.nome] ?? s.nome.toLowerCase();
            const list = grouped[key] ?? [];
            const totalVal = list.reduce((a, b) => a + Number(b.valor ?? 0), 0);
            return (
              <div
                key={s.id}
                className="kcol"
                data-stage={s.nome}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("text/lead");
                  const lead = leads.find((l) => l.id === id);
                  if (lead && lead.status_pipeline !== key) move(lead, key);
                }}
              >
                <div className="kcol-h" style={{ borderTop: `3px solid ${s.cor || "#5C6F80"}` }}>
                  <span className="name">{s.nome}</span>
                  <span className="count">{list.length}</span>
                  <span className="value">{money(totalVal)}</span>
                </div>
                {list.length === 0 && <div className="small muted">Vazio</div>}
                {list.map((l) => renderCard(l, s.nome))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contato</th>
                <th>Origem</th>
                <th>Etapa</th>
                <th>Idade</th>
                <th>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const stage = stages.find(
                  (s) => (STAGE_KEY[s.nome] ?? s.nome.toLowerCase()) === l.status_pipeline,
                );
                return (
                  <tr
                    key={l.id}
                    onClick={() => openLead(l)}
                    style={{
                      cursor: opening === l.id ? "wait" : "pointer",
                      opacity: opening === l.id ? 0.6 : 1,
                    }}
                  >
                    <td>
                      <strong>{l.nome || "Sem nome"}</strong>
                    </td>
                    <td>{l.contato || "—"}</td>
                    <td>
                      <span className="muted small">{l.origem || "—"}</span>
                    </td>
                    <td>
                      <span className="chip chip-slate">{stage?.nome ?? l.status_pipeline}</span>
                    </td>
                    <td>
                      <span className={`age ${ageDays(l.criado_em) >= 7 ? "warn" : ""}`}>
                        {ageDays(l.criado_em)}d
                      </span>
                    </td>
                    <td>
                      <strong>{money(l.valor)}</strong>
                    </td>
                    <td>
                      <svg width={14} height={14}>
                        <use href="#i-chevron-right" />
                      </svg>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted small">
                    Nenhum lead encontrado com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
