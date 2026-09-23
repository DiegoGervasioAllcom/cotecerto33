import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import {
  cotNum,
  diasParaExpirar,
  expiraChip,
  FAIXAS,
  melhorPreco,
  money,
  type Premio,
} from "@/components/venda/cotacoes/lista-helpers";
import { supabase } from "@/integrations/supabase/client";
import { NegociacaoPropostaPanel } from "@/components/venda/negociacao-proposta-panel";
import { EM_NEGOCIACAO_STATUSES } from "@/lib/lead-etapa";

export const Route = createFileRoute("/_authenticated/venda/em-negociacao")({
  head: () => ({ meta: [{ title: "Em negociação · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string } => ({
    selected: typeof s.selected === "string" ? s.selected : undefined,
  }),
  component: Page,
});

// Assim que um prêmio é selecionado no comparativo, o trigger
// _gerar_proposta_de_premio cria/atualiza uma `propostas` (status='gerada',
// transmissao_status ainda null) e vira a cotação para status='proposta' —
// ela continua aqui até a Etapa 7 transmitir com sucesso (ela não some desta
// lista sozinha; ver nota em em-finalizacao.tsx sobre esse gap). Por isso a
// negociação de versão/prazo/aceite da proposta (G7.2) mora aqui, e não em
// Emissão & histórico (que só lista propostas já transmitidas).
type PropostaLigada = {
  id: string;
  numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  negociacao_status: string;
  prazo_resposta: string | null;
  transmissao_status: string | null;
};

type Row = {
  id: string;
  numero: number;
  status: string;
  ramo: string;
  criado_em: string;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
  } | null;
  premios: Premio[];
  propostas: PropostaLigada[] | null;
};

function statusChip(s: string) {
  const label = s === "calculada" ? "Aberta" : s === "proposta" ? "Em ajuste" : s;
  const cls = s === "calculada" ? "chip-info" : s === "proposta" ? "chip-yellow" : "chip-outline";
  return <span className={`chip chip-status ${cls}`}>{label}</span>;
}

/** Consulta as cotações em negociação (status "calculada" ou "proposta") exibidas nesta tela. */
export function fetchEmNegociacaoRows() {
  return supabase
    .from("cotacoes")
    .select(
      "id,numero,status,ramo,criado_em,atualizado_em," +
        "segurado:cotacao_segurado(nome)," +
        "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)," +
        "premios:cotacao_premios(seguradora,premio)," +
        "propostas(id,numero,seguradora,premio,valor,negociacao_status,prazo_resposta,transmissao_status)",
    )
    .in("status", EM_NEGOCIACAO_STATUSES)
    .order("atualizado_em", { ascending: false })
    .limit(200);
}

function Page() {
  const nav = useNavigate();
  const navigate = useNavigate({ from: "/venda/em-negociacao" });
  const { selected } = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [fSeguradora, setFSeguradora] = useState("");
  const [fFaixa, setFFaixa] = useState("");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  async function loadRows() {
    const { data, error } = await fetchEmNegociacaoRows();
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  useEffect(() => {
    if (!selected || loading) return;
    const row = rows.find((r) => r.propostas?.some((p) => p.id === selected));
    if (!row) return;
    const el = rowRefs.current[row.id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected, loading, rows]);

  const seguradoras = useMemo(
    () =>
      Array.from(new Set(rows.flatMap((r) => r.premios?.map((p) => p.seguradora) ?? []))).sort(),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const t =
          `${cotNum(r.numero)} ${r.segurado?.nome ?? ""} ${r.veiculo?.modelo_nome ?? ""}`.toLowerCase();
        if (q && !t.includes(q.toLowerCase())) return false;
        if (fSeguradora && !r.premios?.some((p) => p.seguradora === fSeguradora)) return false;
        if (fFaixa) {
          const faixa = FAIXAS.find((f) => f.label === fFaixa);
          const preco = melhorPreco(r.premios);
          if (!faixa || preco == null || preco < faixa.min || preco > faixa.max) return false;
        }
        return true;
      }),
    [rows, q, fSeguradora, fFaixa],
  );

  const totVal = filtered.reduce((a, r) => a + (melhorPreco(r.premios) ?? 0), 0);

  function exportar() {
    const head = [
      "Nº cotação",
      "Segurado",
      "Veículo",
      "Seguradoras cotadas",
      "Melhor preço",
      "Status",
      "Criada",
      "Expira em",
    ];
    const lines = filtered.map((r) => {
      const best = r.premios?.length
        ? r.premios.reduce((m, p) => (Number(p.premio) < Number(m.premio) ? p : m))
        : null;
      const veic = r.veiculo
        ? `${r.veiculo.marca_nome ?? ""} ${r.veiculo.modelo_nome ?? ""} ${r.veiculo.ano_modelo ?? ""}`.trim()
        : "";
      return [
        cotNum(r.numero),
        r.segurado?.nome ?? "",
        veic,
        r.premios?.length ?? 0,
        best ? `${money(Number(best.premio))} (${best.seguradora})` : "",
        r.status === "calculada" ? "Aberta" : r.status === "proposta" ? "Em ajuste" : r.status,
        new Date(r.criado_em).toLocaleDateString("pt-BR"),
        (() => {
          const d = diasParaExpirar(r.criado_em);
          return d <= 0 ? "Hoje" : `${d}d`;
        })(),
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",");
    });
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "em-negociacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function abrirCalculo(id: string) {
    void nav({ to: "/venda/novo-lead", search: { id, step: 5 } });
  }

  function negociarProposta(propostaId: string) {
    void navigate({ search: (s) => ({ ...s, selected: propostaId }) });
  }

  const propostaSelecionada = selected
    ? (rows.flatMap((r) => r.propostas ?? []).find((p) => p.id === selected) ?? null)
    : null;
  const seguradoDaSelecionada = selected
    ? (rows.find((r) => r.propostas?.some((p) => p.id === selected))?.segurado?.nome ?? null)
    : null;

  return (
    <AppShell title="Em negociação">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Em negociação</h1>
          <div className="sub">
            {filtered.length} cotações já calculadas · ajustando coberturas e preço com o cliente ·
            valor total estimado <strong>{money(totVal)}/ano</strong>
          </div>
        </div>
        <div className="tools">
          <Link to="/venda/pipeline" className="btn btn-ghost">
            <svg width={14} height={14}>
              <use href="#i-kanban" />
            </svg>{" "}
            Ver no pipeline
          </Link>
          <button className="btn btn-ghost" onClick={exportar}>
            <svg width="14" height="14">
              <use href="#i-download"></use>
            </svg>{" "}
            Exportar
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <select className="select-mini">
          <option>Período · este mês</option>
          <option>Últimos 30 dias</option>
        </select>
        <select className="select-mini">
          <option>Status · todos</option>
          <option>Aberta</option>
          <option>Em ajuste</option>
        </select>
        <select
          className="select-mini"
          value={fSeguradora}
          onChange={(e) => setFSeguradora(e.target.value)}
        >
          <option value="">Seguradora · todas</option>
          {seguradoras.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="select-mini" value={fFaixa} onChange={(e) => setFFaixa(e.target.value)}>
          <option value="">Faixa · todas</option>
          {FAIXAS.map((f) => (
            <option key={f.label} value={f.label}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          className="select-mini"
          placeholder="Buscar segurado, placa, nº cotação…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button
          className="btn-link btn-sm"
          onClick={() => {
            setQ("");
            setFSeguradora("");
            setFFaixa("");
          }}
        >
          Limpar
        </button>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" data-tour="em-negociacao-lista">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Nenhuma cotação calculada aguardando ajuste.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div
          className="card"
          data-tour="em-negociacao-lista"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Nº COTAÇÃO</th>
                <th>SEGURADO</th>
                <th>VEÍCULO</th>
                <th style={{ textAlign: "center" }}>SEGURADORAS</th>
                <th style={{ textAlign: "right" }}>MELHOR PREÇO</th>
                <th>STATUS</th>
                <th>CRIADA</th>
                <th>EXPIRA EM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const best = r.premios?.length
                  ? r.premios.reduce((m, p) => (Number(p.premio) < Number(m.premio) ? p : m))
                  : null;
                const veic = r.veiculo
                  ? `${r.veiculo.marca_nome ?? ""} ${r.veiculo.modelo_nome ?? ""} ${r.veiculo.ano_modelo ?? ""}`.trim()
                  : "—";
                const propostaLigada = r.propostas?.find(
                  (p) => p.transmissao_status !== "transmitida",
                );
                return (
                  <tr
                    key={r.id}
                    ref={(el) => {
                      rowRefs.current[r.id] = el;
                    }}
                    onClick={() => abrirCalculo(r.id)}
                    style={{
                      cursor: "pointer",
                      ...(propostaLigada && selected === propostaLigada.id
                        ? {
                            outline: "2px solid var(--brand, #2563eb)",
                            background: "rgba(37,99,235,.06)",
                          }
                        : {}),
                    }}
                  >
                    <td
                      className="small muted"
                      style={{ fontFamily: "ui-monospace,Menlo,monospace" }}
                    >
                      #{cotNum(r.numero)}
                    </td>
                    <td>
                      <strong>{r.segurado?.nome || "—"}</strong>
                    </td>
                    <td>{veic}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="chip chip-outline">{r.premios?.length || 0} cotadas</span>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {best ? (
                        <>
                          <strong>{money(Number(best.premio))}</strong>
                          <br />
                          <span className="muted small">{best.seguradora}</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{statusChip(r.status)}</td>
                    <td className="small muted">
                      {new Date(r.criado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td>{expiraChip(r.criado_em)}</td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        {propostaLigada && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              negociarProposta(propostaLigada.id);
                            }}
                          >
                            Negociar
                          </button>
                        )}
                        <button
                          className="btn btn-yellow btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirCalculo(r.id);
                          }}
                        >
                          <svg width={13} height={13}>
                            <use href="#i-compare" />
                          </svg>{" "}
                          Abrir cálculo
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {propostaSelecionada && (
        <NegociacaoPropostaPanel
          proposta={{
            id: propostaSelecionada.id,
            numero: propostaSelecionada.numero,
            seguradora: propostaSelecionada.seguradora,
            premio: propostaSelecionada.premio,
            valor: propostaSelecionada.valor,
            negociacao_status: propostaSelecionada.negociacao_status,
            prazo_resposta: propostaSelecionada.prazo_resposta,
            segurado: seguradoDaSelecionada,
          }}
          onChanged={() => void loadRows()}
        />
      )}
    </AppShell>
  );
}
