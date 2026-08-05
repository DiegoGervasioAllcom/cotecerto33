import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import {
  NegociacaoPropostaPanel,
  negociacaoChip,
} from "@/components/venda/negociacao-proposta-panel";

export const Route = createFileRoute("/_authenticated/venda/propostas")({
  head: () => ({ meta: [{ title: "Propostas · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string } => ({
    selected: typeof s.selected === "string" ? s.selected : undefined,
  }),
  component: Page,
});

type Row = {
  id: string;
  numero: string | null;
  status: string;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  criado_em: string;
  transmitida_em: string | null;
  cotacao_id: string | null;
  negociacao_status: string;
  prazo_resposta: string | null;
  cotacoes: { segurado: { nome: string | null }[] | null } | null;
};

const fmtBRL = (n: number | null) =>
  n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function statusChip(s: string) {
  if (s === "transmitida") return <span className="chip chip-ok">Transmitida</span>;
  if (s === "cancelada") return <span className="chip chip-alert">Cancelada</span>;
  return <span className="chip chip-yellow">Gerada</span>;
}

function prazoDias(prazo: string | null): number | null {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function Page() {
  const { selected } = Route.useSearch();
  const navigate = useNavigate({ from: "/venda/propostas" });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [fStatus, setFStatus] = useState("");
  const [fNegociacao, setFNegociacao] = useState("");
  const [fSeguradora, setFSeguradora] = useState("");
  const [fPrazo, setFPrazo] = useState("");

  async function loadRows() {
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id,numero,status,seguradora,premio,valor,criado_em,transmitida_em,cotacao_id," +
          "negociacao_status,prazo_resposta,cotacoes(segurado:cotacao_segurado(nome))",
      )
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  useEffect(() => {
    if (!selected || loading) return;
    const el = rowRefs.current[selected];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selected, loading, rows.length]);

  const seguradoras = useMemo(
    () => Array.from(new Set(rows.map((r) => r.seguradora).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (fStatus && r.status !== fStatus) return false;
        if (fNegociacao && r.negociacao_status !== fNegociacao) return false;
        if (fSeguradora && r.seguradora !== fSeguradora) return false;
        if (fPrazo) {
          const d = prazoDias(r.prazo_resposta);
          if (fPrazo === "hoje" && (d == null || d > 0)) return false;
          if (fPrazo === "3dias" && (d == null || d < 0 || d > 3)) return false;
          if (fPrazo === "vencidas" && (d == null || d >= 0)) return false;
        }
        return true;
      }),
    [rows, fStatus, fNegociacao, fSeguradora, fPrazo],
  );

  const totalValor = filtered.reduce((a, r) => a + (r.premio ?? r.valor ?? 0), 0);
  const ticketMedio = filtered.length ? totalValor / filtered.length : 0;
  const selectedRow = rows.find((r) => r.id === selected) ?? null;

  function exportar() {
    const head = [
      "Nº",
      "Segurado",
      "Seguradora",
      "Prêmio",
      "Status",
      "Negociação",
      "Gerada em",
      "Transmitida",
      "Prazo resposta",
    ];
    const lines = filtered.map((r) =>
      [
        r.numero ?? "",
        r.cotacoes?.segurado?.[0]?.nome ?? "",
        r.seguradora ?? "",
        fmtBRL(r.premio ?? r.valor),
        r.status,
        r.negociacao_status,
        new Date(r.criado_em).toLocaleDateString("pt-BR"),
        r.transmitida_em ? new Date(r.transmitida_em).toLocaleString("pt-BR") : "",
        r.prazo_resposta ? new Date(r.prazo_resposta).toLocaleDateString("pt-BR") : "",
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(","),
    );
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "propostas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Propostas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Propostas</h1>
          <div className="sub">
            {filtered.length} proposta{filtered.length !== 1 ? "s" : ""} · valor total{" "}
            {fmtBRL(totalValor)} · ticket médio {fmtBRL(ticketMedio)}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={exportar}>
          <svg width="14" height="14">
            <use href="#i-download"></use>
          </svg>{" "}
          Exportar
        </button>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <select
          className="select-mini"
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
        >
          <option value="">Status · todos</option>
          <option value="gerada">Gerada</option>
          <option value="transmitida">Transmitida</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select
          className="select-mini"
          value={fNegociacao}
          onChange={(e) => setFNegociacao(e.target.value)}
        >
          <option value="">Negociação · todas</option>
          <option value="aguardando">Aguardando</option>
          <option value="em_negociacao">Em negociação</option>
          <option value="aceita">Aceita</option>
          <option value="recusada">Recusada</option>
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
        <select className="select-mini" value={fPrazo} onChange={(e) => setFPrazo(e.target.value)}>
          <option value="">Prazo · todos</option>
          <option value="hoje">Vencendo hoje</option>
          <option value="3dias">Vence em 3 dias</option>
          <option value="vencidas">Vencidas</option>
        </select>
        <button
          className="btn-link btn-sm"
          onClick={() => {
            setFStatus("");
            setFNegociacao("");
            setFSeguradora("");
            setFPrazo("");
          }}
        >
          Limpar
        </button>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" data-tour="propostas-lista">
          <div
            className="card-b"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
            {rows.length === 0
              ? "Nenhuma proposta ainda. Selecione um prêmio em uma cotação para gerar a primeira."
              : "Nenhuma proposta encontrada com os filtros atuais."}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div data-tour="propostas-lista" style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Segurado</th>
                <th>Seguradora</th>
                <th>Prêmio</th>
                <th>Status</th>
                <th>Negociação</th>
                <th>Gerada em</th>
                <th>Transmitida</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  ref={(el) => {
                    rowRefs.current[r.id] = el;
                  }}
                  style={{
                    cursor: "pointer",
                    ...(selected === r.id
                      ? {
                          outline: "2px solid var(--brand, #2563eb)",
                          background: "rgba(37,99,235,.06)",
                        }
                      : {}),
                  }}
                  onClick={() => navigate({ search: (s) => ({ ...s, selected: r.id }) })}
                >
                  <td>
                    <strong>{r.numero || "—"}</strong>
                  </td>
                  <td>{r.cotacoes?.segurado?.[0]?.nome || "—"}</td>
                  <td>{r.seguradora || "—"}</td>
                  <td>{fmtBRL(r.premio ?? r.valor)}</td>
                  <td>{statusChip(r.status)}</td>
                  <td>{negociacaoChip(r.negociacao_status)}</td>
                  <td>{new Date(r.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td>
                    {r.transmitida_em ? new Date(r.transmitida_em).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ search: (s) => ({ ...s, selected: r.id }) });
                      }}
                    >
                      Negociar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRow && (
        <NegociacaoPropostaPanel
          proposta={{
            id: selectedRow.id,
            numero: selectedRow.numero,
            seguradora: selectedRow.seguradora,
            premio: selectedRow.premio,
            valor: selectedRow.valor,
            negociacao_status: selectedRow.negociacao_status,
            prazo_resposta: selectedRow.prazo_resposta,
            segurado: selectedRow.cotacoes?.segurado?.[0]?.nome ?? null,
          }}
          onChanged={() => void loadRows()}
        />
      )}
    </AppShell>
  );
}
