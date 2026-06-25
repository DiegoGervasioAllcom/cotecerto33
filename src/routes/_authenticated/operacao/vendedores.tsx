import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PagePlaceholder } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/operacao/vendedores")({
  head: () => ({ meta: [{ title: "Vendedores · CoteCerto" }] }),
  component: VendedoresPage,
});

type Row = {
  id: string;
  nome: string;
  email: string;
  status: string;
  empresa_id: string | null;
  empresas?: { nome: string } | null;
};

function VendedoresPage() {
  const { role } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,nome,email,status,empresa_id, empresas:empresa_id(nome)")
        .order("nome");
      setRows((data as unknown as Row[]) ?? []);
    })();
  }, []);

  if (role !== "matriz" && role !== "master") {
    return (
      <AppShell title="Vendedores" crumbs="Operação">
        <PagePlaceholder description="Apenas Matriz e Master visualizam a rede de vendedores." />
      </AppShell>
    );
  }

  return (
    <AppShell title="Vendedores" crumbs="Operação · Equipe comercial">
      <div className="card">
        <div className="card-h">
          <h3>Usuários da rede</h3>
          <span className="chip chip-outline">{rows?.length ?? 0} total</span>
        </div>
        <div className="card-b" style={{ padding: 0 }}>
          {rows === null ? (
            <p style={{ padding: 20, color: "var(--muted)" }}>Carregando…</p>
          ) : rows.length === 0 ? (
            <p style={{ padding: 20, color: "var(--muted)" }}>Nenhum usuário vinculado ainda.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--offwhite)" }}>
                  <th style={th}>Nome</th>
                  <th style={th}>E-mail</th>
                  <th style={th}>Franquia</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={td}><strong style={{ color: "var(--slate)" }}>{r.nome || "—"}</strong></td>
                    <td style={td}>{r.email}</td>
                    <td style={td}>{r.empresas?.nome ?? "—"}</td>
                    <td style={td}>
                      <span className={`chip ${r.status === "aprovada" ? "chip-ok" : r.status === "pendente" ? "chip-yellow" : "chip-alert"}`}>
                        {r.status}
                      </span>
                    </td>
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
