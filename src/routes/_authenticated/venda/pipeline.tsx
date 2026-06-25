import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline · CoteCerto" }] }),
  component: PipelinePage,
});

type Stage = { id: string; ordem: number; nome: string; cor: string | null };
type Lead = {
  id: string;
  nome: string;
  contato: string | null;
  valor: number | null;
  status_pipeline: string;
};

const STATUS_BY_ORDER: Record<number, string> = {
  1: "novo", 2: "contato", 3: "cotacao", 4: "proposta", 5: "negociacao", 6: "ganho",
};

function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: st }, { data: ld }] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("ordem"),
      supabase.from("leads").select("id,nome,contato,valor,status_pipeline").order("criado_em", { ascending: false }),
    ]);
    setStages((st as Stage[]) ?? []);
    setLeads((ld as Lead[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const moverLead = async (leadId: string, novoStatus: string) => {
    await supabase.from("leads").update({ status_pipeline: novoStatus }).eq("id", leadId);
    load();
  };

  return (
    <AppShell title="Pipeline" crumbs="Venda · Funil de oportunidades">
      {loading ? (
        <p style={{ color: "var(--muted)" }}>Carregando…</p>
      ) : (
        <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(260px, 1fr)", gap: 14, overflowX: "auto", paddingBottom: 12 }}>
          {stages.map((s) => {
            const key = STATUS_BY_ORDER[s.ordem] ?? s.nome.toLowerCase();
            const inStage = leads.filter((l) => l.status_pipeline === key);
            const total = inStage.reduce((sum, l) => sum + (Number(l.valor) || 0), 0);
            return (
              <div key={s.id} className="card" style={{ minHeight: 360 }}>
                <div className="card-h" style={{ borderBottom: `3px solid ${s.cor ?? "#FFB600"}` }}>
                  <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.nome}</h3>
                  <span className="chip chip-outline">{inStage.length}</span>
                </div>
                <div className="card-b" style={{ display: "grid", gap: 10 }}>
                  <div style={{ color: "var(--muted)", fontSize: 11 }}>
                    Total: <strong style={{ color: "var(--slate)" }}>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  {inStage.length === 0 && (
                    <div style={{ color: "var(--muted)", fontSize: 12, padding: 12, border: "1px dashed var(--border-soft)", borderRadius: 8, textAlign: "center" }}>
                      Sem leads
                    </div>
                  )}
                  {inStage.map((l) => (
                    <div key={l.id} className="lead-card">
                      <div style={{ fontWeight: 700, color: "var(--slate)", fontSize: 13 }}>{l.nome || "Sem nome"}</div>
                      {l.contato && <div style={{ color: "var(--muted)", fontSize: 12 }}>{l.contato}</div>}
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--slate)" }}>
                        R$ {(Number(l.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <select
                        className="lead-move"
                        value={l.status_pipeline}
                        onChange={(e) => moverLead(l.id, e.target.value)}
                      >
                        {stages.map((opt) => {
                          const k = STATUS_BY_ORDER[opt.ordem] ?? opt.nome.toLowerCase();
                          return <option key={opt.id} value={k}>{opt.nome}</option>;
                        })}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
