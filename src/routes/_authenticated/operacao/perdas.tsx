import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/perdas")({
  head: () => ({ meta: [{ title: "Avaliação de perdas · CoteCerto" }] }),
  component: Page,
});

type Row = {
  id: string;
  nome: string;
  contato: string | null;
  valor: number | null;
  motivo_perda: string | null;
  submotivo_perda: string | null;
  destino_perda_sugerido: string | null;
  observacao_perda: string | null;
  perdida_em: string | null;
  responsavel: { nome: string | null } | null;
};

const money = (n: number | null) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [obs, setObs] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select(
        "id,nome,contato,valor,motivo_perda,submotivo_perda,destino_perda_sugerido,observacao_perda,perdida_em," +
          "responsavel:profiles!leads_responsavel_id_fkey(nome)",
      )
      .eq("em_avaliacao_matriz", true)
      .order("perdida_em", { ascending: false });
    if (error) setErr(error.message);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function decidir(id: string, decisao: "Remalho" | "Descarte" | "Reativar") {
    setBusy(id + decisao);
    const { error } = await supabase.rpc("avaliar_perda_lead", {
      p_lead_id: id,
      p_decisao: decisao,
      p_observacao: obs[id] || undefined,
    });
    setBusy(null);
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <AppShell title="Avaliação de perdas">
      <div className="page-head">
        <div>
          <h1>Avaliação de perdas</h1>
          <div className="sub">
            Leads marcados como perda pelos vendedores aguardando decisão da matriz.
          </div>
        </div>
      </div>

      {err && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <div className="card-b">{err}</div>
        </div>
      )}
      {loading ? (
        <div className="card">
          <div className="card-b">Carregando…</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="card-b">Nenhuma perda pendente de avaliação. 🎉</div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div className="card-h">
                <h3>
                  {r.nome}{" "}
                  <span className="chip chip-outline" style={{ marginLeft: 8 }}>
                    {money(r.valor)}
                  </span>
                </h3>
                <span className="chip chip-alert">Sugerido: {r.destino_perda_sugerido ?? "—"}</span>
              </div>
              <div className="card-b">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div className="small muted">Vendedor</div>
                    <div>{r.responsavel?.nome ?? "—"}</div>
                  </div>
                  <div>
                    <div className="small muted">Contato</div>
                    <div>{r.contato ?? "—"}</div>
                  </div>
                  <div>
                    <div className="small muted">Perdido em</div>
                    <div>{r.perdida_em ? new Date(r.perdida_em).toLocaleString("pt-BR") : "—"}</div>
                  </div>
                  <div>
                    <div className="small muted">Motivo</div>
                    <div>{r.motivo_perda ?? "—"}</div>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <div className="small muted">Sub-motivo</div>
                    <div>{r.submotivo_perda ?? "—"}</div>
                  </div>
                </div>
                {r.observacao_perda && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="small muted">Observação do vendedor</div>
                    <div>{r.observacao_perda}</div>
                  </div>
                )}
                <div className="small muted" style={{ marginBottom: 4 }}>
                  Observação da matriz (opcional)
                </div>
                <textarea
                  className="input"
                  rows={2}
                  value={obs[r.id] ?? ""}
                  onChange={(e) => setObs((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Comentários sobre a decisão…"
                  style={{ width: "100%", marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn btn-slate"
                    disabled={!!busy}
                    onClick={() => decidir(r.id, "Remalho")}
                  >
                    {busy === r.id + "Remalho" ? "Enviando…" : "Enviar para Remalho"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={!!busy}
                    onClick={() => decidir(r.id, "Descarte")}
                  >
                    {busy === r.id + "Descarte" ? "Enviando…" : "Confirmar Descarte"}
                  </button>
                  <button
                    className="btn btn-yellow"
                    disabled={!!busy}
                    onClick={() => decidir(r.id, "Reativar")}
                  >
                    {busy === r.id + "Reativar" ? "Enviando…" : "Reativar lead"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
