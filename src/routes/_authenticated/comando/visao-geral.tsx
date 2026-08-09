import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { ChannelFunnels } from "@/components/comando/channel-funnels";
import { DashboardAlerts } from "@/components/comando/dashboard-alerts";
import { useDashboardAlertCounts } from "@/components/comando/use-dashboard-alert-counts";
import { DashboardPeriodPicker } from "@/components/comando/dashboard-period-picker";
import { ProtoIcons } from "@/components/proto-icons";
import { supabase } from "@/integrations/supabase/client";
import { selectCurrentDashboardPeriod } from "@/lib/dashboard-period";
import { buildDashboardAlertsFromCounts } from "@/lib/dashboard-alerts";
import { printHtml } from "@/lib/print";
import { useGroupScope } from "@/lib/group-scope";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/comando/visao-geral")({
  head: () => ({ meta: [{ title: "Visão geral · CoteCerto" }] }),
  component: Page,
});

const SLA_SECONDS = 180;
const BRL = (n: number) => "R$ " + (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const fmtDur = (s: number) => {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60),
    r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
};
const monthLabel = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

type Lead = {
  id: string;
  status_pipeline: string;
  empresa_id: string | null;
  responsavel_id: string | null;
  criado_em: string;
  distribuido_em: string | null;
  ultimo_atendimento_em: string | null;
  bloqueado: boolean | null;
  arquivado: boolean | null;
  valor: number | null;
};
type Empresa = { id: string; nome: string; tipo: string };
type Profile = { id: string; nome: string; empresa_id: string | null };
type Proposta = {
  id: string;
  status: string;
  valor: number | null;
  responsavel_id: string | null;
  criado_em: string;
  atualizado_em: string | null;
  emitida_em: string | null;
  pago_em: string | null;
  cancelada_em: string | null;
  vencimento: string | null;
};

function Page() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { isGroupView, isFranqFull, group, groupPct } = useGroupScope();
  const [now, setNow] = useState(Date.now());
  const [periodWindow, setPeriodWindow] = useState(() => selectCurrentDashboardPeriod("mes"));
  const customStart = periodWindow.preset === "personalizado" ? periodWindow.startDate : null;
  const customEnd = periodWindow.preset === "personalizado" ? periodWindow.endDate : null;

  const normalizedPeriodQuery = useQuery({
    queryKey: ["normalizar-periodo-visao-geral", periodWindow.preset, customStart, customEnd],
    queryFn: async () => {
      const args =
        periodWindow.preset === "personalizado"
          ? {
              p_periodo: periodWindow.preset,
              p_inicio: periodWindow.startDate,
              p_fim: periodWindow.endDate,
            }
          : { p_periodo: periodWindow.preset };
      const { data, error } = await supabase.rpc("normalizar_periodo_visao_geral", args).single();
      if (error) throw error;
      return data;
    },
  });

  const normalizedPeriod = normalizedPeriodQuery.data;
  const dashboardAlertsQuery = useDashboardAlertCounts(normalizedPeriod, now, SLA_SECONDS);

  const channelFunnelsQuery = useQuery({
    queryKey: ["funis-por-canal-visao-geral", normalizedPeriod?.inicio, normalizedPeriod?.fim],
    enabled: Boolean(normalizedPeriod),
    queryFn: async () => {
      if (!normalizedPeriod) throw new Error("Período ainda não normalizado.");
      const { data, error } = await supabase.rpc("funis_por_canal_visao_geral", {
        p_inicio: normalizedPeriod.inicio,
        p_fim: normalizedPeriod.fim,
      });
      if (error) throw error;
      return data;
    },
  });

  // Dinheiro é agregado exclusivamente no servidor. A RPC aplica a janela
  // canônica, auth.uid() e RLS; o React apenas exibe saldo e quantidade.
  const saldoGrupoQuery = useQuery({
    queryKey: ["saldo-grupo-visao-geral", normalizedPeriod?.inicio, normalizedPeriod?.fim],
    enabled: isGroupView && Boolean(normalizedPeriod),
    queryFn: async () => {
      if (!normalizedPeriod) throw new Error("Período ainda não normalizado.");
      const { data, error } = await supabase
        .rpc("saldo_comissao_visao_geral", {
          p_inicio: normalizedPeriod.inicio,
          p_fim: normalizedPeriod.fim,
        })
        .single();
      if (error) throw error;
      return data;
    },
  });
  const saldoGrupo = saldoGrupoQuery.data;

  const dashboardQuery = useQuery({
    queryKey: ["visao-geral", normalizedPeriod?.inicio, normalizedPeriod?.fim],
    enabled: Boolean(normalizedPeriod),
    queryFn: async () => {
      if (!normalizedPeriod) throw new Error("Período ainda não normalizado.");
      const { data: u, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      let matrizId: string | null = null;
      if (u.user) {
        const { data: me, error: profileError } = await supabase
          .from("profiles")
          .select("empresa_id")
          .eq("id", u.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        matrizId = me?.empresa_id ?? null;
      }

      const [l, e, pr, pp] = await Promise.all([
        supabase
          .from("leads")
          .select(
            "id,status_pipeline,empresa_id,responsavel_id,criado_em,distribuido_em,ultimo_atendimento_em,bloqueado,arquivado,valor",
          )
          .gte("criado_em", normalizedPeriod.inicio)
          .lt("criado_em", normalizedPeriod.fim)
          .limit(5000),
        supabase.from("empresas").select("id,nome,tipo").limit(500),
        supabase.from("profiles").select("id,nome,empresa_id").limit(2000),
        supabase
          .from("propostas")
          .select(
            "id,status,valor,responsavel_id,criado_em,atualizado_em,emitida_em,pago_em,cancelada_em,vencimento",
          )
          .gte("criado_em", normalizedPeriod.inicio)
          .lt("criado_em", normalizedPeriod.fim)
          .limit(5000),
      ]);
      const queryError = l.error ?? e.error ?? pr.error ?? pp.error;
      if (queryError) throw queryError;

      return {
        matrizId,
        leads: (l.data ?? []) as Lead[],
        empresas: (e.data ?? []) as Empresa[],
        profiles: (pr.data ?? []) as Profile[],
        propostas: (pp.data ?? []) as Proposta[],
      };
    },
  });

  const {
    matrizId = null,
    leads = [],
    empresas = [],
    profiles = [],
    propostas = [],
  } = dashboardQuery.data ?? {};

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Franquias = todas as empresas exceto a matriz do usuário logado (Matriz)
  // ou, na visão de grupo, todas as empresas da rede já escopadas pelo RLS
  // (empresas_visiveis) exceto a própria operação do gestor logado.
  const franquias = useMemo(() => empresas.filter((x) => x.id !== matrizId), [empresas, matrizId]);
  // Vendedores = profiles vinculados a uma franquia (não à matriz) e diferentes do usuário logado matriz
  const vendedores = useMemo(
    () => profiles.filter((x) => x.empresa_id && x.empresa_id !== matrizId),
    [profiles, matrizId],
  );

  const groupLabel = group === "MASTER" ? "Master" : "Franqueado";

  const periodLabel = periodWindow.label;
  const leadsMes = useMemo(() => leads.filter((x) => !x.arquivado), [leads]);
  const propostasMes = propostas.filter(
    (proposta) =>
      normalizedPeriod &&
      proposta.criado_em >= normalizedPeriod.inicio &&
      proposta.criado_em < normalizedPeriod.fim,
  );
  const emitidasMes = propostasMes.filter(
    (x) => x.status === "gerada" || x.status === "transmitida",
  );
  const pagasMes = propostasMes.filter((x) => x.status === "transmitida");
  const naoPagasMes = emitidasMes.length - pagasMes.length;
  const comissaoMes = pagasMes.reduce((a, x) => a + Number(x.valor || 0), 0);

  // Speed-to-lead
  const pendentes = useMemo(
    () =>
      leadsMes.filter(
        (l) =>
          !l.distribuido_em && !l.responsavel_id && !l.empresa_id && l.status_pipeline === "novo",
      ),
    [leadsMes],
  );
  const distribuidos = useMemo(() => leadsMes.filter((l) => l.distribuido_em), [leadsMes]);
  const oldestSec = pendentes.reduce(
    (a, l) => Math.max(a, Math.floor((now - new Date(l.criado_em).getTime()) / 1000)),
    0,
  );
  const avgDistSec = distribuidos.length
    ? Math.round(
        distribuidos.reduce(
          (a, l) =>
            a +
            Math.max(
              0,
              (new Date(l.distribuido_em!).getTime() - new Date(l.criado_em).getTime()) / 1000,
            ),
          0,
        ) / distribuidos.length,
      )
    : 0;
  const sub3min = distribuidos.length
    ? Math.round(
        (distribuidos.filter(
          (l) =>
            (new Date(l.distribuido_em!).getTime() - new Date(l.criado_em).getTime()) / 1000 <=
            SLA_SECONDS,
        ).length /
          distribuidos.length) *
          100,
      )
    : 0;
  const atendidos = leadsMes.filter((l) => l.ultimo_atendimento_em);
  const avg1Contato = atendidos.length
    ? Math.round(
        atendidos.reduce(
          (a, l) =>
            a +
            Math.max(
              0,
              (new Date(l.ultimo_atendimento_em!).getTime() - new Date(l.criado_em).getTime()) /
                1000,
            ),
          0,
        ) / atendidos.length,
      )
    : 0;

  const semAtendimento = leadsMes.filter(
    (l) => !l.ultimo_atendimento_em && l.status_pipeline === "novo" && !l.bloqueado,
  );
  const slaEstourado = pendentes.filter(
    (l) => (now - new Date(l.criado_em).getTime()) / 1000 > SLA_SECONDS,
  );
  const fechadosHoje = leadsMes.filter((l) => l.status_pipeline === "ganho");
  // V11.7.5b — corrige a heurística antiga (status==='gerada', que é só "ainda
  // não enviada à seguradora", não pendência). A contagem certa
  // (transmitida/não emitida/não cancelada, dentro da janela normalizada) já
  // é buscada por `useDashboardAlertCounts` para alimentar o alerta
  // "pendentes-seguradora" — reaproveitamos o mesmo resultado aqui, em vez de
  // chamar `contar_pendentes_seguradora_visao_geral` de novo.
  const pendenteSeguradoraCount = dashboardAlertsQuery.data?.pendentesSeguradora ?? 0;

  const recebidosMes = leadsMes.length;
  const distribuidosMes = distribuidos.length;
  const convMes = recebidosMes ? Math.round((emitidasMes.length / recebidosMes) * 100) : 0;

  // Evolução dentro da mesma janela usada pelos demais widgets.
  const evol = useMemo(() => {
    const out: { label: string; emitidas: number; pagas: number }[] = [];
    if (!normalizedPeriod) return out;
    const periodStart = new Date(normalizedPeriod.inicio);
    const periodEnd = new Date(normalizedPeriod.fim);
    const totalDays = Math.max(
      1,
      Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000),
    );
    const bucketCount = Math.min(6, totalDays);
    for (let i = 0; i < bucketCount; i++) {
      const start = new Date(
        periodStart.getTime() + Math.floor((totalDays * i) / bucketCount) * 86_400_000,
      );
      const end = new Date(
        periodStart.getTime() + Math.floor((totalDays * (i + 1)) / bucketCount) * 86_400_000,
      );
      const ps = propostas.filter((x) => {
        const d = new Date(x.criado_em);
        return d >= start && d < end;
      });
      out.push({
        label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        emitidas: ps.filter((x) => x.status === "gerada" || x.status === "transmitida").length,
        pagas: ps.filter((x) => x.status === "transmitida").length,
      });
    }
    return out;
  }, [normalizedPeriod, propostas]);
  const maxEvol = Math.max(10, ...evol.flatMap((m) => [m.emitidas, m.pagas]));

  // Rankings
  const rankFranq = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nome: string; vendas: number; conv: number; leads: number }
    >();
    for (const f of franquias)
      map.set(f.id, { id: f.id, nome: f.nome, vendas: 0, conv: 0, leads: 0 });
    for (const l of leadsMes) {
      if (!l.empresa_id) continue;
      const r = map.get(l.empresa_id);
      if (!r) continue;
      r.leads += 1;
      if (l.status_pipeline === "ganho") r.vendas += 1;
    }
    for (const r of map.values()) r.conv = r.leads ? Math.round((r.vendas / r.leads) * 100) : 0;
    return Array.from(map.values()).sort((a, b) => b.vendas - a.vendas);
  }, [franquias, leadsMes]);

  const rankVend = useMemo(() => {
    const fmap = new Map(franquias.map((f) => [f.id, f.nome]));
    const map = new Map<
      string,
      { id: string; nome: string; franq: string; vendas: number; conv: number; leads: number }
    >();
    for (const p of vendedores)
      map.set(p.id, {
        id: p.id,
        nome: p.nome || "—",
        franq: fmap.get(p.empresa_id || "") || "—",
        vendas: 0,
        conv: 0,
        leads: 0,
      });
    for (const l of leadsMes) {
      if (!l.responsavel_id) continue;
      const r = map.get(l.responsavel_id);
      if (!r) continue;
      r.leads += 1;
      if (l.status_pipeline === "ganho") r.vendas += 1;
    }
    for (const r of map.values()) r.conv = r.leads ? Math.round((r.vendas / r.leads) * 100) : 0;
    return Array.from(map.values())
      .filter((r) => r.leads > 0 || r.vendas > 0)
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 8);
  }, [vendedores, franquias, leadsMes]);

  const dashboardAlerts = useMemo(() => {
    if (!normalizedPeriod || !dashboardAlertsQuery.data) return [];
    return buildDashboardAlertsFromCounts({
      counts: dashboardAlertsQuery.data,
      inicio: normalizedPeriod.inicio,
      fim: normalizedPeriod.fim,
    });
  }, [dashboardAlertsQuery.data, normalizedPeriod]);

  function chartBarsSVG(): string {
    const W = 720,
      H = 240,
      padL = 36,
      padR = 12,
      padT = 12,
      padB = 26;
    const innerW = W - padL - padR,
      innerH = H - padT - padB;
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    const colW = innerW / Math.max(1, evol.length);
    const bw = Math.min(28, colW / 2 - 6);
    const grid = ticks
      .map((p) => {
        const y = padT + innerH - p * innerH;
        return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/><text x="4" y="${y + 3}" font-size="10" fill="#64748b">${Math.round(maxEvol * p)}</text>`;
      })
      .join("");
    const bars = evol
      .map((m, i) => {
        const x0 = padL + i * colW + (colW / 2 - bw - 2);
        const he = (m.emitidas / maxEvol) * innerH;
        const hp = (m.pagas / maxEvol) * innerH;
        return `
        <rect x="${x0}" y="${padT + innerH - he}" width="${bw}" height="${he}" rx="3" fill="#475569"/>
        <rect x="${x0 + bw + 4}" y="${padT + innerH - hp}" width="${bw}" height="${hp}" rx="3" fill="#facc15"/>
        <text x="${x0 + bw + 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#64748b">${m.label}</text>
        <text x="${x0 + bw / 2}" y="${padT + innerH - he - 4}" text-anchor="middle" font-size="9" fill="#0f172a">${m.emitidas || ""}</text>
        <text x="${x0 + bw + 4 + bw / 2}" y="${padT + innerH - hp - 4}" text-anchor="middle" font-size="9" fill="#0f172a">${m.pagas || ""}</text>`;
      })
      .join("");
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" xmlns="http://www.w3.org/2000/svg">${grid}${bars}</svg>`;
  }

  function pieFunilSVG(): string {
    const total = recebidosMes;
    const distrib = distribuidosMes;
    const emit = emitidasMes.length;
    const pag = pagasMes.length;
    const rows = [
      { lbl: "Leads recebidos", v: total, c: "#94a3b8" },
      { lbl: "Distribuídos", v: distrib, c: "#3b82f6" },
      { lbl: "Vendas emitidas", v: emit, c: "#475569" },
      { lbl: "Vendas pagas", v: pag, c: "#facc15" },
    ];
    const max = Math.max(1, total);
    return (
      `<svg viewBox="0 0 520 ${rows.length * 36 + 10}" width="100%" xmlns="http://www.w3.org/2000/svg">` +
      rows
        .map((r, i) => {
          const y = 8 + i * 36;
          const w = (r.v / max) * 360;
          return `<text x="0" y="${y + 14}" font-size="11" fill="#334155">${r.lbl}</text>
          <rect x="140" y="${y + 4}" width="360" height="16" rx="3" fill="#f1f5f9"/>
          <rect x="140" y="${y + 4}" width="${w}" height="16" rx="3" fill="${r.c}"/>
          <text x="505" y="${y + 16}" font-size="11" fill="#0f172a" text-anchor="end" font-weight="700">${r.v}</text>`;
        })
        .join("") +
      `</svg>`
    );
  }

  function exportarRelatorio() {
    const fmtBR = (n: number) =>
      "R$ " + (n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    const tFranq = `<table><thead><tr><th>#</th><th>Franquia</th><th class="num">Leads</th><th class="num">Vendas</th><th class="num">Conv.</th></tr></thead><tbody>${
      (rankFranq.length ? rankFranq.slice(0, 10) : [])
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td><td>${r.nome}</td><td class="num">${r.leads}</td><td class="num">${r.vendas}</td><td class="num">${r.conv}%</td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="5" style="text-align:center;color:#94a3b8">Sem franquias cadastradas</td></tr>`
    }</tbody></table>`;
    const tVend = `<table><thead><tr><th>#</th><th>Vendedor</th><th>Franquia</th><th class="num">Leads</th><th class="num">Vendas</th><th class="num">Conv.</th></tr></thead><tbody>${
      (rankVend.length ? rankVend : [])
        .map(
          (r, i) =>
            `<tr><td>${i + 1}</td><td>${r.nome}</td><td>${r.franq}</td><td class="num">${r.leads}</td><td class="num">${r.vendas}</td><td class="num">${r.conv}%</td></tr>`,
        )
        .join("") ||
      `<tr><td colspan="6" style="text-align:center;color:#94a3b8">Sem atividade no período</td></tr>`
    }</tbody></table>`;
    const body = `
      <h1>Relatório operacional — Visão geral</h1>
      <div class="sub">Período: <b>${periodLabel}</b> · ${franquias.length} franquias · ${vendedores.length} vendedores ativos</div>

      <h2>Indicadores principais</h2>
      <div class="grid">
        <div class="kv"><b>Leads recebidos:</b> ${recebidosMes}</div>
        <div class="kv"><b>Leads distribuídos:</b> ${distribuidosMes}</div>
        <div class="kv"><b>Sem atendimento:</b> ${semAtendimento.length}</div>
        <div class="kv"><b>Tempo médio 1º contato:</b> ${(avg1Contato / 60).toFixed(1)} min</div>
        <div class="kv"><b>Vendas emitidas:</b> ${emitidasMes.length}</div>
        <div class="kv"><b>Vendas pagas:</b> ${pagasMes.length}</div>
        <div class="kv"><b>Vendas não pagas:</b> ${Math.max(0, naoPagasMes)}</div>
        <div class="kv"><b>Conversão geral:</b> ${convMes}%</div>
        <div class="kv"><b>Prêmio pago:</b> ${fmtBR(comissaoMes)}</div>
        <div class="kv"><b>Tempo médio até distribuir:</b> ${fmtDur(avgDistSec)}</div>
        <div class="kv"><b>Distribuídos em &lt; 3 min:</b> ${sub3min}%</div>
        <div class="kv"><b>Mais antigo sem distribuir:</b> ${fmtDur(oldestSec)}</div>
      </div>

      <h2>Funil do período</h2>
      <div class="card">${pieFunilSVG()}</div>

      <h2>Evolução no período</h2>
      <div class="card">
        <div style="display:flex;gap:14px;font-size:11px;color:#475569;margin-bottom:6px">
          <span><span style="display:inline-block;width:10px;height:10px;background:#475569;border-radius:2px;margin-right:4px"></span>Emitidas</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:#facc15;border-radius:2px;margin-right:4px"></span>Pagas</span>
        </div>
        ${chartBarsSVG()}
      </div>

      <h2>Ranking de franquias</h2>
      ${tFranq}

      <h2>Ranking de vendedores</h2>
      ${tVend}
    `;
    printHtml(`Visão geral · ${periodLabel}`, body);
  }

  return (
    <AppShell title="Visão geral">
      <ProtoIcons />
      <div className="page-head">
        <div>
          <h1>
            {isFranqFull
              ? "Visão geral da franquia"
              : isGroupView
                ? "Visão geral do grupo"
                : "Operação CoteCerto"}
          </h1>
          <div className="sub">
            {isFranqFull ? (
              <>
                Unidade de <strong>{profile?.nome ?? "—"}</strong> ·{" "}
                <strong>{vendedores.length} vendedores</strong> ativos · período:{" "}
                <strong style={{ textTransform: "capitalize" }}>{periodLabel}</strong>
              </>
            ) : isGroupView ? (
              <>
                Equipe de <strong>{profile?.nome ?? "—"}</strong> ({groupLabel}) ·{" "}
                <strong>{franquias.length} franquias</strong> ·{" "}
                <strong>{vendedores.length} vendedores</strong> · {groupPct}% sobre a equipe ·
                período: <strong style={{ textTransform: "capitalize" }}>{periodLabel}</strong>
              </>
            ) : (
              <>
                {monthLabel(new Date())} · <strong>{franquias.length} franquias</strong> ·{" "}
                <strong>{vendedores.length} vendedores</strong> ativos · período:{" "}
                <strong style={{ textTransform: "capitalize" }}>{periodLabel}</strong>
              </>
            )}
          </div>
        </div>
        <div className="tools">
          <button className="btn btn-ghost" onClick={() => exportarRelatorio()}>
            <svg width="14" height="14">
              <use href="#i-download"></use>
            </svg>{" "}
            Exportar
          </button>
          <button className="btn btn-slate" onClick={() => navigate({ to: "/comando/leads" })}>
            <svg width="14" height="14">
              <use href="#i-layers"></use>
            </svg>{" "}
            Central de Leads
          </button>
        </div>
      </div>

      <DashboardPeriodPicker value={periodWindow} onChange={setPeriodWindow} />

      {!isGroupView &&
        dashboardAlertsQuery.data &&
        (() => {
          const a = dashboardAlertsQuery.data;
          const itens: { n: number; label: string; to: string }[] = [
            {
              n: a.leadsBloqueados,
              label: "travado(s) fora da distribuição",
              to: "/comando/leads",
            },
            { n: a.slaEstourado, label: "lead(s) com SLA estourado", to: "/comando/leads" },
            {
              n: a.cadastrosPendentes,
              label: "pedido(s) de acesso na fila",
              to: "/operacao/acessos",
            },
            {
              n: a.desligamentosPendentes,
              label: "solicitação(ões) de desligamento",
              to: "/operacao/acessos",
            },
            {
              n: a.vendedoresAtencao,
              label: "vendedor(es) em atenção",
              to: "/operacao/acessos",
            },
          ].filter((i) => i.n > 0);
          if (!itens.length) return null;
          return (
            <div className="filters-bar" style={{ marginBottom: 12 }}>
              <span className="label">ALERTAS</span>
              {itens.map((i) => (
                <button
                  key={i.label}
                  className="chip chip-alert"
                  style={{ border: "none", cursor: "pointer" }}
                  onClick={() => navigate({ to: i.to })}
                >
                  {i.n} {i.label}
                </button>
              ))}
            </div>
          );
        })()}

      {(normalizedPeriodQuery.error ||
        dashboardQuery.error ||
        saldoGrupoQuery.error ||
        dashboardAlertsQuery.error) && (
        <div
          className="audit-note"
          style={{ background: "var(--alert-soft)", color: "var(--alert)", marginBottom: 12 }}
        >
          {
            (
              normalizedPeriodQuery.error ??
              dashboardQuery.error ??
              saldoGrupoQuery.error ??
              dashboardAlertsQuery.error
            )?.message
          }
        </div>
      )}
      {(normalizedPeriodQuery.isLoading ||
        dashboardQuery.isLoading ||
        saldoGrupoQuery.isLoading ||
        dashboardAlertsQuery.isLoading) && (
        <div className="muted small" style={{ marginBottom: 12 }}>
          Carregando…
        </div>
      )}

      <div className="card card-yellow" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-target"></use>
            </svg>{" "}
            {isGroupView
              ? "Resumo do período — meta do grupo"
              : "Resumo do período — meta da Matriz"}
          </h3>
          <span className="small muted">atualizado agora</span>
        </div>
        <div className="card-b" style={{ paddingTop: 14 }}>
          <div className="summary-chips" style={{ marginBottom: 0 }}>
            <div
              className="sum-chip"
              style={{ cursor: "pointer" }}
              onClick={() =>
                navigate({
                  to: "/operacao/vendas",
                  search: {
                    inicio: normalizedPeriod?.inicio,
                    fim: normalizedPeriod?.fim,
                    tab: "transmissao",
                  },
                })
              }
            >
              <span className="sc-val">{pendenteSeguradoraCount}</span>
              <span className="sc-lbl">Pendente da seguradora</span>
            </div>
            <div
              className="sum-chip alert"
              style={{ cursor: "pointer" }}
              onClick={() => navigate({ to: "/comando/leads" })}
            >
              <span className="sc-val">{semAtendimento.length}</span>
              <span className="sc-lbl">Leads sem atendimento</span>
            </div>
            <div
              className="sum-chip"
              style={{ cursor: "pointer" }}
              onClick={() => navigate({ to: "/comando/leads" })}
            >
              <span className="sc-val">{slaEstourado.length}</span>
              <span className="sc-lbl">SLA estourado</span>
            </div>
            <div className="sum-chip info">
              <span className="sc-val">{fechadosHoje.length}</span>
              <span className="sc-lbl">Fechados no período</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-h">
          <h3>
            <svg width="16" height="16">
              <use href="#i-gauge"></use>
            </svg>{" "}
            Speed-to-lead — velocidade de resposta
          </h3>
          <button className="btn-link btn-sm" onClick={() => navigate({ to: "/comando/leads" })}>
            Abrir Central de Leads
          </button>
        </div>
        <div className="card-b" style={{ paddingTop: 14 }}>
          <div className="summary-chips" style={{ marginBottom: 0 }}>
            <div
              className="sum-chip alert"
              style={{ cursor: "pointer" }}
              onClick={() => navigate({ to: "/comando/leads" })}
            >
              <span className="sc-val">{fmtDur(oldestSec)}</span>
              <span className="sc-lbl">Mais antigo sem distribuir</span>
            </div>
            <div className="sum-chip">
              <span className="sc-val">{fmtDur(avgDistSec)}</span>
              <span className="sc-lbl">Tempo médio até distribuir</span>
            </div>
            <div className={`sum-chip ${sub3min >= 70 ? "ok" : "alert"}`}>
              <span className="sc-val">{sub3min}%</span>
              <span className="sc-lbl">Distribuídos em &lt; 3 min</span>
            </div>
            <div className="sum-chip">
              <span className="sc-val">{fmtDur(avg1Contato)}</span>
              <span className="sc-lbl">Tempo médio 1º contato</span>
            </div>
          </div>
          <p className="small muted" style={{ margin: "12px 0 0" }}>
            Lead de campanha é onde está o maior custo e a menor conversão. Quanto mais rápido
            distribuir e atender, mais barato e mais conversão.{" "}
            <strong>Meta: distribuir em até 3 min.</strong>
          </p>
        </div>
      </div>

      <div className="mkpi-grid">
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-layers"></use>
            </svg>
          </div>
          <div className="lbl">LEADS RECEBIDOS</div>
          <div className="val">{recebidosMes}</div>
          <div className="meta">no período selecionado</div>
        </div>
        <div className="kpi k-info">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-share"></use>
            </svg>
          </div>
          <div className="lbl">LEADS DISTRIBUÍDOS</div>
          <div className="val">{distribuidosMes}</div>
          <div className="meta">
            {recebidosMes ? Math.round((distribuidosMes / recebidosMes) * 100) : 0}% da fila
          </div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-alert-triangle"></use>
            </svg>
          </div>
          <div className="lbl">SEM ATENDIMENTO</div>
          <div className="val">{semAtendimento.length}</div>
          <div className="meta">precisam de ação imediata</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-clock"></use>
            </svg>
          </div>
          <div className="lbl">TEMPO MÉD. 1º CONTATO</div>
          <div className="val">{(avg1Contato / 60).toFixed(1)} min</div>
          <div className="meta">no período</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-check-circle"></use>
            </svg>
          </div>
          <div className="lbl">VENDAS EMITIDAS</div>
          <div className="val">{emitidasMes.length}</div>
          <div className="meta">propostas geradas + transmitidas</div>
        </div>
        <div className="kpi k-ok">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-dollar"></use>
            </svg>
          </div>
          <div className="lbl">VENDAS PAGAS</div>
          <div className="val">{pagasMes.length}</div>
          <div className="meta">
            {emitidasMes.length ? Math.round((pagasMes.length / emitidasMes.length) * 100) : 0}% das
            emitidas
          </div>
        </div>
        <div className="kpi k-alert">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-tag"></use>
            </svg>
          </div>
          <div className="lbl">VENDAS NÃO PAGAS</div>
          <div className="val">{Math.max(0, naoPagasMes)}</div>
          <div className="meta">aguardando baixa financeira</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-percent"></use>
            </svg>
          </div>
          <div className="lbl">CONVERSÃO GERAL</div>
          <div className="val">{convMes}%</div>
          <div className="meta">emitidas / recebidos</div>
        </div>
        <div className="kpi">
          <div className="ic-wrap">
            <svg width="20" height="20">
              <use href="#i-dollar"></use>
            </svg>
          </div>
          <div className="lbl">PRÊMIO PAGO</div>
          <div className="val">{BRL(comissaoMes)}</div>
          <div className="meta">somatório das transmitidas</div>
        </div>
        {isGroupView && !isFranqFull && (
          <div className="kpi">
            <div className="ic-wrap">
              <svg width="20" height="20">
                <use href="#i-dollar"></use>
              </svg>
            </div>
            <div className="lbl">COMISSÃO DO GRUPO</div>
            <div className="val">{saldoGrupo ? BRL(saldoGrupo.saldo) : "—"}</div>
            <div className="meta">
              {saldoGrupo
                ? saldoGrupo.quantidade > 0
                  ? `${saldoGrupo.quantidade} lançamento(s) no período · ${groupPct}% sobre a equipe`
                  : `sem lançamentos no período · ${groupPct}% sobre a equipe`
                : `sem lançamentos no período · ${groupPct}% sobre a equipe`}
            </div>
          </div>
        )}
      </div>

      <ChannelFunnels
        funnels={channelFunnelsQuery.data ?? []}
        periodLabel={periodLabel}
        isLoading={normalizedPeriodQuery.isLoading || channelFunnelsQuery.isLoading}
        error={channelFunnelsQuery.error}
      />

      <div className="dash-grid">
        <div className="col">
          <div className="card chart-card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-trending-up"></use>
                </svg>{" "}
                Evolução no período
              </h3>
              <div className="mchart-legend">
                <span className="it">
                  <span className="dot" style={{ background: "var(--slate)" }}></span>Emitidas
                </span>
                <span className="it">
                  <span className="dot" style={{ background: "var(--yellow)" }}></span>Pagas
                </span>
              </div>
            </div>
            <div className="card-b">
              <svg
                viewBox="0 0 560 200"
                width="100%"
                height={200}
                preserveAspectRatio="xMidYMid meet"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                  const y = 178 - p * 164;
                  return (
                    <g key={i}>
                      <line
                        x1={30}
                        y1={y}
                        x2={560}
                        y2={y}
                        stroke="var(--border-soft)"
                        strokeWidth={1}
                      />
                      <text x={2} y={y + 3} fontSize={9} fill="var(--muted)">
                        {Math.round(maxEvol * p)}
                      </text>
                    </g>
                  );
                })}
                {evol.map((m, i) => {
                  const colW = (560 - 40) / evol.length;
                  const x0 = 40 + i * colW;
                  const he = (m.emitidas / maxEvol) * 164;
                  const hp = (m.pagas / maxEvol) * 164;
                  return (
                    <g key={i}>
                      <rect x={x0} y={178 - he} width={22} height={he} rx={4} fill="var(--slate)" />
                      <rect
                        x={x0 + 24}
                        y={178 - hp}
                        width={22}
                        height={hp}
                        rx={4}
                        fill="var(--yellow)"
                      />
                      <text
                        x={x0 + 23}
                        y={196}
                        textAnchor="middle"
                        fontSize={11}
                        fill="var(--muted)"
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="card card-yellow">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-bolt"></use>
                </svg>{" "}
                {isGroupView ? "Alertas do grupo" : "Alertas críticos do dia"}
              </h3>
              <span className="chip chip-alert">
                {dashboardAlerts.length} pendência{dashboardAlerts.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="card-b">
              {dashboardAlertsQuery.error ? (
                <div className="audit-note" style={{ color: "var(--alert)" }} role="alert">
                  Não foi possível carregar os alertas: {dashboardAlertsQuery.error.message}
                </div>
              ) : (
                <DashboardAlerts
                  alerts={dashboardAlerts}
                  navigate={navigate}
                  isLoading={dashboardAlertsQuery.isLoading}
                />
              )}
            </div>
          </div>
        </div>

        <div className="col">
          {!isFranqFull && (
            <div className="card">
              <div className="card-h">
                <h3>
                  <svg width="16" height="16">
                    <use href="#i-award"></use>
                  </svg>{" "}
                  {isGroupView ? "Franquias supervisionadas" : "Ranking de franquias"}
                </h3>
                <button
                  className="btn-link btn-sm"
                  onClick={() => navigate({ to: "/operacao/franquias" })}
                >
                  Ver todas
                </button>
              </div>
              <div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {rankFranq.slice(0, 8).map((r, i) => (
                  <div key={r.id} className="rank-row">
                    <div className={`rank-pos ${i === 0 ? "top" : ""}`}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rk-name">{r.nome}</div>
                      <div className="rk-sub">
                        {r.leads} leads · conv. {r.conv}%
                      </div>
                    </div>
                    <div className="rk-val">
                      {r.vendas} <small>vendas</small>
                    </div>
                  </div>
                ))}
                {rankFranq.length === 0 && (
                  <div className="muted small" style={{ padding: 12 }}>
                    Sem franquias cadastradas.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-h">
              <h3>
                <svg width="16" height="16">
                  <use href="#i-users"></use>
                </svg>{" "}
                Ranking de vendedores
              </h3>
              <button
                className="btn-link btn-sm"
                onClick={() => navigate({ to: "/operacao/vendedores" })}
              >
                Ver todos
              </button>
            </div>
            <div className="card-b" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {rankVend.map((r, i) => (
                <div key={r.id} className="rank-row">
                  <div className={`rank-pos ${i === 0 ? "top" : ""}`}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rk-name">{r.nome}</div>
                    <div className="rk-sub">
                      {r.franq} · conv. {r.conv}%
                    </div>
                  </div>
                  <div className="rk-val">
                    {r.vendas} <small>vendas</small>
                  </div>
                </div>
              ))}
              {rankVend.length === 0 && (
                <div className="muted small" style={{ padding: 12 }}>
                  Ainda não há atividade de vendedores no período.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
