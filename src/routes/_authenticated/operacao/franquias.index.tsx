import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import { useRequirePerfilInterno } from "@/lib/require-role";

export const Route = createFileRoute("/_authenticated/operacao/franquias/")({
  head: () => ({ meta: [{ title: "Franquias · CoteCerto" }] }),
  component: Page,
});

type Row = {
  empresa_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  status: string;
  perc_comissao_efetiva: number | null;
  leads_mes: number;
  em_aberto: number;
  perdidos_mes: number;
  vendas_mes: number;
  faturamento_mes: number;
  comissao_mes: number;
  meta_vendas: number | null;
  meta_faturamento: number | null;
  responsavel_nome: string | null;
};

type RpcRow = Database["public"]["Functions"]["listar_franquias_paginada"]["Returns"][number];

// Exportados para o teste unitário do contrato de paginação desta rota.
export const FRANQUIAS_PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 200;

// eslint-disable-next-line react-refresh/only-export-components
export function normalizarPaginaFranquias(data: RpcRow[] | null): {
  rows: Row[];
  total: number;
} {
  return {
    rows: (data ?? []).map(({ total_count: _totalCount, ...row }) => ({
      ...row,
      leads_mes: Number(row.leads_mes) || 0,
      em_aberto: Number(row.em_aberto) || 0,
      perdidos_mes: Number(row.perdidos_mes) || 0,
      vendas_mes: Number(row.vendas_mes) || 0,
      faturamento_mes: Number(row.faturamento_mes) || 0,
      comissao_mes: Number(row.comissao_mes) || 0,
      meta_vendas: row.meta_vendas == null ? null : Number(row.meta_vendas),
      meta_faturamento: row.meta_faturamento == null ? null : Number(row.meta_faturamento),
      perc_comissao_efetiva:
        row.perc_comissao_efetiva == null ? null : Number(row.perc_comissao_efetiva),
    })),
    total: Number(data?.[0]?.total_count) || 0,
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function paginaAnteriorSeVazia(page: number, quantidade: number): number | null {
  return page > 1 && quantidade === 0 ? page - 1 : null;
}

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function statusChip(vendas: number, meta: number | null) {
  if (!meta || meta <= 0) return <span className="chip chip-slate">Sem meta</span>;
  const pct = vendas / meta;
  if (pct >= 1) return <span className="chip chip-ok">Acima da meta</span>;
  if (pct >= 0.8) return <span className="chip chip-info">No ritmo</span>;
  if (pct >= 0.5) return <span className="chip chip-yellow">Atenção</span>;
  return <span className="chip chip-alert">Abaixo da meta</span>;
}

function metaBar(vendas: number, meta: number | null) {
  if (!meta || meta <= 0) return <span className="small muted">—</span>;
  const pct = Math.min(100, Math.round((vendas / meta) * 100));
  const color = pct >= 100 ? "var(--ok)" : pct >= 80 ? "var(--yellow)" : "var(--alert)";
  return (
    <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
      <div className="mini-bar">
        <div className="mini-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="small muted" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
        {vendas}/{meta}
      </span>
    </div>
  );
}

const fmtBRLFull = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Page() {
  const denied = useRequirePerfilInterno();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const exportRun = useRef(0);

  useEffect(
    () => () => {
      exportRun.current += 1;
    },
    [],
  );

  useEffect(() => {
    if (denied) return;
    let active = true;
    setLoading(true);
    setErr(null);
    (async () => {
      const { data, error } = await supabase.rpc("listar_franquias_paginada", {
        p_limite: FRANQUIAS_PAGE_SIZE,
        p_offset: (page - 1) * FRANQUIAS_PAGE_SIZE,
      });
      if (!active) return;
      if (error) {
        setRows([]);
        setTotal(0);
        setErr(error.message);
      } else {
        const pagina = normalizarPaginaFranquias(data);
        const previousPage = paginaAnteriorSeVazia(page, pagina.rows.length);
        if (previousPage !== null) {
          setRows([]);
          setPage(previousPage);
          return;
        }
        setRows(pagina.rows);
        setTotal(pagina.total);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [denied, page]);

  if (denied) return denied;

  async function exportar() {
    if (exporting) return;
    const run = exportRun.current + 1;
    exportRun.current = run;
    setExporting(true);
    setExportErr(null);

    const allRows: Row[] = [];
    let offset = 0;
    let expectedTotal: number | null = null;

    while (expectedTotal === null || offset < expectedTotal) {
      const { data, error } = await supabase.rpc("listar_franquias_paginada", {
        p_limite: EXPORT_PAGE_SIZE,
        p_offset: offset,
      });
      if (exportRun.current !== run) return;
      if (error) {
        setExportErr(`Não foi possível exportar as franquias: ${error.message}`);
        setExporting(false);
        return;
      }

      const lote = normalizarPaginaFranquias(data);
      if (expectedTotal === null) expectedTotal = lote.total;
      allRows.push(...lote.rows);
      if (lote.rows.length < EXPORT_PAGE_SIZE) break;
      offset += lote.rows.length;
    }

    const head = [
      "Franquia",
      "Responsável",
      "Leads",
      "Em aberto",
      "Perdidos",
      "Vendas",
      "Faturamento",
      "Comissão",
      "Conv.",
      "Meta",
    ];
    const lines = allRows.map((r) => {
      const conv = r.leads_mes > 0 ? Math.round((r.vendas_mes / r.leads_mes) * 100) : 0;
      return [
        r.nome,
        r.responsavel_nome ?? "",
        r.leads_mes,
        r.em_aberto,
        r.perdidos_mes,
        r.vendas_mes,
        fmtBRLFull(Number(r.faturamento_mes) || 0),
        fmtBRLFull(Number(r.comissao_mes) || 0),
        `${conv}%`,
        r.meta_vendas ? `${r.vendas_mes}/${r.meta_vendas}` : "—",
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",");
    });
    const csv = [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "franquias.csv";
    a.click();
    URL.revokeObjectURL(url);
    if (exportRun.current === run) setExporting(false);
  }

  return (
    <AppShell title="Franquias">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Franquias</h1>
          <div className="sub">Esta visão substitui a planilha de comparativo de franquias</div>
        </div>
        <div className="tools">
          <button
            className="btn btn-ghost"
            onClick={() => void exportar()}
            disabled={loading || exporting || total === 0}
          >
            <svg width="14" height="14">
              <use href="#i-download"></use>
            </svg>{" "}
            {exporting ? "Exportando…" : "Exportar"}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {exportErr && <div className="alert alert-err">{exportErr}</div>}

      {loading && rows.length === 0 && (
        <div className="card" data-tour="franquias-lista">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Carregando franquias…
          </div>
        </div>
      )}

      {!loading && !err && rows.length === 0 && (
        <div className="card" data-tour="franquias-lista">
          <div
            className="card-b"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
            Nenhuma franquia aprovada ainda. Aprove cadastros pendentes em{" "}
            <strong>Acessos e permissões</strong>.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div data-tour="franquias-lista" style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Franquia</th>
                <th>Responsável</th>
                <th>Leads</th>
                <th>Em aberto</th>
                <th>Vendas</th>
                <th>Faturamento</th>
                <th>Comissão</th>
                <th>Conv.</th>
                <th>Meta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const conv = r.leads_mes > 0 ? Math.round((r.vendas_mes / r.leads_mes) * 100) : 0;
                return (
                  <tr
                    key={r.empresa_id}
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      navigate({
                        to: "/operacao/franquias/$id",
                        params: { id: r.empresa_id },
                      })
                    }
                  >
                    <td>
                      <div className="mini-cell">
                        <strong>{r.nome}</strong>
                        <small>{r.cidade ? `${r.cidade}${r.uf ? "/" + r.uf : ""}` : "—"}</small>
                      </div>
                    </td>
                    <td>{r.responsavel_nome ?? "—"}</td>
                    <td>{r.leads_mes}</td>
                    <td>
                      {r.em_aberto} <small className="muted">/ {r.perdidos_mes} perd.</small>
                    </td>
                    <td>
                      <strong>{r.vendas_mes}</strong>
                    </td>
                    <td>{fmtBRL(Number(r.faturamento_mes) || 0)}</td>
                    <td>{fmtBRL(Number(r.comissao_mes) || 0)}</td>
                    <td>{conv}%</td>
                    <td>{metaBar(r.vendas_mes, r.meta_vendas)}</td>
                    <td>{statusChip(r.vendas_mes, r.meta_vendas)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <div className="muted small">
            Mostrando {(page - 1) * FRANQUIAS_PAGE_SIZE + 1}–
            {(page - 1) * FRANQUIAS_PAGE_SIZE + rows.length} de {total}
          </div>
          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              ← Anterior
            </button>
            <span className="small muted">
              Página {page} de {Math.max(1, Math.ceil(total / FRANQUIAS_PAGE_SIZE))}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={loading || page * FRANQUIAS_PAGE_SIZE >= total}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
