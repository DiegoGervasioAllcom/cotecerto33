// Pipeline de leads — Kanban/Tabela do funil automático (Pipeline V12, T9).
// A coluna não é mais arrastada manualmente: o estágio de cada lead é
// consequência do progresso real (`fetchPipelineLeads` / `leadEtapaBucket`,
// `@/lib/pipeline-data` e `@/lib/lead-etapa` — T8). Decisão já aprovada: sem
// drag-and-drop nesta tela a partir de agora.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { PipelineCard } from "@/components/venda/pipeline/pipeline-card";
import {
  ageDays,
  ETAPAS_ATIVAS,
  ETAPA_LABEL,
  money,
  pipelineHeaderResumo,
  pontoExato,
  veiculoResumo,
} from "@/components/venda/pipeline/pipeline-format";
import { useAuth } from "@/lib/auth";
import type { LeadEtapaBucket } from "@/lib/lead-etapa";
import {
  atenderAgoraRestanteMs,
  fetchAtenderAgoraLeads,
  type AtenderAgoraLead,
} from "@/lib/nav-badges";
import {
  fetchPipelineLeads,
  fetchRetornosPendentesPorLead,
  type PipelineLeadRow,
  type PipelineRetornoPendente,
} from "@/lib/pipeline-data";
import { resolveExistingLeadDestination } from "@/lib/pipeline-lead-navigation";

export const Route = createFileRoute("/_authenticated/venda/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline · CoteCerto" }] }),
  component: Page,
});

type EtapaFiltro = "todas" | LeadEtapaBucket;
type ParadoFiltro = "todos" | "3" | "7";
type StatusFiltro = "todos" | "ativos" | "perdidos";

function matchesParado(criadoEm: string, parado: ParadoFiltro): boolean {
  if (parado === "todos") return true;
  return ageDays(criadoEm) >= Number(parado);
}

function Page() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const uid = session?.user.id ?? null;

  const [leads, setLeads] = useState<PipelineLeadRow[]>([]);
  const [retornoPorLead, setRetornoPorLead] = useState<Map<string, PipelineRetornoPendente>>(
    new Map(),
  );
  const [atenderAgora, setAtenderAgora] = useState<AtenderAgoraLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const openingRef = useRef(false);
  const [view, setView] = useState<"kanban" | "tabela">("kanban");
  const [now, setNow] = useState(Date.now());

  const [fEtapa, setFEtapa] = useState<EtapaFiltro>("todas");
  const [fRamo, setFRamo] = useState<string>("todas");
  const [fOrigem, setFOrigem] = useState<string>("todas");
  const [fParado, setFParado] = useState<ParadoFiltro>("todos");
  // Status (ativos/perdidos) e Motivo de perda divergem do protótipo V12 de
  // propósito: lá, lead perdido sai do Pipeline por completo (Carteira de
  // Recuperação). Essa tela ainda não existe no nosso produto, então o
  // perdido continua visível aqui — só que via filtro, não como coluna fixa.
  const [fStatus, setFStatus] = useState<StatusFiltro>("todos");
  const [fMotivo, setFMotivo] = useState<string>("todos");

  function clearFilters() {
    setFEtapa("todas");
    setFRamo("todas");
    setFOrigem("todas");
    setFParado("todos");
    setFStatus("todos");
    setFMotivo("todos");
  }

  async function openLead(l: PipelineLeadRow) {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(l.id);
    try {
      setErr(null);
      const destination = await resolveExistingLeadDestination({
        leadId: l.id,
        status: l.status_pipeline,
        canAssume: true,
      });
      if (destination.kind === "wizard")
        navigate({
          to: "/venda/novo-lead",
          search: { id: destination.id, step: destination.step },
        });
      else if (destination.kind === "proposals")
        navigate({
          to: "/venda/em-negociacao",
          search: destination.selected ? { selected: destination.selected } : {},
        });
      else if (destination.kind === "acceptance")
        navigate({
          to: "/venda/em-finalizacao",
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

  async function load() {
    setLoading(true);
    setErr(null);
    const { leads: rows, error } = await fetchPipelineLeads();
    if (error) {
      setErr(error);
      setLeads([]);
      setLoading(false);
      return;
    }
    setLeads(rows);
    const ids = rows.map((r) => r.id);
    const [retornos, atender] = await Promise.all([
      fetchRetornosPendentesPorLead(ids).catch((e: unknown) => {
        setErr(e instanceof Error ? e.message : "Falha ao buscar retornos agendados.");
        return new Map<string, PipelineRetornoPendente>();
      }),
      uid
        ? fetchAtenderAgoraLeads(uid).catch((e: unknown) => {
            setErr(
              e instanceof Error ? e.message : "Falha ao buscar leads aguardando atendimento.",
            );
            return [] as AtenderAgoraLead[];
          })
        : Promise.resolve([] as AtenderAgoraLead[]),
    ]);
    setRetornoPorLead(retornos);
    setAtenderAgora(atender);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const atenderPorLead = useMemo(() => new Map(atenderAgora.map((l) => [l.id, l])), [atenderAgora]);
  const temTimerAtivo = useMemo(
    () => leads.some((l) => l.etapa === "novo" && atenderPorLead.has(l.id)),
    [leads, atenderPorLead],
  );
  useEffect(() => {
    if (!temTimerAtivo) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [temTimerAtivo]);

  const origens = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.origem) set.add(l.origem);
    return [...set].sort();
  }, [leads]);

  const ramos = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.cotacao?.ramo) set.add(l.cotacao.ramo);
    return [...set].sort();
  }, [leads]);

  const motivos = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) if (l.motivo_perda) set.add(l.motivo_perda);
    return [...set].sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (fEtapa !== "todas" && l.etapa !== fEtapa) return false;
      if (fRamo !== "todas" && (l.cotacao?.ramo ?? null) !== fRamo) return false;
      if (fOrigem !== "todas" && l.origem !== fOrigem) return false;
      if (!matchesParado(l.criado_em, fParado)) return false;
      if (fMotivo !== "todos" && l.motivo_perda !== fMotivo) return false;
      if (fStatus === "ativos" && l.etapa === "perdido") return false;
      if (fStatus === "perdidos" && l.etapa !== "perdido") return false;
      return true;
    });
  }, [leads, fEtapa, fRamo, fOrigem, fParado, fMotivo, fStatus]);

  const grouped = useMemo(() => {
    const m = new Map<LeadEtapaBucket, PipelineLeadRow[]>();
    for (const info of ETAPAS_ATIVAS) m.set(info.key, []);
    for (const l of filtered) {
      if (l.etapa === "perdido") continue;
      m.get(l.etapa)?.push(l);
    }
    return m;
  }, [filtered]);

  const perdidos = useMemo(() => filtered.filter((l) => l.etapa === "perdido"), [filtered]);

  const headerResumo = useMemo(() => pipelineHeaderResumo(leads, filtered), [leads, filtered]);

  function renderCard(l: PipelineLeadRow) {
    const atenderLead = l.etapa === "novo" ? atenderPorLead.get(l.id) : undefined;
    return (
      <PipelineCard
        key={l.id}
        lead={l}
        opening={opening !== null}
        retorno={retornoPorLead.get(l.id) ?? null}
        atenderRestanteMs={atenderLead ? atenderAgoraRestanteMs(atenderLead, now) : null}
        onOpen={() => void openLead(l)}
      />
    );
  }

  return (
    <AppShell title="Pipeline">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Pipeline de leads</h1>
          <div className="sub">{headerResumo}</div>
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
            Lead Manual
          </Link>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <select
          className="select-mini"
          value={fEtapa}
          onChange={(e) => setFEtapa(e.target.value as EtapaFiltro)}
        >
          <option value="todas">Estágio · todos</option>
          {ETAPAS_ATIVAS.map((info) => (
            <option key={info.key} value={info.key}>
              {info.label} ({leads.filter((l) => l.etapa === info.key).length})
            </option>
          ))}
        </select>
        <select className="select-mini" value={fRamo} onChange={(e) => setFRamo(e.target.value)}>
          <option value="todas">Tipo de seguro · todos</option>
          {ramos.map((r) => (
            <option key={r} value={r} style={{ textTransform: "capitalize" }}>
              {r}
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
        <select
          className="select-mini"
          value={fParado}
          onChange={(e) => setFParado(e.target.value as ParadoFiltro)}
        >
          <option value="todos">Parado há · qualquer tempo</option>
          <option value="3">3 dias ou mais</option>
          <option value="7">7 dias ou mais</option>
        </select>
        <select
          className="select-mini"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value as StatusFiltro)}
        >
          <option value="todos">Status · todos</option>
          <option value="ativos">Ativos</option>
          <option value="perdidos">Perdidos</option>
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
          {ETAPAS_ATIVAS.map((info) => {
            const list = grouped.get(info.key) ?? [];
            const totalVal = list.reduce((a, b) => a + Number(b.valor ?? 0), 0);
            return (
              <div key={info.key} className="kcol" data-stage={info.key}>
                <div className="kcol-h" style={{ borderTop: `3px solid ${info.cor}` }}>
                  <span className="name">{info.label}</span>
                  <span className="count">{list.length}</span>
                  <span className="value">{money(totalVal)}</span>
                </div>
                {list.length === 0 && <div className="small muted">Vazio</div>}
                {list.map((l) => renderCard(l))}
              </div>
            );
          })}
          {fStatus !== "ativos" && (
            <div className="kcol" data-stage="perdido">
              <div className="kcol-h" style={{ borderTop: "3px solid var(--alert, #dc2626)" }}>
                <span className="name">Perdido</span>
                <span className="count">{perdidos.length}</span>
                <span className="value">
                  {money(perdidos.reduce((a, b) => a + Number(b.valor ?? 0), 0))}
                </span>
              </div>
              {perdidos.length === 0 && <div className="small muted">Vazio</div>}
              {perdidos.map((l) => renderCard(l))}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Produto</th>
                <th>Veículo</th>
                <th>Estágio</th>
                <th>Dias</th>
                <th>Origem</th>
                <th>Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const veiculo = veiculoResumo(l.cotacao?.veiculo);
                const ponto = l.etapa === "perdido" ? l.motivo_perda : pontoExato(l.etapa);
                return (
                  <tr
                    key={l.id}
                    onClick={() => void openLead(l)}
                    aria-busy={opening === l.id}
                    aria-disabled={opening !== null}
                    style={{
                      cursor: opening ? "wait" : "pointer",
                      opacity: opening ? 0.6 : 1,
                    }}
                  >
                    <td>
                      <strong>{l.nome || "Sem nome"}</strong>
                    </td>
                    <td>
                      <span className="muted small" style={{ textTransform: "capitalize" }}>
                        {l.cotacao?.ramo ?? "—"}
                      </span>
                    </td>
                    <td>{veiculo ?? "—"}</td>
                    <td>
                      <span
                        className={`chip ${
                          l.etapa === "fechamento"
                            ? "chip-ok"
                            : l.etapa === "perdido"
                              ? "chip-alert"
                              : "chip-slate"
                        }`}
                      >
                        {ETAPA_LABEL[l.etapa]}
                      </span>
                      {ponto && (
                        <div className="small muted" style={{ marginTop: 2 }}>
                          {ponto}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`age ${ageDays(l.criado_em) >= 7 ? "warn" : ""}`}>
                        {ageDays(l.criado_em)}d
                      </span>
                    </td>
                    <td>
                      <span className="muted small">{l.origem || "—"}</span>
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
                  <td colSpan={8} className="muted small">
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
