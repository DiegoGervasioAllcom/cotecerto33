import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/extrato")({
  head: () => ({ meta: [{ title: "Extrato de vendas · CoteCerto" }] }),
  component: Page,
});

type Row = {
  id: string;
  numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  transmitida_em: string | null;
  cotacoes: { segurado: { nome: string | null }[] | null } | null;
};

type Lanc = {
  id: string;
  competencia: string | null;
  tipo: "credito" | "debito";
  valor: number;
  descricao: string;
  origem: string;
  criado_em: string;
};

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function firstOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [de, setDe] = useState(firstOfMonth());
  const [ate, setAte] = useState(today());
  const [lancs, setLancs] = useState<Lanc[]>([]);
  const [loadingLancs, setLoadingLancs] = useState(true);

  async function load() {
    setLoading(true);
    const ini = new Date(de + "T00:00:00").toISOString();
    const fim = new Date(ate + "T23:59:59").toISOString();
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id,numero,seguradora,premio,valor,transmitida_em," +
          "cotacoes(segurado:cotacao_segurado(nome))",
      )
      .eq("status", "transmitida")
      .gte("transmitida_em", ini)
      .lte("transmitida_em", fim)
      .order("transmitida_em", { ascending: false });
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate]);

  // Comissão real do vendedor (fatia G4.6): lançamentos do próprio usuário
  // logado em comissao_lancamentos, agrupados por competência (RLS já
  // restringe a beneficiario_id = auth.uid()).
  useEffect(() => {
    (async () => {
      setLoadingLancs(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLancs([]);
        setLoadingLancs(false);
        return;
      }
      const { data } = await supabase
        .from("comissao_lancamentos")
        .select("id,competencia,tipo,valor,descricao,origem,criado_em")
        .eq("beneficiario_id", u.user.id)
        .order("competencia", { ascending: false })
        .order("criado_em", { ascending: false })
        .limit(1000);
      setLancs((data ?? []) as Lanc[]);
      setLoadingLancs(false);
    })();
  }, []);

  const porCompetencia = useMemo(() => {
    const map = new Map<string, { creditos: number; debitos: number }>();
    for (const l of lancs) {
      const k = l.competencia || "—";
      const cur = map.get(k) || { creditos: 0, debitos: 0 };
      if (l.tipo === "credito") cur.creditos += Number(l.valor);
      else cur.debitos += Number(l.valor);
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([competencia, v]) => ({
        competencia,
        creditos: v.creditos,
        debitos: v.debitos,
        saldo: v.creditos - v.debitos,
      }))
      .sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  }, [lancs]);

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.premio ?? r.valor ?? 0), 0),
    [rows],
  );

  return (
    <AppShell title="Extrato de vendas">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Extrato de vendas</h1>
          <div className="sub">Propostas efetivamente transmitidas à seguradora</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-b row" style={{ gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <div className="label">De</div>
            <input
              type="date"
              className="input"
              value={de}
              onChange={(e) => setDe(e.target.value)}
            />
          </div>
          <div>
            <div className="label">Até</div>
            <input
              type="date"
              className="input"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
            />
          </div>
          <div style={{ marginLeft: "auto" }}>
            <div className="label">Total no período</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{fmtBRL(total)}</div>
            <div className="small muted">{rows.length} vendas</div>
          </div>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      {!loading && rows.length === 0 && (
        <div className="card">
          <div
            className="card-b"
            style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}
          >
            Nenhuma venda transmitida no período.
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table-pipe mtable" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Proposta</th>
                <th>Segurado</th>
                <th>Seguradora</th>
                <th style={{ textAlign: "right" }}>Prêmio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.transmitida_em
                      ? new Date(r.transmitida_em).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td>
                    <strong>{r.numero}</strong>
                  </td>
                  <td>{r.cotacoes?.segurado?.[0]?.nome || "—"}</td>
                  <td>{r.seguradora || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmtBRL(Number(r.premio ?? r.valor ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-dollar" />
            </svg>{" "}
            Minha comissão por competência
          </h3>
        </div>
        <div className="card-b">
          {loadingLancs && <div className="muted">Carregando…</div>}
          {!loadingLancs && porCompetencia.length === 0 && (
            <div className="muted">
              Nenhum lançamento de comissão ainda — aparece aqui após o fechamento da competência
              pela Matriz.
            </div>
          )}
          {!loadingLancs && porCompetencia.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table-pipe mtable" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th style={{ textAlign: "right" }}>Créditos</th>
                    <th style={{ textAlign: "right" }}>Débitos</th>
                    <th style={{ textAlign: "right" }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {porCompetencia.map((c) => (
                    <tr key={c.competencia}>
                      <td>
                        <strong>{c.competencia}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>{fmtBRL(c.creditos)}</td>
                      <td style={{ textAlign: "right" }}>{fmtBRL(c.debitos)}</td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{fmtBRL(c.saldo)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
