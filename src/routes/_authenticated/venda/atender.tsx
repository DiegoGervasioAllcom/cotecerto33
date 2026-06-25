import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/venda/atender")({
  head: () => ({ meta: [{ title: "Atender agora · CoteCerto" }] }),
  component: Page,
});

type Lead = {
  id: string;
  nome: string;
  contato: string | null;
  origem: string | null;
  status_pipeline: string;
  valor: number | null;
  criado_em: string;
  ultimo_atendimento_em: string | null;
  dados: Record<string, unknown> | null;
};

function Page() {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const base = supabase
      .from("leads")
      .select("id,nome,contato,origem,status_pipeline,valor,criado_em,ultimo_atendimento_em,dados")
      .eq("responsavel_id", uid)
      .not("status_pipeline", "in", "(ganho,perdido)")
      .or(`ultimo_atendimento_em.is.null,ultimo_atendimento_em.lt.${since.toISOString()}`);

    const [{ data: prox, error: e1 }, { count, error: e2 }] = await Promise.all([
      base.order("criado_em", { ascending: true }).limit(1),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("responsavel_id", uid)
        .not("status_pipeline", "in", "(ganho,perdido)")
        .or(`ultimo_atendimento_em.is.null,ultimo_atendimento_em.lt.${since.toISOString()}`),
    ]);
    if (e1 || e2) setErr(e1?.message || e2?.message || null);
    setLead((prox?.[0] as Lead) ?? null);
    setPendentes(count ?? 0);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function iniciar() {
    if (!lead) return;
    setBusy(true);
    const { error } = await supabase.rpc("iniciar_atendimento", { p_lead_id: lead.id });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.navigate({ to: "/venda/pipeline" });
  }
  async function adiar() {
    if (!lead) return;
    setBusy(true);
    await supabase.rpc("iniciar_atendimento", { p_lead_id: lead.id });
    setBusy(false);
    await load();
  }

  return (
    <AppShell title="Atender agora">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>Atender agora</h1>
          <div className="sub">Próximo lead sem atendimento iniciado hoje</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip chip-info">{pendentes} pendentes hoje</span>
          <Link to="/venda/novo-lead" className="btn btn-primary">
            Novo lead
          </Link>
        </div>
      </div>

      {err && <div className="alert alert-err">{err}</div>}

      {!loading && !lead && (
        <div className="card">
          <div className="card-b" style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Nenhum lead aguardando atendimento 🎉
            </div>
            <div className="muted">Você está em dia. Aguarde novos leads ou crie um manualmente.</div>
          </div>
        </div>
      )}

      {lead && (
        <div className="card">
          <div className="card-h">
            <div>
              <strong>{lead.nome || "Lead sem nome"}</strong>
              <div className="small muted">
                Origem: {lead.origem || "—"} · Criado em{" "}
                {new Date(lead.criado_em).toLocaleString("pt-BR")}
              </div>
            </div>
            <span className="chip chip-yellow">{lead.status_pipeline}</span>
          </div>
          <div className="card-b">
            <div className="grid-2">
              <div>
                <div className="label">Contato</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{lead.contato || "—"}</div>
              </div>
              <div>
                <div className="label">Valor estimado</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {lead.valor
                    ? Number(lead.valor).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <button className="btn" onClick={adiar} disabled={busy}>
                Pular
              </button>
              <button className="btn btn-primary" onClick={iniciar} disabled={busy}>
                Iniciar atendimento
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
