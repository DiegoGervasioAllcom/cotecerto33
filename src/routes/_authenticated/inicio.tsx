import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, GitBranch, CheckSquare, Building2, Briefcase, TrendingUp, Activity,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Início · CoteCerto" }] }),
  component: InicioPage,
});

function InicioPage() {
  const { role, profile } = useAuth();
  return (
    <AppShell title="Início" crumbs={role ? `Dashboard · ${role.toUpperCase()}` : "Dashboard"}>
      {role === "matriz" && <MatrizDashboard />}
      {role === "master" && <MasterDashboard />}
      {role === "vendedor" && <VendedorDashboard userId={profile?.id ?? ""} />}
      {!role && (
        <div className="banner warn">
          Seu usuário ainda não tem perfil atribuído. Procure a Matriz para liberar seu acesso.
        </div>
      )}
    </AppShell>
  );
}

function Kpi({
  label, value, icon: Icon, meta,
}: { label: string; value: string | number; icon: typeof Users; meta?: string }) {
  return (
    <div className="kpi">
      <div className="lbl">{label}</div>
      <div className="val">{value}</div>
      {meta && <div className="meta">{meta}</div>}
      <div className="ic-wrap"><Icon /></div>
    </div>
  );
}

function useCounts<T extends Record<string, () => Promise<number>>>(queries: T) {
  const [data, setData] = useState<Record<keyof T, number | null>>(
    () => Object.fromEntries(Object.keys(queries).map((k) => [k, null])) as Record<keyof T, number | null>,
  );
  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        (Object.entries(queries) as [keyof T, () => Promise<number>][]).map(async ([k, fn]) => {
          try { return [k, await fn()] as const; } catch { return [k, 0] as const; }
        }),
      );
      if (alive) setData(Object.fromEntries(entries) as Record<keyof T, number>);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return data;
}

async function count(table: string, build?: (q: any) => any) {
  let q: any = supabase.from(table).select("id", { count: "exact", head: true });
  if (build) q = build(q);
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
}

function VendedorDashboard({ userId }: { userId: string }) {
  const counts = useCounts({
    leads: () => count("leads", (q) => q.eq("responsavel_id", userId)),
    pipeline: () =>
      count("leads", (q) =>
        q.eq("responsavel_id", userId).not("status_pipeline", "in", "(ganho,perdido)"),
      ),
    tarefas: () =>
      count("leads", (q) =>
        q.eq("responsavel_id", userId).eq("status_pipeline", "tarefa_hoje"),
      ),
  });

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Meus leads" value={counts.leads ?? "—"} icon={Users} meta="Todos os leads sob sua responsabilidade" />
        <Kpi label="Meu pipeline" value={counts.pipeline ?? "—"} icon={GitBranch} meta="Oportunidades em andamento" />
        <Kpi label="Tarefas do dia" value={counts.tarefas ?? "—"} icon={CheckSquare} meta="Pendências para hoje" />
        <Kpi label="Atividade" value="—" icon={Activity} meta="Em formulação" />
      </div>
      <div className="card">
        <div className="card-h"><h3>Próximas ações</h3></div>
        <div className="card-b">
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Suas tarefas, follow-ups e leads em risco aparecerão aqui. Por enquanto, use o menu
            <strong> Venda → Pipeline</strong> para acompanhar oportunidades.
          </p>
        </div>
      </div>
    </>
  );
}

function MasterDashboard() {
  const counts = useCounts({
    vendedores: () => count("profiles", (q) => q.eq("status", "aprovada")),
    leads: () => count("leads"),
    pipeline: () => count("leads", (q) => q.not("status_pipeline", "in", "(ganho,perdido)")),
    ganhos: () => count("leads", (q) => q.eq("status_pipeline", "ganho")),
  });
  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Vendedores ativos" value={counts.vendedores ?? "—"} icon={Briefcase} meta="No seu grupo" />
        <Kpi label="Leads do grupo" value={counts.leads ?? "—"} icon={Users} meta="Total acumulado" />
        <Kpi label="Em pipeline" value={counts.pipeline ?? "—"} icon={GitBranch} meta="Oportunidades abertas" />
        <Kpi label="Ganhos" value={counts.ganhos ?? "—"} icon={TrendingUp} meta="Negócios fechados" />
      </div>
      <div className="card">
        <div className="card-h"><h3>Performance dos vendedores</h3></div>
        <div className="card-b">
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Ranking, distribuição de leads e funil consolidado do seu grupo serão exibidos aqui
            em breve.
          </p>
        </div>
      </div>
    </>
  );
}

function MatrizDashboard() {
  const counts = useCounts({
    franquias: () => count("empresas", (q) => q.eq("status", "aprovada")),
    pendentes: () => count("empresas", (q) => q.eq("status", "pendente")),
    vendedores: () => count("profiles", (q) => q.eq("status", "aprovada")),
    leads: () => count("leads"),
  });
  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Franquias ativas" value={counts.franquias ?? "—"} icon={Building2} meta="Aprovadas na rede" />
        <Kpi label="Pendentes de aprovação" value={counts.pendentes ?? "—"} icon={Activity} meta="Acesse Operação → Franquias" />
        <Kpi label="Vendedores na rede" value={counts.vendedores ?? "—"} icon={Briefcase} meta="Total aprovado" />
        <Kpi label="Leads na rede" value={counts.leads ?? "—"} icon={Users} meta="Visão global" />
      </div>
      <div className="card">
        <div className="card-h"><h3>Visão geral da rede</h3></div>
        <div className="card-b">
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Indicadores agregados de conversão, ranking de franquias e SLA serão consolidados
            aqui na próxima entrega.
          </p>
        </div>
      </div>
    </>
  );
}
