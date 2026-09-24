// Pipeline de leads — Kanban/Tabela do funil automático (Pipeline V12, T9).
// A coluna não é mais arrastada manualmente: o estágio de cada lead é
// consequência do progresso real (`leadEtapaBucket`, calculado no banco pela
// view `pipeline_leads_etapa`). Decisão já aprovada: sem drag-and-drop nesta
// tela a partir de agora.
//
// Pipeline V12, T7/T8: cada coluna do Kanban pagina server-side, uma etapa
// por vez, via `usePipelinePagination` (`@/lib/use-pipeline-pagination`) —
// não existe mais um único fetch trazendo todos os leads pra bucketizar em
// memória (isso era `fetchPipelineLeads`, removido de `@/lib/pipeline-data`
// na T6). Decisões tomadas nesta rodada:
// - Filtro "Estágio": decide QUAIS colunas são buscadas (não filtra mais uma
//   lista já carregada) — com um estágio específico selecionado, as outras
//   colunas somem da tela em vez de aparecerem vazias.
// - Filtro "Status" (ativos/perdidos): decide se a coluna "Perdido" entra na
//   lista de etapas pedida ao hook.
// - Header e contagens do Estágio usam `fetchPipelineResumoEtapas` (agregado
//   no banco) em vez de contar a lista carregada — os totais/valores por
//   coluna também vêm dali, não do tamanho de `col.leads` (que é só a
//   página carregada).
// - Contagens de Tipo de seguro/Origem/Motivo de perda usam os fetchers de
//   opções (`fetchPipeline*Disponiveis`), recalculadas a cada troca de
//   filtro — cada select reflete os OUTROS filtros já ativos (incluindo
//   Estágio/Status), nunca o próprio campo (T10b).
// - Tabela: mostra a união de todos os leads já carregados em todas as
//   colunas do Kanban (D6), sem paginação própria.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { PipelineCard } from "@/components/venda/pipeline/pipeline-card";
import {
  ageDays,
  ETAPAS_ATIVAS,
  ETAPA_DESCRICAO,
  ETAPA_LABEL,
  money,
  pipelineHeaderResumo,
  pontoExato,
  proximaAcao,
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
  fetchRetornosPendentesPorLead,
  type PipelineLeadRow,
  type PipelineRetornoPendente,
} from "@/lib/pipeline-data";
import {
  fetchPipelineMotivosDisponiveis,
  fetchPipelineOrigensDisponiveis,
  fetchPipelineRamosDisponiveis,
  fetchPipelineResumoEtapas,
  type PipelineOpcaoComContagem,
  type PipelineResumoEtapa,
} from "@/lib/pipeline-query";
import { resolveExistingLeadDestination } from "@/lib/pipeline-lead-navigation";
import { usePipelinePagination, type PipelineFiltrosComuns } from "@/lib/use-pipeline-pagination";

export const Route = createFileRoute("/_authenticated/venda/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline · CoteCerto" }] }),
  component: Page,
});

type EtapaFiltro = "todas" | LeadEtapaBucket;
type ParadoFiltro = "todos" | "3" | "7";
type StatusFiltro = "todos" | "ativos" | "perdidos";

/** Etapas ativas (`ETAPAS_ATIVAS`) pedidas ao hook + `perdido`, conforme Estágio/Status. */
function etapasParaBuscar(fEtapa: EtapaFiltro, fStatus: StatusFiltro): LeadEtapaBucket[] {
  if (fStatus === "perdidos") return ["perdido"];
  const etapasAtivas =
    fEtapa === "todas" ? ETAPAS_ATIVAS.map((info) => info.key) : [fEtapa as LeadEtapaBucket];
  return fStatus !== "ativos" ? [...etapasAtivas, "perdido"] : etapasAtivas;
}

function Page() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const uid = session?.user.id ?? null;

  const [atenderAgora, setAtenderAgora] = useState<AtenderAgoraLead[]>([]);
  const [retornoPorLead, setRetornoPorLead] = useState<Map<string, PipelineRetornoPendente>>(
    new Map(),
  );
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

  const filtrosComuns = useMemo<PipelineFiltrosComuns>(
    () => ({
      ramo: fRamo !== "todas" ? fRamo : undefined,
      origem: fOrigem !== "todas" ? fOrigem : undefined,
      paradoHaDias: fParado !== "todos" ? Number(fParado) : undefined,
      motivoPerda: fMotivo !== "todos" ? fMotivo : undefined,
    }),
    [fRamo, fOrigem, fParado, fMotivo],
  );

  const etapas = useMemo(() => etapasParaBuscar(fEtapa, fStatus), [fEtapa, fStatus]);

  const { colunas, carregarMais, sentinelaRef } = usePipelinePagination(etapas, filtrosComuns);

  // Header + contagem do filtro Estágio: agregado no banco (`etapa → total/
  // valor`), respeitando ramo/origem/parado/motivo — não depende de quantas
  // páginas cada coluna já carregou.
  const [resumoEtapas, setResumoEtapas] = useState<PipelineResumoEtapa[]>([]);
  useEffect(() => {
    let ativo = true;
    fetchPipelineResumoEtapas(filtrosComuns).then(({ resumo, error }) => {
      if (!ativo) return;
      if (error) {
        setErr(error);
        return;
      }
      setResumoEtapas(resumo);
    });
    return () => {
      ativo = false;
    };
  }, [filtrosComuns]);

  // Opções dos filtros Tipo de seguro/Origem/Motivo de perda, com contagem
  // condicionada aos OUTROS filtros já ativos (Pipeline V12, T10b): a
  // contagem de Origem, por exemplo, reflete ramo/parado/motivo/estágio já
  // selecionados — mas nunca o próprio campo (cada fetcher exclui o seu, ver
  // `PipelineFiltrosOpcoes` em `pipeline-query.ts`). Decisão: Estágio/Status
  // também entram (via `etapas`, a mesma lista pedida ao Kanban), pra
  // consistência com o que já está visível na tela. Recalcula a cada troca
  // de filtro — `ativo` (mesmo padrão do efeito do resumo acima) descarta
  // respostas de uma rodada anterior que cheguem atrasadas.
  const [ramoOpcoes, setRamoOpcoes] = useState<PipelineOpcaoComContagem[]>([]);
  const [origemOpcoes, setOrigemOpcoes] = useState<PipelineOpcaoComContagem[]>([]);
  const [motivoOpcoes, setMotivoOpcoes] = useState<PipelineOpcaoComContagem[]>([]);
  useEffect(() => {
    let ativo = true;
    fetchPipelineRamosDisponiveis({
      origem: filtrosComuns.origem,
      motivoPerda: filtrosComuns.motivoPerda,
      paradoHaDias: filtrosComuns.paradoHaDias,
      etapas,
    }).then(({ opcoes, error }) => {
      if (!ativo) return;
      if (error) setErr(error);
      else setRamoOpcoes(opcoes);
    });
    fetchPipelineOrigensDisponiveis({
      ramo: filtrosComuns.ramo,
      motivoPerda: filtrosComuns.motivoPerda,
      paradoHaDias: filtrosComuns.paradoHaDias,
      etapas,
    }).then(({ opcoes, error }) => {
      if (!ativo) return;
      if (error) setErr(error);
      else setOrigemOpcoes(opcoes);
    });
    fetchPipelineMotivosDisponiveis({
      ramo: filtrosComuns.ramo,
      origem: filtrosComuns.origem,
      paradoHaDias: filtrosComuns.paradoHaDias,
      etapas,
    }).then(({ opcoes, error }) => {
      if (!ativo) return;
      if (error) setErr(error);
      else setMotivoOpcoes(opcoes);
    });
    return () => {
      ativo = false;
    };
  }, [filtrosComuns, etapas]);

  useEffect(() => {
    if (!uid) {
      setAtenderAgora([]);
      return;
    }
    let ativo = true;
    fetchAtenderAgoraLeads(uid)
      .then((rows) => {
        if (ativo) setAtenderAgora(rows);
      })
      .catch((e: unknown) => {
        if (ativo) {
          setErr(e instanceof Error ? e.message : "Falha ao buscar leads aguardando atendimento.");
        }
      });
    return () => {
      ativo = false;
    };
  }, [uid]);

  const leadsCarregados = useMemo(
    () => Object.values(colunas).flatMap((col) => col?.leads ?? []),
    [colunas],
  );
  const leadIdsCarregados = useMemo(() => leadsCarregados.map((l) => l.lead_id), [leadsCarregados]);
  const leadIdsKey = leadIdsCarregados.join(",");

  useEffect(() => {
    if (leadIdsCarregados.length === 0) {
      setRetornoPorLead(new Map());
      return;
    }
    let ativo = true;
    fetchRetornosPendentesPorLead(leadIdsCarregados)
      .then((mapa) => {
        if (ativo) setRetornoPorLead(mapa);
      })
      .catch((e: unknown) => {
        if (ativo) setErr(e instanceof Error ? e.message : "Falha ao buscar retornos agendados.");
      });
    return () => {
      ativo = false;
    };
    // leadIdsKey já captura tudo que leadIdsCarregados tem de relevante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdsKey]);

  const atenderPorLead = useMemo(() => new Map(atenderAgora.map((l) => [l.id, l])), [atenderAgora]);
  const temTimerAtivo = atenderAgora.length > 0;
  useEffect(() => {
    if (!temTimerAtivo) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [temTimerAtivo]);

  async function openLead(l: PipelineLeadRow) {
    if (openingRef.current) return;
    openingRef.current = true;
    setOpening(l.lead_id);
    try {
      setErr(null);
      const destination = await resolveExistingLeadDestination({
        leadId: l.lead_id,
        status: l.status_pipeline ?? "",
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

  const headerResumo = useMemo(
    () => pipelineHeaderResumo(resumoEtapas, fEtapa, fStatus),
    [resumoEtapas, fEtapa, fStatus],
  );
  const ativosTotal = useMemo(
    () => resumoEtapas.filter((r) => r.etapa !== "perdido").reduce((acc, r) => acc + r.total, 0),
    [resumoEtapas],
  );

  const temFiltroAtivo =
    fEtapa !== "todas" ||
    fRamo !== "todas" ||
    fOrigem !== "todas" ||
    fParado !== "todos" ||
    fStatus !== "todos" ||
    fMotivo !== "todos";

  const algumaColunaCarregando = Object.values(colunas).some((c) => c?.loading);
  const algumaColunaComMais = Object.values(colunas).some((c) => c?.hasMore);
  const erroDeColuna = Object.values(colunas).find((c) => c?.error)?.error ?? null;

  function renderCard(l: PipelineLeadRow) {
    const atenderLead = l.etapa === "novo" ? atenderPorLead.get(l.lead_id) : undefined;
    return (
      <PipelineCard
        key={l.lead_id}
        lead={l}
        opening={opening !== null}
        retorno={retornoPorLead.get(l.lead_id) ?? null}
        atenderRestanteMs={atenderLead ? atenderAgoraRestanteMs(atenderLead, now) : null}
        onOpen={() => void openLead(l)}
      />
    );
  }

  function renderColunaFooter(etapa: LeadEtapaBucket) {
    const col = colunas[etapa];
    if (!col) return null;
    return (
      <>
        <div ref={sentinelaRef(etapa)} />
        {col.hasMore && (
          <button
            type="button"
            className="btn-link btn-sm"
            disabled={col.loading}
            onClick={() => carregarMais(etapa)}
          >
            {col.loading ? "Carregando…" : "Mostrar mais"}
          </button>
        )}
      </>
    );
  }

  return (
    <AppShell
      title="Pipeline"
      crumbs="Pipeline de leads · Acompanhe e mova os leads pelo funil da venda"
    >
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
              {info.label} ({resumoEtapas.find((r) => r.etapa === info.key)?.total ?? 0})
            </option>
          ))}
        </select>
        <select className="select-mini" value={fRamo} onChange={(e) => setFRamo(e.target.value)}>
          <option value="todas">Tipo de seguro · todos</option>
          {ramoOpcoes.map((o) => (
            <option key={o.valor} value={o.valor} style={{ textTransform: "capitalize" }}>
              {o.valor} ({o.total})
            </option>
          ))}
        </select>
        <select
          className="select-mini"
          value={fOrigem}
          onChange={(e) => setFOrigem(e.target.value)}
        >
          <option value="todas">Origem · todas</option>
          {origemOpcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.valor} ({o.total})
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
          {motivoOpcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.valor} ({o.total})
            </option>
          ))}
        </select>
        {temFiltroAtivo ? (
          <button className="btn-link btn-sm" onClick={clearFilters}>
            Limpar
          </button>
        ) : (
          <span className="small muted">
            {ativosTotal} leads em andamento · nenhum filtro ativo
          </span>
        )}
        {/* TODO Q3: filtro por seguradora depende de join com cotações/propostas (sem cobertura barata no schema atual) */}
      </div>

      {(err || erroDeColuna) && <div className="alert alert-err">{err ?? erroDeColuna}</div>}
      {algumaColunaCarregando && Object.keys(colunas).length === 0 && (
        <div className="muted">Carregando…</div>
      )}

      {view === "kanban" ? (
        <div className="kanban">
          {ETAPAS_ATIVAS.filter((info) => colunas[info.key]).map((info) => {
            const col = colunas[info.key]!;
            const resumoCol = resumoEtapas.find((r) => r.etapa === info.key);
            const total = resumoCol?.total ?? col.leads.length;
            const valorTotal = resumoCol?.valorTotal ?? 0;
            return (
              <div key={info.key} className="kcol" data-stage={info.key}>
                <div className="kcol-h" style={{ borderTop: `3px solid ${info.cor}` }}>
                  <span className="name">{info.label}</span>
                  <span className="count">{total}</span>
                  <span className="value">{money(valorTotal)}</span>
                </div>
                <div className="kcol-d">{ETAPA_DESCRICAO[info.key]}</div>
                {col.leads.length === 0 && !col.loading && (
                  <div className="kcol-vazio">nenhum lead aqui</div>
                )}
                {col.leads.map((l) => renderCard(l))}
                {renderColunaFooter(info.key)}
              </div>
            );
          })}
          {colunas.perdido && (
            <div className="kcol" data-stage="perdido">
              <div className="kcol-h" style={{ borderTop: "3px solid var(--alert, #dc2626)" }}>
                <span className="name">Perdido</span>
                <span className="count">
                  {resumoEtapas.find((r) => r.etapa === "perdido")?.total ??
                    colunas.perdido.leads.length}
                </span>
                <span className="value">
                  {money(resumoEtapas.find((r) => r.etapa === "perdido")?.valorTotal ?? 0)}
                </span>
              </div>
              <div className="kcol-d">{ETAPA_DESCRICAO.perdido}</div>
              {colunas.perdido.leads.length === 0 && !colunas.perdido.loading && (
                <div className="kcol-vazio">nenhum lead aqui</div>
              )}
              {colunas.perdido.leads.map((l) => renderCard(l))}
              {renderColunaFooter("perdido")}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {algumaColunaComMais && (
            <div className="muted small" style={{ padding: "8px 12px" }}>
              Mostrando os leads já carregados — role as colunas do Kanban pra ver mais.
            </div>
          )}
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Produto</th>
                <th>Veículo</th>
                <th>Estágio</th>
                <th>Dias</th>
                <th>Origem</th>
                <th>Próx. ação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leadsCarregados.map((l) => {
                const veiculo = veiculoResumo(l);
                const ponto = l.etapa === "perdido" ? l.motivo_perda : pontoExato(l);
                return (
                  <tr
                    key={l.lead_id}
                    onClick={() => void openLead(l)}
                    aria-busy={opening === l.lead_id}
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
                        {l.ramo ?? "—"}
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
                      <span className="muted small">{proximaAcao(l) ?? "—"}</span>
                    </td>
                    <td>
                      <svg width={14} height={14}>
                        <use href="#i-chevron-right" />
                      </svg>
                    </td>
                  </tr>
                );
              })}
              {leadsCarregados.length === 0 && (
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
