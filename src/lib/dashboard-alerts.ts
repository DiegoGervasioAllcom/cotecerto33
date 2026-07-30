import { z } from "zod";

export const dashboardDestinationPeriodSchema = z.object({
  inicio: z.string().datetime().optional(),
  fim: z.string().datetime().optional(),
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
  | "renovacoes";

export type DashboardAlert = {
  kind: DashboardAlertKind;
  count: number;
  icon: string;
  tone: "alert" | "warn" | "info";
  title: string;
  description: string;
  action: string;
  to: "/comando/leads" | "/operacao/vendas" | "/operacao/estornos" | "/operacao/renovacoes";
  search: {
    inicio?: string;
    fim?: string;
    alerta?: "sem-atendimento" | "sla-estourado";
    tab?: "naopagas";
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
  ];

  return alerts.filter((alert): alert is DashboardAlert => alert !== null);
}
