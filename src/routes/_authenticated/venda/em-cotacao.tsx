import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { cotNum } from "@/components/venda/cotacoes/lista-helpers";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/em-cotacao")({
  head: () => ({ meta: [{ title: "Em cotação · CoteCerto" }] }),
  component: Page,
});

type Row = {
  id: string;
  numero: number;
  ramo: string;
  criado_em: string;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
  } | null;
};

function Page() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select(
          "id,numero,ramo,criado_em,atualizado_em," +
            "segurado:cotacao_segurado(nome)," +
            "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)",
        )
        .eq("status", "rascunho")
        .order("atualizado_em", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const t =
          `${cotNum(r.numero)} ${r.segurado?.nome ?? ""} ${r.veiculo?.modelo_nome ?? ""}`.toLowerCase();
        if (q && !t.includes(q.toLowerCase())) return false;
        return true;
      }),
    [rows, q],
  );

  function continuar(id: string) {
    void nav({ to: "/venda/novo-lead", search: { id } });
  }

  return (
    <AppShell title="Em cotação">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Em cotação</h1>
          <div className="sub">
            Preenchendo segurado, seguro, veículo, perfil e coberturas ·{" "}
            <span className="chip chip-yellow">preenchendo dados</span>
          </div>
        </div>
        <div className="tools">
          <Link to="/venda/pipeline" className="btn btn-ghost">
            <svg width={14} height={14}>
              <use href="#i-kanban" />
            </svg>{" "}
            Ver no pipeline
          </Link>
        </div>
      </div>

      <div className="filters-bar">
        <span className="label">FILTROS</span>
        <input
          className="select-mini"
          placeholder="Buscar segurado, veículo, nº cotação…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn-link btn-sm" onClick={() => setQ("")}>
          Limpar
        </button>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card" data-tour="em-cotacao-lista">
          <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
            Nenhuma cotação em preenchimento agora.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div
          className="card"
          data-tour="em-cotacao-lista"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <table className="table-pipe">
            <thead>
              <tr>
                <th>Nº COTAÇÃO</th>
                <th>SEGURADO</th>
                <th>VEÍCULO</th>
                <th>RAMO</th>
                <th>ATUALIZADA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const veic = r.veiculo
                  ? `${r.veiculo.marca_nome ?? ""} ${r.veiculo.modelo_nome ?? ""} ${r.veiculo.ano_modelo ?? ""}`.trim()
                  : "—";
                return (
                  <tr key={r.id} onClick={() => continuar(r.id)} style={{ cursor: "pointer" }}>
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
                    <td className="small muted" style={{ textTransform: "capitalize" }}>
                      {r.ramo}
                    </td>
                    <td className="small muted">
                      {new Date(r.atualizado_em).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td>
                      <button
                        className="btn btn-yellow btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          continuar(r.id);
                        }}
                      >
                        <svg width={13} height={13}>
                          <use href="#i-edit" />
                        </svg>{" "}
                        Continuar de onde parou
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
