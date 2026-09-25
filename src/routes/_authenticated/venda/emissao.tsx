import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { PropostasSection } from "@/components/venda/emissao/PropostasSection";
import { useEmissaoRows } from "@/components/venda/emissao/queries";
import { useAuth } from "@/lib/auth";
import {
  agruparPropostasPorSituacao,
  moedaOuTraco,
  propostaSituacaoInfo,
} from "@/lib/proposta-situacao";

export { fetchEmissaoRows } from "@/components/venda/emissao/queries";

export const Route = createFileRoute("/_authenticated/venda/emissao")({
  head: () => ({ meta: [{ title: "Emissão & histórico · CoteCerto" }] }),
  validateSearch: (s: Record<string, unknown>): { selected?: string } => ({
    selected: typeof s.selected === "string" ? s.selected : undefined,
  }),
  component: Page,
});

function Page() {
  const { selected } = Route.useSearch();
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const { data, isLoading, error } = useEmissaoRows(uid);
  const rows = useMemo(() => data ?? [], [data]);
  const loading = isLoading;
  const err = error ? error.message : null;
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [q, setQ] = useState("");
  const [fSeguradora, setFSeguradora] = useState("");

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
          const t = `${r.numero ?? ""} ${r.protocolo_seguradora ?? ""} ${r.apolice_numero ?? ""} ${
            r.cotacoes?.segurado?.[0]?.nome ?? ""
          }`.toLowerCase();
          if (!t.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, fSeguradora, q],
  );

  const { aguardando, concluidas } = useMemo(
    () => agruparPropostasPorSituacao(filtered),
    [filtered],
  );

  const totalValor = filtered.reduce((a, r) => a + (r.premio ?? r.valor ?? 0), 0);
  const ticketMedio = filtered.length ? totalValor / filtered.length : 0;

  function exportar() {
    const head = [
      "Segurado",
      "Cotação",
      "Seguradora",
      "Produto",
      "Proposta nº",
      "Protocolo",
      "Prêmio",
      "Parcelas",
      "Situação",
      "Transmitida em",
      "Apólice",
      "Emitida em",
    ];
    const lines = filtered.map((r) => {
      const st = propostaSituacaoInfo(r.transmissao_status);
      return [
        r.cotacoes?.segurado?.[0]?.nome ?? "",
        r.cotacoes?.numero ?? "",
        r.seguradora ?? "",
        r.cotacoes?.ramo ?? "",
        r.numero ?? "",
        r.protocolo_seguradora ?? "",
        moedaOuTraco(r.premio ?? r.valor),
        r.parcelas ? `${r.parcelas}x ${moedaOuTraco(r.valor_parcela)}` : "",
        st.label,
        r.transmitida_em ? new Date(r.transmitida_em).toLocaleString("pt-BR") : "",
        r.apolice_numero ?? "",
        r.emitida_em ? new Date(r.emitida_em).toLocaleString("pt-BR") : "",
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",");
    });
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
            {filtered.length} proposta{filtered.length !== 1 ? "s" : ""} · valor total{" "}
            {moedaOuTraco(totalValor)} · ticket médio {moedaOuTraco(ticketMedio)}
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
          placeholder="Buscar segurado, nº proposta/protocolo/apólice…"
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

      {!loading && (
        <div data-tour="emissao-lista">
          <PropostasSection
            titulo="Aguardando a seguradora"
            chipTexto="vistoria · pagamento · emissão"
            chipClass="chip-yellow"
            rows={aguardando}
            vazio={
              rows.length === 0
                ? "Nenhuma proposta por aqui ainda. Assim que a Etapa 7 transmitir uma proposta — com sucesso ou com pendência da seguradora —, ela aparece aqui."
                : filtered.length === 0
                  ? "Nenhuma proposta encontrada com os filtros atuais."
                  : "Nada aguardando a seguradora no momento."
            }
            tourId="emissao-aguardando"
            rowRefs={rowRefs}
            selected={selected}
          />

          <div style={{ marginTop: 16 }}>
            <PropostasSection
              titulo="Concluídas"
              chipTexto="apólice emitida"
              chipClass="chip-ok"
              rows={concluidas}
              vazio="Assim que uma apólice for emitida, ela desce para cá sozinha."
              tourId="emissao-concluidas"
              rowRefs={rowRefs}
              selected={selected}
            />
          </div>
        </div>
      )}

      <div className="clt-note" style={{ marginTop: 14 }}>
        <svg width={15} height={15}>
          <use href="#i-info" />
        </svg>
        <div>
          A lista de cima se atualiza sozinha: quando a seguradora emite a apólice, a proposta desce
          para as concluídas. Aqui o vendedor só acompanha — a ação já foi feita.
        </div>
      </div>
    </AppShell>
  );
}
