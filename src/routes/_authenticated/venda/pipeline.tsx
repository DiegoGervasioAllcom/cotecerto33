import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline · CoteCerto" }] }),
  component: Page,
});

type Stage = { id: string; ordem: number; nome: string; cor: string | null };
type Lead = {
  id: string;
  nome: string;
  contato: string | null;
  status_pipeline: string;
  valor: number | null;
  criado_em: string;
};

const STAGE_KEY: Record<string, string> = {
  Novo: "novo",
  Qualificando: "contato",
  Cotando: "cotacao",
  "Proposta enviada": "proposta",
  "Em negociação": "negociacao",
  Fechado: "ganho",
};

function Page() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: st }, { data: lds, error }] = await Promise.all([
      supabase.from("pipeline_stages").select("*").order("ordem"),
      supabase
        .from("leads")
        .select("id,nome,contato,status_pipeline,valor,criado_em")
        .order("atualizado_em", { ascending: false })
        .limit(500),
    ]);
    if (error) setErr(error.message);
    setStages((st ?? []) as Stage[]);
    setLeads((lds ?? []) as Lead[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const m: Record<string, Lead[]> = {};
    for (const s of stages) m[STAGE_KEY[s.nome] ?? s.nome.toLowerCase()] = [];
    for (const l of leads) {
      (m[l.status_pipeline] ??= []).push(l);
    }
    return m;
  }, [stages, leads]);

  async function move(lead: Lead, novo: string) {
    setLeads((prev) =>
      prev.map((x) => (x.id === lead.id ? { ...x, status_pipeline: novo } : x))
    );
    const { error } = await supabase
      .from("leads")
      .update({ status_pipeline: novo, atualizado_em: new Date().toISOString() })
      .eq("id", lead.id);
    if (error) {
      setErr(error.message);
      load();
    }
  }

  return (
    <AppShell title="Pipeline">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <div className="sub">Arraste cartões entre as etapas (ou use o seletor)</div>
        </div>
        <Link to="/venda/novo-lead" className="btn btn-primary">
          Novo lead
        </Link>
      </div>

      {err && <div className="alert alert-err">{err}</div>}
      {loading && <div className="muted">Carregando…</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${stages.length || 1}, minmax(240px, 1fr))`,
          gap: 12,
          overflowX: "auto",
        }}
      >
        {stages.map((s) => {
          const key = STAGE_KEY[s.nome] ?? s.nome.toLowerCase();
          const list = grouped[key] ?? [];
          return (
            <div
              key={s.id}
              className="card"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/lead");
                const lead = leads.find((l) => l.id === id);
                if (lead && lead.status_pipeline !== key) move(lead, key);
              }}
            >
              <div className="card-h" style={{ borderTop: `3px solid ${s.cor || "#5C6F80"}` }}>
                <strong>{s.nome}</strong>
                <span className="chip chip-slate">{list.length}</span>
              </div>
              <div className="card-b" style={{ display: "grid", gap: 8 }}>
                {list.length === 0 && <div className="small muted">Vazio</div>}
                {list.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/lead", l.id)}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: 10,
                      background: "#fff",
                      cursor: "grab",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{l.nome || "Sem nome"}</div>
                    <div className="small muted">{l.contato || "—"}</div>
                    <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
                      <small className="muted">
                        {new Date(l.criado_em).toLocaleDateString("pt-BR")}
                      </small>
                      <small style={{ fontWeight: 700 }}>
                        {l.valor
                          ? Number(l.valor).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
