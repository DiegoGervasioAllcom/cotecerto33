import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/comando/leads")({
  head: () => ({ meta: [{ title: "Leads · CoteCerto" }] }),
  component: LeadsAdminPage,
});

type Row = {
  id: string;
  nome: string;
  contato: string | null;
  origem: string | null;
  status_pipeline: string;
  valor: number | null;
  empresa_id: string | null;
  responsavel_id: string | null;
  criado_em: string;
};

function LeadsAdminPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<"todos" | "sem_responsavel">("todos");

  const load = async () => {
    let q = supabase.from("leads").select("*").order("criado_em", { ascending: false });
    if (filter === "sem_responsavel") q = q.is("responsavel_id", null);
    const { data } = await q;
    setRows((data as Row[]) ?? []);
  };

  useEffect(() => { load(); }, [filter]);

  return (
    <AppShell title="Leads" crumbs="Comando · Distribuição">
      <div className="card">
        <div className="card-h" style={{ gap: 12 }}>
          <h3>Base de leads</h3>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button className={`chip ${filter === "todos" ? "chip-yellow" : "chip-outline"}`} onClick={() => setFilter("todos")}>Todos</button>
            <button className={`chip ${filter === "sem_responsavel" ? "chip-yellow" : "chip-outline"}`} onClick={() => setFilter("sem_responsavel")}>Sem responsável</button>
          </div>
        </div>
        <div className="card-b" style={{ padding: 0 }}>
          {rows === null ? (
            <p style={{ padding: 20, color: "var(--muted)" }}>Carregando…</p>
          ) : rows.length === 0 ? (
            <p style={{ padding: 20, color: "var(--muted)" }}>Nenhum lead encontrado.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--offwhite)" }}>
                  <th style={th}>Lead</th>
                  <th style={th}>Contato</th>
                  <th style={th}>Origem</th>
                  <th style={th}>Status</th>
                  <th style={th}>Valor</th>
                  <th style={th}>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={td}><strong style={{ color: "var(--slate)" }}>{l.nome || "—"}</strong></td>
                    <td style={td}>{l.contato ?? "—"}</td>
                    <td style={td}>{l.origem ?? "—"}</td>
                    <td style={td}><span className="chip chip-outline">{l.status_pipeline}</span></td>
                    <td style={td}>R$ {(Number(l.valor) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td style={td}>{l.responsavel_id ? <span className="chip chip-ok">atribuído</span> : <span className="chip chip-yellow">aguardando</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}

const th: React.CSSProperties = {
  padding: "12px 16px", textAlign: "left", fontSize: 11,
  letterSpacing: "0.12em", color: "var(--muted)", fontWeight: 700,
};
const td: React.CSSProperties = { padding: "12px 16px" };
