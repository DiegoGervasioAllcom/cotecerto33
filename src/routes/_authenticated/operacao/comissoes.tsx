import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/operacao/comissoes")({
  head: () => ({ meta: [{ title: "Comissões · CoteCerto" }] }),
  component: Page,
});

type Proposta = {
  id: string;
  numero: string | null;
  apolice_numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  comissao_valor: number | null;
  comissao_pct: number | null;
  emitida_em: string | null;
  pago_em: string | null;
  cancelada_em: string | null;
  empresa_id: string | null;
  responsavel_id: string | null;
};
type Empresa = { id: string; nome: string };
type Profile = { id: string; nome: string };
type Lanc = {
  id: string;
  vendedor_id: string;
  empresa_id: string | null;
  proposta_id: string | null;
  tipo: "credito" | "debito";
  valor: number;
  descricao: string;
  referencia: string | null;
  seguradora: string | null;
  origem: string;
  criado_em: string;
};

type SaldoRow = {
  beneficiario_id: string | null;
  competencia: string | null;
  empresa_id: string | null;
  total_creditos: number | null;
  total_debitos: number | null;
  saldo: number | null;
  qtd_creditos: number | null;
  qtd_debitos: number | null;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function currentCompetencia() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentQuarter() {
  const d = new Date();
  return { ano: d.getFullYear(), trimestre: Math.floor(d.getMonth() / 3) + 1 };
}

const RESUMO_LABELS: Record<string, string> = {
  royalties: "Royalties (débito)",
  ajuste_clt: "Ajuste CLT",
  override_master: "Override master",
  override_supervisor: "Override supervisor",
  elite_franqueado: "Elite franqueado",
  elite_master: "Elite master",
};

/** Renderiza o resumo jsonb do fechamento (categorias com {qtd, soma}) como
 * tabela legível — em vez de JSON cru numa tela de dinheiro. */
function ResumoFechamento({ resumo }: { resumo: unknown }) {
  if (resumo == null || typeof resumo !== "object") return null;
  const obj = resumo as Record<string, unknown>;
  const linhas = Object.entries(RESUMO_LABELS)
    .filter(([k]) => obj[k] && typeof obj[k] === "object")
    .map(([k, label]) => {
      const cat = obj[k] as { qtd?: number; soma?: number };
      return { label, qtd: Number(cat.qtd ?? 0), soma: Number(cat.soma ?? 0) };
    });
  if (linhas.length === 0) return null;
  const total = linhas.reduce((s, l) => s + l.soma, 0);
  return (
    <div className="chip chip-ok" style={{ display: "block", padding: 12, marginBottom: 10 }}>
      <strong style={{ display: "block", marginBottom: 6 }}>Lançamentos gravados</strong>
      <table className="table" style={{ margin: 0, fontSize: 13 }}>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.label}>
              <td>{l.label}</td>
              <td style={{ textAlign: "right", color: "var(--muted)" }}>{l.qtd}x</td>
              <td style={{ textAlign: "right" }}>{fmtBRL(l.soma)}</td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>Total lançado</strong>
            </td>
            <td />
            <td style={{ textAlign: "right" }}>
              <strong>{fmtBRL(total)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Painel de fechamento de comissões (só Matriz) — dispara as RPCs do motor
 * de comissão (fatias 1-5) e exibe o resumo jsonb retornado + saldos por
 * competência da view v_comissao_por_competencia. */
function FechamentoComissoes() {
  const [competencia, setCompetencia] = useState(currentCompetencia());
  const q = currentQuarter();
  const [ano, setAno] = useState(q.ano);
  const [trimestre, setTrimestre] = useState(q.trimestre);
  const [resumoCompetencia, setResumoCompetencia] = useState<unknown>(null);
  const [resumoElite, setResumoElite] = useState<unknown>(null);
  const [errCompetencia, setErrCompetencia] = useState<string | null>(null);
  const [errElite, setErrElite] = useState<string | null>(null);
  const [loadingCompetencia, setLoadingCompetencia] = useState(false);
  const [loadingElite, setLoadingElite] = useState(false);

  const [saldos, setSaldos] = useState<SaldoRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { id: string; nome: string }>>({});
  const [filtroCompetencia, setFiltroCompetencia] = useState("");
  const [loadingSaldos, setLoadingSaldos] = useState(true);

  async function loadSaldos() {
    setLoadingSaldos(true);
    let query = supabase
      .from("v_comissao_por_competencia")
      .select(
        "beneficiario_id,competencia,empresa_id,total_creditos,total_debitos,saldo,qtd_creditos,qtd_debitos",
      )
      .order("competencia", { ascending: false })
      .limit(2000);
    if (filtroCompetencia) query = query.eq("competencia", filtroCompetencia);
    const [{ data }, profs] = await Promise.all([
      query,
      supabase.from("profiles").select("id,nome"),
    ]);
    setSaldos((data ?? []) as SaldoRow[]);
    const pm: Record<string, { id: string; nome: string }> = {};
    for (const p of (profs.data ?? []) as { id: string; nome: string }[]) pm[p.id] = p;
    setProfiles(pm);
    setLoadingSaldos(false);
  }

  useEffect(() => {
    loadSaldos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCompetencia]);

  async function fecharCompetencia() {
    if (
      !window.confirm(
        `Isto vai gravar os lançamentos (ajustes CLT, overrides e royalties) da competência ${competencia}. É definitivo e não pode ser refeito para a mesma competência. Continuar?`,
      )
    )
      return;
    setLoadingCompetencia(true);
    setErrCompetencia(null);
    setResumoCompetencia(null);
    const { data, error } = await supabase.rpc("fechar_comissao_competencia", {
      p_competencia: competencia,
    });
    if (error) {
      setErrCompetencia(
        error.message?.toLowerCase().includes("já fechada") || error.message?.includes("fechada")
          ? `A competência ${competencia} já foi fechada anteriormente.`
          : error.message,
      );
    } else {
      setResumoCompetencia(data);
      loadSaldos();
    }
    setLoadingCompetencia(false);
  }

  async function fecharElite() {
    if (
      !window.confirm(
        `Isto vai gravar o bônus da campanha Elite para o ${trimestre}º trimestre de ${ano}. É definitivo. Continuar?`,
      )
    )
      return;
    setLoadingElite(true);
    setErrElite(null);
    setResumoElite(null);
    const { data, error } = await supabase.rpc("fechar_campanha_elite", {
      p_ano: ano,
      p_trimestre: trimestre,
    });
    if (error) {
      setErrElite(
        error.message?.toLowerCase().includes("já fechada") || error.message?.includes("fechada")
          ? `A campanha Elite de ${trimestre}º/${ano} já foi fechada anteriormente.`
          : error.message,
      );
    } else {
      setResumoElite(data);
      loadSaldos();
    }
    setLoadingElite(false);
  }

  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const s of saldos) if (s.competencia) set.add(s.competencia);
    return Array.from(set).sort().reverse();
  }, [saldos]);

  return (
    <div style={{ marginTop: 18 }}>
      <div className="detail-grid">
        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="16" height="16">
                <use href="#i-lock" />
              </svg>{" "}
              Fechar competência
            </h3>
          </div>
          <div className="card-b">
            <p className="muted small" style={{ marginBottom: 10 }}>
              Grava os ajustes CLT, overrides de master/supervisor e royalties da competência no
              ledger. Ação definitiva e idempotente — uma competência não pode ser fechada duas
              vezes.
            </p>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <input
                type="month"
                className="select-mini"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
              />
              <button
                className="btn btn-primary"
                disabled={loadingCompetencia}
                onClick={fecharCompetencia}
              >
                {loadingCompetencia ? "Fechando…" : "Fechar competência"}
              </button>
            </div>
            {errCompetencia && (
              <div className="chip chip-alert" style={{ marginBottom: 10 }}>
                {errCompetencia}
              </div>
            )}
            {resumoCompetencia != null && <ResumoFechamento resumo={resumoCompetencia} />}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>
              <svg width="16" height="16">
                <use href="#i-award" />
              </svg>{" "}
              Fechar campanha Elite
            </h3>
          </div>
          <div className="card-b">
            <p className="muted small" style={{ marginBottom: 10 }}>
              Grava o bônus da campanha Elite trimestral (por produção) no ledger. Ação definitiva e
              idempotente.
            </p>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <input
                type="number"
                className="select-mini"
                style={{ width: 90 }}
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
              />
              <select
                className="select-mini"
                value={trimestre}
                onChange={(e) => setTrimestre(Number(e.target.value))}
              >
                <option value={1}>1º trimestre</option>
                <option value={2}>2º trimestre</option>
                <option value={3}>3º trimestre</option>
                <option value={4}>4º trimestre</option>
              </select>
              <button className="btn btn-primary" disabled={loadingElite} onClick={fecharElite}>
                {loadingElite ? "Fechando…" : "Fechar campanha Elite"}
              </button>
            </div>
            {errElite && (
              <div className="chip chip-alert" style={{ marginBottom: 10 }}>
                {errElite}
              </div>
            )}
            {resumoElite != null && <ResumoFechamento resumo={resumoElite} />}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-dollar" />
            </svg>{" "}
            Saldos por competência
          </h3>
          <div className="row" style={{ gap: 8 }}>
            <select
              className="select-mini"
              value={filtroCompetencia}
              onChange={(e) => setFiltroCompetencia(e.target.value)}
            >
              <option value="">Todas as competências</option>
              {competenciasDisponiveis.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card-b">
          {loadingSaldos && <div className="muted">Carregando…</div>}
          {!loadingSaldos && saldos.length === 0 && (
            <div className="muted">Nenhum saldo lançado ainda para o filtro selecionado.</div>
          )}
          {!loadingSaldos && saldos.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table-pipe mtable" style={{ minWidth: 800 }}>
                <thead>
                  <tr>
                    <th>Beneficiário</th>
                    <th>Competência</th>
                    <th style={{ textAlign: "right" }}>Créditos</th>
                    <th style={{ textAlign: "right" }}>Débitos</th>
                    <th style={{ textAlign: "right" }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {saldos.map((s) => (
                    <tr key={`${s.beneficiario_id}-${s.competencia}`}>
                      <td>
                        <small>
                          {(s.beneficiario_id && profiles[s.beneficiario_id]?.nome) ||
                            s.beneficiario_id?.slice(0, 8) ||
                            "—"}
                        </small>
                      </td>
                      <td>
                        <small className="muted">{s.competencia}</small>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <small>{fmtBRL(Number(s.total_creditos ?? 0))}</small>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <small>{fmtBRL(Number(s.total_debitos ?? 0))}</small>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{fmtBRL(Number(s.saldo ?? 0))}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function monthRange(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  const ini = new Date(d.getFullYear(), d.getMonth(), 1);
  const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const label = ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return {
    ini: ini.toISOString(),
    fim: fim.toISOString(),
    label: label.charAt(0).toUpperCase() + label.slice(1),
  };
}

function Page() {
  const { role } = useAuth();
  const isMatriz = role === "matriz";
  const [aba, setAba] = useState<"visao" | "fechamento">("visao");
  const [periodOffset, setPeriodOffset] = useState(0);
  const period = useMemo(() => monthRange(periodOffset), [periodOffset]);
  const [emitidas, setEmitidas] = useState<Proposta[]>([]);
  const [estornadas, setEstornadas] = useState<Proposta[]>([]);
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [empresas, setEmpresas] = useState<Record<string, Empresa>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [vendedorSel, setVendedorSel] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const cols =
        "id,numero,apolice_numero,seguradora,premio,valor,comissao_valor,comissao_pct,emitida_em,pago_em,cancelada_em,empresa_id,responsavel_id";
      const [emi, est, lan, emps, profs] = await Promise.all([
        supabase
          .from("propostas")
          .select(cols)
          .not("emitida_em", "is", null)
          .gte("emitida_em", period.ini)
          .lt("emitida_em", period.fim)
          .limit(5000),
        supabase
          .from("propostas")
          .select(cols)
          .not("cancelada_em", "is", null)
          .gte("cancelada_em", period.ini)
          .lt("cancelada_em", period.fim)
          .limit(5000),
        supabase
          .from("comissao_lancamentos")
          .select(
            "id,vendedor_id,empresa_id,proposta_id,tipo,valor,descricao,referencia,seguradora,origem,criado_em",
          )
          .order("criado_em", { ascending: false })
          .limit(5000),
        supabase.from("empresas").select("id,nome"),
        supabase.from("profiles").select("id,nome"),
      ]);
      if (emi.error) setErr(emi.error.message);
      setEmitidas((emi.data ?? []) as Proposta[]);
      setEstornadas((est.data ?? []) as Proposta[]);
      setLancs((lan.data ?? []) as Lanc[]);
      const em: Record<string, Empresa> = {};
      for (const e of (emps.data ?? []) as Empresa[]) em[e.id] = e;
      setEmpresas(em);
      const pm: Record<string, Profile> = {};
      for (const p of (profs.data ?? []) as Profile[]) pm[p.id] = p;
      setProfiles(pm);
      setLoading(false);
    })();
  }, [period.ini, period.fim]);

  // comissao_valor é gravado na transmissão com o % efetivo (empresa → modelo;
  // RPC transmitir_proposta / trigger da 048). Sem valor gravado, não inventamos
  // percentual aqui — o lançamento correto vive em comissao_lancamentos.
  const comOf = (p: Proposta) => Number(p.comissao_valor ?? 0);

  const kpis = useMemo(() => {
    const ativas = emitidas.filter((p) => !p.cancelada_em);
    const gerada = ativas.reduce((s, p) => s + comOf(p), 0);
    const paga = ativas.filter((p) => p.pago_em).reduce((s, p) => s + comOf(p), 0);
    const pendente = gerada - paga;
    const media = ativas.length ? gerada / ativas.length : 0;
    const estornada = estornadas.reduce((s, p) => s + comOf(p), 0);
    return {
      gerada,
      paga,
      pendente,
      media,
      estornada,
      qtd: ativas.length,
      qtdEst: estornadas.length,
      pctPaga: gerada > 0 ? (paga / gerada) * 100 : 0,
    };
  }, [emitidas, estornadas]);

  const porFranquia = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of emitidas) {
      if (p.cancelada_em) continue;
      const k = p.empresa_id || "";
      map.set(k, (map.get(k) || 0) + comOf(p));
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ nome: empresas[id]?.nome || "—", v }))
      .sort((a, b) => b.v - a.v);
  }, [emitidas, empresas]);

  const porSeguradora = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of emitidas) {
      if (p.cancelada_em) continue;
      const k = p.seguradora || "—";
      map.set(k, (map.get(k) || 0) + comOf(p));
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, v }))
      .sort((a, b) => b.v - a.v);
  }, [emitidas]);

  const topVendedores = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of emitidas) {
      if (p.cancelada_em) continue;
      const k = p.responsavel_id || "";
      map.set(k, (map.get(k) || 0) + comOf(p));
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ nome: profiles[id]?.nome || "—", v }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 7);
  }, [emitidas, profiles]);

  const maxFr = porFranquia[0]?.v || 1;
  const maxSeg = porSeguradora[0]?.v || 1;

  const periodOpts = useMemo(
    () => [0, -1, -2, -3].map((o) => ({ off: o, label: monthRange(o).label })),
    [],
  );

  function exportCsv() {
    const headers = [
      "Apólice",
      "Seguradora",
      "Vendedor",
      "Franquia",
      "Prêmio",
      "Comissão %",
      "Comissão",
      "Status",
      "Emitida em",
      "Pago em",
    ];
    const lines = [headers.join(";")];
    const all = [...emitidas, ...estornadas];
    for (const p of all) {
      lines.push(
        [
          p.apolice_numero || p.numero || "",
          p.seguradora || "",
          profiles[p.responsavel_id || ""]?.nome || "",
          empresas[p.empresa_id || ""]?.nome || "",
          fmtBRL(Number(p.premio ?? p.valor ?? 0)),
          p.comissao_pct != null ? p.comissao_pct + "%" : "—",
          fmtBRL(comOf(p)),
          p.cancelada_em ? "Estornada" : p.pago_em ? "Paga" : "Pendente",
          p.emitida_em ? new Date(p.emitida_em).toLocaleDateString("pt-BR") : "",
          p.pago_em ? new Date(p.pago_em).toLocaleDateString("pt-BR") : "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      );
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissoes-${period.label.replace(/\s/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Comissões">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Comissões</h1>
          <div className="sub">
            Comissão por franquia, vendedor e seguradora — fechamento de {period.label}
          </div>
        </div>
        <div className="tools">
          {isMatriz && (
            <div className="row" style={{ gap: 6, marginRight: 8 }}>
              <button
                className={"btn " + (aba === "visao" ? "btn-primary" : "btn-ghost")}
                onClick={() => setAba("visao")}
              >
                Visão geral
              </button>
              <button
                className={"btn " + (aba === "fechamento" ? "btn-primary" : "btn-ghost")}
                onClick={() => setAba("fechamento")}
              >
                Fechamento de comissões
              </button>
            </div>
          )}
          {aba === "visao" && (
            <>
              <select
                className="select-mini"
                value={periodOffset}
                onChange={(e) => setPeriodOffset(Number(e.target.value))}
              >
                {periodOpts.map((p) => (
                  <option key={p.off} value={p.off}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button className="btn btn-ghost" onClick={exportCsv}>
                <svg width="14" height="14">
                  <use href="#i-download" />
                </svg>{" "}
                Exportar fechamento
              </button>
            </>
          )}
        </div>
      </div>

      {isMatriz && aba === "fechamento" && <FechamentoComissoes />}

      {aba === "visao" && (
        <>
          <div className="audit-note" style={{ marginBottom: 16 }}>
            <svg width="16" height="16">
              <use href="#i-lock" />
            </svg>{" "}
            <strong style={{ marginRight: 4 }}>Trava de auditoria ativa.</strong> Toda alteração de
            comissão fica registrada com autor, data e valor anterior. Comissão gera conflito — aqui
            nada se altera sem rastro.
          </div>

          {err && <div style={{ color: "var(--alert)", marginBottom: 12 }}>{err}</div>}

          <div className="mkpi-grid">
            <div className="kpi">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-dollar" />
                </svg>
              </div>
              <div className="lbl">COMISSÃO GERADA</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.gerada)}
              </div>
              <div className="meta">{kpis.qtd} apólices</div>
            </div>
            <div className="kpi k-ok">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-check-circle" />
                </svg>
              </div>
              <div className="lbl">COMISSÃO PAGA</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.paga)}
              </div>
              <div className="meta">{kpis.pctPaga.toFixed(0)}% do total</div>
            </div>
            <div className="kpi k-alert">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-clock" />
                </svg>
              </div>
              <div className="lbl">COMISSÃO PENDENTE</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.pendente)}
              </div>
              <div className="meta">aguardando baixa</div>
            </div>
            <div className="kpi">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-percent" />
                </svg>
              </div>
              <div className="lbl">COMISSÃO MÉDIA</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.media)}
              </div>
              <div className="meta">por apólice</div>
            </div>
            <div className="kpi k-alert">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-refresh" />
                </svg>
              </div>
              <div className="lbl">ESTORNADA</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.estornada)}
              </div>
              <div className="meta">{kpis.qtdEst} cancelamentos</div>
            </div>
            <div className="kpi">
              <div className="ic-wrap">
                <svg width="18" height="18">
                  <use href="#i-tag" />
                </svg>
              </div>
              <div className="lbl">SALDO A PAGAR</div>
              <div className="val" style={{ fontSize: 22 }}>
                {fmtBRL(kpis.pendente)}
              </div>
              <div className="meta">no fechamento do mês</div>
            </div>
          </div>

          <div className="detail-grid">
            <div className="card">
              <div className="card-h">
                <h3>
                  <svg width="16" height="16">
                    <use href="#i-building" />
                  </svg>{" "}
                  Comissão por franquia
                </h3>
              </div>
              <div className="card-b">
                {loading && <div className="muted">Carregando…</div>}
                {!loading && porFranquia.length === 0 && (
                  <div className="muted">Nenhuma comissão no período.</div>
                )}
                <div className="funnel">
                  {porFranquia.map((f) => (
                    <div className="funnel-row" key={f.nome}>
                      <div className="fn-lbl" style={{ width: 150 }}>
                        {f.nome}
                      </div>
                      <div className="funnel-track" style={{ height: 22 }}>
                        <div
                          className="funnel-bar"
                          style={{
                            height: 22,
                            width: `${Math.max(8, (f.v / maxFr) * 100)}%`,
                            background: "var(--slate)",
                          }}
                        >
                          {fmtBRL(f.v)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-h">
                <h3>
                  <svg width="16" height="16">
                    <use href="#i-shield" />
                  </svg>{" "}
                  Por seguradora
                </h3>
              </div>
              <div className="card-b">
                {!loading && porSeguradora.length === 0 && (
                  <div className="muted">Nenhuma comissão no período.</div>
                )}
                <div className="funnel">
                  {porSeguradora.map((s) => (
                    <div className="funnel-row" key={s.nome}>
                      <div className="fn-lbl" style={{ width: 150 }}>
                        {s.nome}
                      </div>
                      <div className="funnel-track" style={{ height: 22 }}>
                        <div
                          className="funnel-bar"
                          style={{
                            height: 22,
                            width: `${Math.max(8, (s.v / maxSeg) * 100)}%`,
                            background: "var(--slate)",
                          }}
                        >
                          {fmtBRL(s.v)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="detail-grid" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="card-h">
                <h3>
                  <svg width="16" height="16">
                    <use href="#i-users" />
                  </svg>{" "}
                  Top vendedores por comissão
                </h3>
              </div>
              <div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {!loading && topVendedores.length === 0 && (
                  <div className="muted">Sem vendas no período.</div>
                )}
                {topVendedores.map((v, i) => (
                  <div key={v.nome + i} className="rank-row" style={{ cursor: "default" }}>
                    <div className={"rank-pos " + (i === 0 ? "top" : "")}>{i + 1}</div>
                    <div style={{ flex: 1 }} className="rk-name">
                      {v.nome}
                    </div>
                    <div className="rk-val">{fmtBRL(v.v)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-yellow">
              <div className="card-h">
                <h3>
                  <svg width="16" height="16">
                    <use href="#i-history" />
                  </svg>{" "}
                  Resumo do fechamento
                </h3>
              </div>
              <div className="card-b">
                <div className="actions-list">
                  <div className="action-row" style={{ cursor: "default" }}>
                    <div className="ic-square info">
                      <svg width="16" height="16">
                        <use href="#i-check-circle" />
                      </svg>
                    </div>
                    <div className="body">
                      <h4>
                        {kpis.qtd} apólices emitidas em {period.label}
                      </h4>
                      <p>Comissão gerada: {fmtBRL(kpis.gerada)}</p>
                    </div>
                  </div>
                  <div className="action-row" style={{ cursor: "default" }}>
                    <div className="ic-square warn">
                      <svg width="16" height="16">
                        <use href="#i-clock" />
                      </svg>
                    </div>
                    <div className="body">
                      <h4>{fmtBRL(kpis.pendente)} pendentes de baixa</h4>
                      <p>{(100 - kpis.pctPaga).toFixed(0)}% ainda não pagos</p>
                    </div>
                  </div>
                  <div className="action-row" style={{ cursor: "default" }}>
                    <div className="ic-square alert">
                      <svg width="16" height="16">
                        <use href="#i-refresh" />
                      </svg>
                    </div>
                    <div className="body">
                      <h4>{kpis.qtdEst} cancelamentos</h4>
                      <p>{fmtBRL(kpis.estornada)} em comissão revertida</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CONTA CORRENTE DE COMISSÕES */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-dollar" />
                </svg>{" "}
                Conta corrente de comissões
              </h3>
              <div className="row" style={{ gap: 8 }}>
                <select
                  className="select-mini"
                  value={vendedorSel}
                  onChange={(e) => setVendedorSel(e.target.value)}
                >
                  <option value="">Todos os vendedores</option>
                  {Array.from(new Set(lancs.map((l) => l.vendedor_id))).map((id) => (
                    <option key={id} value={id}>
                      {profiles[id]?.nome || id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="card-b">
              {(() => {
                const filtered = vendedorSel
                  ? lancs.filter((l) => l.vendedor_id === vendedorSel)
                  : lancs;
                const cred = filtered
                  .filter((l) => l.tipo === "credito")
                  .reduce((s, l) => s + Number(l.valor), 0);
                const deb = filtered
                  .filter((l) => l.tipo === "debito")
                  .reduce((s, l) => s + Number(l.valor), 0);
                const saldo = cred - deb;
                return (
                  <>
                    <div className="row" style={{ gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
                      <span className="chip chip-ok">
                        Créditos: <strong>{fmtBRL(cred)}</strong>
                      </span>
                      <span className="chip chip-alert">
                        Débitos: <strong>{fmtBRL(deb)}</strong>
                      </span>
                      <span className="chip">
                        Saldo: <strong>{fmtBRL(saldo)}</strong>
                      </span>
                      <span className="small muted">{filtered.length} lançamentos</span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="table-pipe mtable" style={{ minWidth: 900 }}>
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Vendedor</th>
                            <th>Tipo</th>
                            <th>Descrição</th>
                            <th>Referência</th>
                            <th>Seguradora</th>
                            <th style={{ textAlign: "right" }}>Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 && (
                            <tr>
                              <td colSpan={7} className="muted" style={{ padding: 16 }}>
                                Nenhum lançamento ainda.
                              </td>
                            </tr>
                          )}
                          {filtered.slice(0, 200).map((l) => (
                            <tr key={l.id}>
                              <td>
                                <small className="muted">
                                  {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                                </small>
                              </td>
                              <td>
                                <small>{profiles[l.vendedor_id]?.nome || "—"}</small>
                              </td>
                              <td>
                                <span
                                  className={
                                    "chip " + (l.tipo === "credito" ? "chip-ok" : "chip-alert")
                                  }
                                >
                                  {l.tipo === "credito" ? "Crédito" : "Débito"}
                                </span>
                              </td>
                              <td>
                                <small>{l.descricao}</small>
                              </td>
                              <td>
                                <small className="muted">{l.referencia || "—"}</small>
                              </td>
                              <td>
                                <small>{l.seguradora || "—"}</small>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <strong
                                  style={{
                                    color: l.tipo === "credito" ? "var(--ok)" : "var(--alert)",
                                  }}
                                >
                                  {l.tipo === "credito" ? "+" : "−"} {fmtBRL(Number(l.valor))}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
