import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/cotacoes")({
  head: () => ({ meta: [{ title: "Cotações · CoteCerto" }] }),
  component: Page,
});

type Row = {
  id: string;
  numero: number;
  status: string;
  ramo: string;
  step_atual: number;
  criado_em: string;
  atualizado_em: string;
  lead_id: string | null;
  segurado: { nome: string | null; cpf_cnpj: string | null } | null;
  veiculo: { marca_nome: string | null; modelo_nome: string | null } | null;
};

const fmtBRL = (n: number | null) =>
  n
    ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "—";

function statusChip(s: string) {
  const map: Record<string, string> = {
    rascunho: "chip-slate",
    calculada: "chip-info",
    proposta: "chip-yellow",
    aceita: "chip-ok",
    perdida: "chip-alert",
  };
  return <span className={`chip ${map[s] || "chip-slate"}`}>{s}</span>;
}

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("cotacoes")
        .select(
          "id,numero,status,ramo,step_atual,criado_em,atualizado_em,lead_id," +
            "segurado:cotacao_segurado(nome,cpf_cnpj)," +
            "veiculo:cotacao_veiculo(marca_nome,modelo_nome)"
        )
        .order("atualizado_em", { ascending: false })
        .limit(200);
      if (error) setErr(error.message);
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    const t = `${r.numero} ${r.segurado?.nome ?? ""} ${r.veiculo?.modelo_nome ?? ""}`.toLowerCase();
    return !q || t.includes(q.toLowerCase());
  });

  return (
    <AppShell title="Cotações">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Cotações</h1>
          <div className="sub">Suas cotações em andamento e finalizadas</div>
        </div>
        <Link to="/venda/novo-lead" className="btn btn-primary">
          Nova cotação
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b">
          <input
            className="input"
            placeholder="Buscar por número, segurado ou modelo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && filtered.length === 0 && (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center" }} className="muted">
            Nenhuma cotação encontrada.
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Segurado</th>
                <th>Veículo</th>
                <th>Ramo</th>
                <th>Etapa</th>
                <th>Status</th>
                <th>Atualizada</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>#{r.numero}</strong>
                  </td>
                  <td>
                    {r.segurado?.nome || "—"}
                    <div className="small muted">{r.segurado?.cpf_cnpj}</div>
                  </td>
                  <td>
                    {r.veiculo?.marca_nome ? `${r.veiculo.marca_nome} ${r.veiculo.modelo_nome ?? ""}` : "—"}
                  </td>
                  <td>{r.ramo}</td>
                  <td>{r.step_atual + 1}/6</td>
                  <td>{statusChip(r.status)}</td>
                  <td>{new Date(r.atualizado_em).toLocaleString("pt-BR")}</td>
                  <td>
                    <Link
                      to="/venda/novo-lead"
                      search={{ id: r.id }}
                      className="btn"
                      style={{ padding: "4px 10px" }}
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
