import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { PROPOSTA_TRANSMITIDA_STATUS } from "@/lib/lead-etapa";

export const Route = createFileRoute("/_authenticated/venda/emissao")({
  head: () => ({ meta: [{ title: "Emissão & histórico · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string } => ({
    selected: typeof s.selected === "string" ? s.selected : undefined,
  }),
  component: Page,
});

type Row = {
  id: string;
  numero: string | null;
  apolice_numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  criado_em: string;
  transmitida_em: string | null;
  cotacao_id: string | null;
  cotacoes: { segurado: { nome: string | null }[] | null } | null;
};

const fmtBRL = (n: number | null) =>
  n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

/** Consulta as propostas já transmitidas com sucesso exibidas nesta tela. */
export function fetchEmissaoRows() {
  return supabase
    .from("propostas")
    .select(
      "id,numero,apolice_numero,seguradora,premio,valor,criado_em,transmitida_em,cotacao_id," +
        "cotacoes(segurado:cotacao_segurado(nome))",
    )
    .eq("transmissao_status", PROPOSTA_TRANSMITIDA_STATUS)
    .order("transmitida_em", { ascending: false })
    .limit(200);
}

function Page() {
  const { selected } = Route.useSearch();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [q, setQ] = useState("");
  const [fSeguradora, setFSeguradora] = useState("");

  async function loadRows() {
    setLoading(true);
    const { data, error } = await fetchEmissaoRows();
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
        if (fSeguradora && r.seguradora !== fSeguradora) return false;
        if (q) {
          const t =
            `${r.numero ?? ""} ${r.apolice_numero ?? ""} ${r.cotacoes?.segurado?.[0]?.nome ?? ""}`.toLowerCase();
          if (!t.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, fSeguradora, q],
  );

  const totalValor = filtered.reduce((a, r) => a + (r.premio ?? r.valor ?? 0), 0);
  const ticketMedio = filtered.length ? totalValor / filtered.length : 0;

  function exportar() {
    const head = ["Nº", "Segurado", "Seguradora", "Prêmio", "Gerada em", "Transmitida"];
    const lines = filtered.map((r) =>
      [
        r.apolice_numero || r.numero || "",
        r.cotacoes?.segurado?.[0]?.nome ?? "",
        r.seguradora ?? "",
        fmtBRL(r.premio ?? r.valor),
        new Date(r.criado_em).toLocaleDateString("pt-BR"),
        r.transmitida_em ? new Date(r.transmitida_em).toLocaleString("pt-BR") : "",
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(","),
    );
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "emissao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Emissão & histórico">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Emissão & histórico</h1>
          <div className="sub">
            {filtered.length} proposta{filtered.length !== 1 ? "s" : ""} transmitida
            {filtered.length !== 1 ? "s" : ""} · valor total {fmtBRL(totalValor)} · ticket médio{" "}
            {fmtBRL(ticketMedio)}
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
        <input
          className="select-mini"
          placeholder="Buscar segurado, nº proposta/apólice…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button
          className="btn-link btn-sm"
          onClick={() => {
            setFSeguradora("");
            setQ("");
          }}
        >
          Limpar
        </button>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" data-tour="emissao-lista">
          <div
            className="card-b"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
            {rows.length === 0
              ? "Nenhuma proposta transmitida ainda. Assim que a seguradora confirmar o recebimento na Etapa 7, ela aparece aqui."
              : "Nenhuma proposta encontrada com os filtros atuais."}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div
          data-tour="emissao-lista"
          className="card"
          style={{ padding: 0, overflow: "hidden", overflowX: "auto" }}
        >
          <table className="table-pipe mtable" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Segurado</th>
                <th>Seguradora</th>
                <th style={{ textAlign: "right" }}>Prêmio</th>
                <th>Gerada em</th>
                <th>Transmitida</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  ref={(el) => {
                    rowRefs.current[r.id] = el;
                  }}
                  style={
                    selected === r.id
                      ? {
                          outline: "2px solid var(--brand, #2563eb)",
                          background: "rgba(37,99,235,.06)",
                        }
                      : undefined
                  }
                >
                  <td>
                    <strong>{r.apolice_numero || r.numero || "—"}</strong>
                  </td>
                  <td>{r.cotacoes?.segurado?.[0]?.nome || "—"}</td>
                  <td>{r.seguradora || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtBRL(r.premio ?? r.valor)}</td>
                  <td>{new Date(r.criado_em).toLocaleDateString("pt-BR")}</td>
                  <td>
                    {r.transmitida_em ? new Date(r.transmitida_em).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="clt-note" style={{ marginTop: 14 }}>
        <svg width={15} height={15}>
          <use href="#i-info" />
        </svg>
        <div>
          Por enquanto esta lista mostra todas as propostas já transmitidas com sucesso, sem separar
          "aguardando a seguradora" de "emitida" — essa divisão chega numa próxima iteração, quando
          o status de transmissão ganhar mais detalhe.
        </div>
      </div>
    </AppShell>
  );
}
