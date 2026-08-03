import { z } from "zod";

export const dashboardDestinationPeriodSchema = z.object({
  // `offset: true` — bug ao vivo encontrado ao testar o alerta novo
  // "pendentes-seguradora" (V11.7.6c): `normalizar_periodo_visao_geral`
  // devolve timestamps com offset numérico (`+00:00`), não só `Z`; sem
  // `offset: true`, o zod rejeitava a busca inteira e as telas de destino
  // (Vendas, Estornos, Renovações) quebravam com "Não foi possível carregar
  // esta página". Bug pré-existente (afetava também vendas-nao-pagas,
  // estornos, renovacoes, sem-atendimento, sla-estourado), não introduzido
  // por esta rodada — corrigido aqui porque está no mesmo arquivo/schema.
  inicio: z.string().datetime({ offset: true }).optional(),
  fim: z.string().datetime({ offset: true }).optional(),
});

export const leadsAlertSearchSchema = dashboardDestinationPeriodSchema.extend({
  alerta: z.enum(["sem-atendimento", "sla-estourado"]).optional(),
});

export const salesAlertSearchSchema = dashboardDestinationPeriodSchema.extend({
  tab: z.enum(["transmissao", "emitidas", "pagas", "naopagas", "canceladas"]).optional(),
});

export const renewalsAlertSearchSchema = dashboardDestinationPeriodSchema;

export type DashboardAlertKind =
  | "sem-atendimento"
  | "sla-estourado"
  | "vendas-nao-pagas"
  | "estornos"
  | "renovacoes"
  | "franquias-abaixo-meta"
  | "vendedores-atencao"
  | "pendentes-seguradora";

export type DashboardAlert = {
  kind: DashboardAlertKind;
  count: number;
  icon: string;
  tone: "alert" | "warn" | "info";
  title: string;
  description: string;
  action: string;
  to:
    | "/comando/leads"
    | "/operacao/vendas"
    | "/operacao/estornos"
    | "/operacao/renovacoes"
    | "/operacao/franquias"
    | "/operacao/acessos";
  search: {
    inicio?: string;
    fim?: string;
    alerta?: "sem-atendimento" | "sla-estourado";
    tab?: "naopagas" | "transmissao";
  };
};

export type AlertLead = {
  status_pipeline: string;
  ultimo_atendimento_em: string | null;
  bloqueado: boolean | null;
  arquivado: boolean | null;
  criado_em: string;
};

export type AlertProposal = {
  emitida_em: string | null;
  pago_em: string | null;
  cancelada_em: string | null;
  vencimento: string | null;
};

export type DashboardAlertCounts = {
  semAtendimento: number;
  slaEstourado: number;
  vendasNaoPagas: number;
  estornos: number;
  renovacoes: number;
  // V11.7.6b/7.6c — os 3 alertas abaixo só existem via RPC/consulta de servidor
  // (franquia por meta pró-rata, performance_status de profiles, pendência da
  // seguradora); `buildDashboardAlerts` (heurística client-side, leads+propostas
  // já carregados) não tem como derivá-los, então sempre manda 0 para eles.
  franquiasAbaixoMeta: number;
  vendedoresAtencao: number;
  pendentesSeguradora: number;
};

const inWindow = (value: string | null, inicio: string, fim: string) => {
  if (value === null) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= new Date(inicio).getTime() && timestamp < new Date(fim).getTime();
};

export function buildDashboardAlerts({
  leads,
  proposals,
  inicio,
  fim,
  now,
  slaSeconds = 180,
}: {
  leads: AlertLead[];
  proposals: AlertProposal[];
  inicio: string;
  fim: string;
  now: number;
  slaSeconds?: number;
}): DashboardAlert[] {
  const activeNewLeads = leads.filter(
    (lead) =>
      !lead.arquivado &&
      !lead.bloqueado &&
      lead.status_pipeline === "novo" &&
      !lead.ultimo_atendimento_em,
  );
  const slaOver = activeNewLeads.filter(
    (lead) => (now - new Date(lead.criado_em).getTime()) / 1000 > slaSeconds,
  );
  const unpaid = proposals.filter(
    (proposal) =>
      inWindow(proposal.emitida_em, inicio, fim) && !proposal.pago_em && !proposal.cancelada_em,
  );
  const reversals = proposals.filter((proposal) => inWindow(proposal.cancelada_em, inicio, fim));
  const renewals = proposals.filter(
    (proposal) => inWindow(proposal.vencimento, inicio, fim) && !proposal.cancelada_em,
  );
  return buildDashboardAlertsFromCounts({
    counts: {
      semAtendimento: activeNewLeads.length,
      slaEstourado: slaOver.length,
      vendasNaoPagas: unpaid.length,
      estornos: reversals.length,
      renovacoes: renewals.length,
      // Sem dado client-side equivalente — ver comentário em DashboardAlertCounts.
      franquiasAbaixoMeta: 0,
      vendedoresAtencao: 0,
      pendentesSeguradora: 0,
    },
    inicio,
    fim,
  });
}

export function buildDashboardAlertsFromCounts({
  counts,
  inicio,
  fim,
}: {
  counts: DashboardAlertCounts;
  inicio: string;
  fim: string;
}): DashboardAlert[] {
  const period = { inicio, fim };
  const {
    semAtendimento: activeNewLeads,
    slaEstourado: slaOver,
    vendasNaoPagas: unpaid,
    estornos: reversals,
    renovacoes: renewals,
    franquiasAbaixoMeta,
    vendedoresAtencao,
    pendentesSeguradora,
  } = counts;

  const alerts: (DashboardAlert | null)[] = [
    activeNewLeads
      ? {
          kind: "sem-atendimento" as const,
          count: activeNewLeads,
          icon: "i-alert-triangle",
          tone: "alert" as const,
          title: `${activeNewLeads} leads sem atendimento`,
          description: "Aguardando distribuição ou 1º contato",
          action: "Agir",
          to: "/comando/leads" as const,
          search: { alerta: "sem-atendimento" as const },
        }
      : null,
    slaOver
      ? {
          kind: "sla-estourado" as const,
          count: slaOver,
          icon: "i-clock",
          tone: "alert" as const,
          title: `${slaOver} leads com SLA estourado`,
          description: "Redistribuir os leads sem reação",
          action: "Urgente",
          to: "/comando/leads" as const,
          search: { alerta: "sla-estourado" as const },
        }
      : null,
    unpaid
      ? {
          kind: "vendas-nao-pagas" as const,
          count: unpaid,
          icon: "i-dollar",
          tone: "warn" as const,
          title: `${unpaid} vendas emitidas e não pagas`,
          description: "Acompanhar baixa financeira no período",
          action: "Cobrar",
          to: "/operacao/vendas" as const,
          search: { ...period, tab: "naopagas" as const },
        }
      : null,
    reversals
      ? {
          kind: "estornos" as const,
          count: reversals,
          icon: "i-refresh",
          tone: "info" as const,
          title: `${reversals} estornos no período`,
          description: "Revisar motivos e comissão vinculada",
          action: "Revisar",
          to: "/operacao/estornos" as const,
          search: period,
        }
      : null,
    renewals
      ? {
          kind: "renovacoes" as const,
          count: renewals,
          icon: "i-history",
          tone: "warn" as const,
          title: `${renewals} renovações a vencer`,
          description: "Apólices vencendo no período selecionado",
          action: "Acompanhar",
          to: "/operacao/renovacoes" as const,
          search: period,
        }
      : null,
    // V11.7.6b — sem filtro dedicado na tela de Franquias (fora de escopo desta
    // rodada, ver PLANO_VISAO_GERAL_V11.md); o alerta só leva para a listagem,
    // onde o `statusChip`/meta de cada franquia já fica visível.
    franquiasAbaixoMeta
      ? {
          kind: "franquias-abaixo-meta" as const,
          count: franquiasAbaixoMeta,
          icon: "i-building",
          tone: "warn" as const,
          title: `${franquiasAbaixoMeta} franquia(s) abaixo da meta`,
          description: "Vendas emitidas no período abaixo da meta pró-rata",
          action: "Revisar",
          to: "/operacao/franquias" as const,
          search: {},
        }
      : null,
    // V11.7.6b — sem deep-link para a sub-aba "Cadastros" (Acessos e permissões
    // tem estados de aba independentes para Interno/Externo, sem suporte a
    // busca por URL); o alerta leva para a tela, onde o selo de performance de
    // cada pessoa já aparece nas abas Cadastros Matriz/Rede.
    vendedoresAtencao
      ? {
          kind: "vendedores-atencao" as const,
          count: vendedoresAtencao,
          icon: "i-users",
          tone: "warn" as const,
          title: `${vendedoresAtencao} vendedor(es) em atenção ou travado`,
          description: "Performance abaixo da régua — acompanhar cadastro",
          action: "Acompanhar",
          to: "/operacao/acessos" as const,
          search: {},
        }
      : null,
    // V11.7.6c — reaproveita a mesma RPC do chip "Pendente da seguradora" da
    // Visão geral. Leva para a aba "Transmissão" de Controle de Vendas; essa
    // aba ainda não distingue "não enviada" de "pendente da seguradora"
    // internamente (fora de escopo, ver risco #1 do plano), então não há
    // filtro adicional a passar além da aba.
    pendentesSeguradora
      ? {
          kind: "pendentes-seguradora" as const,
          count: pendentesSeguradora,
          icon: "i-shield",
          tone: "info" as const,
          title: `${pendentesSeguradora} venda(s) pendente(s) da seguradora`,
          description: "Transmitida, aguardando emissão da apólice",
          action: "Acompanhar",
          to: "/operacao/vendas" as const,
          search: { ...period, tab: "transmissao" as const },
        }
      : null,
  ];

  return alerts.filter((alert): alert is DashboardAlert => alert !== null);
}
