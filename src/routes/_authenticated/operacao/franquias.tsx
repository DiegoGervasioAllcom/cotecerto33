import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PagePlaceholder } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { supabase, type Empresa } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/operacao/franquias")({
  head: () => ({ meta: [{ title: "Franquias · CoteCerto" }] }),
  component: FranquiasPage,
});

function FranquiasPage() {
  const { role } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("empresas")
      .select("*")
      .order("status", { ascending: true })
      .order("nome");
    setEmpresas((data as Empresa[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  if (role !== "matriz") {
    return (
      <AppShell title="Franquias" crumbs="Operação">
        <PagePlaceholder description="Apenas a Matriz visualiza a lista global de franquias." />
      </AppShell>
    );
  }

  const aprovar = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("aprovar_empresa", { p_empresa_id: id });
    if (error) alert(error.message);
    await load();
    setBusy(null);
  };

  const recusar = async (id: string) => {
    setBusy(id);
    const { error } = await supabase
      .from("empresas")
      .update({ status: "recusada" })
      .eq("id", id);
    if (error) alert(error.message);
    await load();
    setBusy(null);
  };

  return (
    <AppShell title="Franquias" crumbs="Operação · Gestão da rede">
      <div className="card">
        <div className="card-h">
          <h3>Franquias cadastradas</h3>
          <span className="chip chip-outline">{empresas?.length ?? 0} total</span>
        </div>
        <div className="card-b" style={{ padding: 0 }}>
          {empresas === null ? (
            <p style={{ padding: 20, color: "var(--muted)" }}>Carregando…</p>
          ) : empresas.length === 0 ? (
            <p style={{ padding: 20, color: "var(--muted)" }}>Nenhuma franquia cadastrada.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--offwhite)" }}>
                  <th style={th}>Nome</th>
                  <th style={th}>Tipo</th>
                  <th style={th}>Documento</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--border-soft)" }}>
                    <td style={td}><strong style={{ color: "var(--slate)" }}>{e.nome}</strong></td>
                    <td style={td}>{e.tipo.toUpperCase()}</td>
                    <td style={td}>{e.documento}</td>
                    <td style={td}><StatusChip status={e.status} /></td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {e.status === "pendente" && (
                        <>
                          <button
                            className="btn btn-yellow btn-sm"
                            disabled={busy === e.id}
                            onClick={() => aprovar(e.id)}
                          >
                            Aprovar
                          </button>{" "}
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={busy === e.id}
                            onClick={() => recusar(e.id)}
                          >
                            Recusar
                          </button>
                        </>
                      )}
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

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente: "chip chip-yellow",
    aprovada: "chip chip-ok",
    recusada: "chip chip-alert",
    suspensa: "chip chip-outline",
  };
  return <span className={map[status] ?? "chip"}>{status}</span>;
}
