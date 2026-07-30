import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardAlerts } from "@/components/comando/dashboard-alerts";
import {
  buildDashboardAlerts,
  dashboardDestinationPeriodSchema,
  leadsAlertSearchSchema,
  renewalsAlertSearchSchema,
  salesAlertSearchSchema,
} from "@/lib/dashboard-alerts";

const inicio = "2026-07-01T00:00:00.000Z";
const fim = "2026-08-01T00:00:00.000Z";

describe("alertas reais da Visão geral", () => {
  it("deriva somente estados persistidos e aplica período apenas aos alertas temporais", () => {
    const alerts = buildDashboardAlerts({
      inicio,
      fim,
      now: new Date("2026-07-29T12:00:00.000Z").getTime(),
      leads: [
        {
          status_pipeline: "novo",
          ultimo_atendimento_em: null,
          bloqueado: false,
          arquivado: false,
          criado_em: "2026-07-29T11:50:00.000Z",
        },
      ],
      proposals: [
        {
          emitida_em: "2026-07-10T00:00:00.000Z",
          pago_em: null,
          cancelada_em: null,
          vencimento: null,
        },
        {
          emitida_em: "2026-06-10T00:00:00.000Z",
          pago_em: null,
          cancelada_em: "2026-07-12T00:00:00.000Z",
          vencimento: null,
        },
        {
          emitida_em: null,
          pago_em: null,
          cancelada_em: null,
          vencimento: "2026-07-30T00:00:00.000Z",
        },
      ],
    });

    expect(alerts.map(({ kind }) => kind)).toEqual([
      "sem-atendimento",
      "sla-estourado",
      "vendas-nao-pagas",
      "estornos",
      "renovacoes",
    ]);
    expect(alerts.slice(0, 2).every((alert) => !alert.search.inicio && !alert.search.fim)).toBe(
      true,
    );
    expect(
      alerts.slice(2).every((alert) => alert.search.inicio === inicio && alert.search.fim === fim),
    ).toBe(true);
    expect(alerts.some(({ title }) => title.includes("seguradora"))).toBe(false);
  });

  it("não conta venda paga/cancelada, renovação cancelada ou registro fora da janela", () => {
    const alerts = buildDashboardAlerts({
      inicio,
      fim,
      now: new Date("2026-07-29T12:00:00.000Z").getTime(),
      leads: [],
      proposals: [
        {
          emitida_em: "2026-07-10T00:00:00.000Z",
          pago_em: "2026-07-11T00:00:00.000Z",
          cancelada_em: null,
          vencimento: null,
        },
        {
          emitida_em: "2026-07-10T00:00:00.000Z",
          pago_em: null,
          cancelada_em: "2026-07-11T00:00:00.000Z",
          vencimento: "2026-07-20T00:00:00.000Z",
        },
        {
          emitida_em: "2026-08-10T00:00:00.000Z",
          pago_em: null,
          cancelada_em: null,
          vencimento: null,
        },
      ],
    });

    expect(alerts.map(({ kind }) => kind)).toEqual(["estornos"]);
  });

  it("considera início inclusivo e fim exclusivo em todos os alertas temporais", () => {
    const alerts = buildDashboardAlerts({
      inicio,
      fim,
      now: new Date("2026-08-01T12:00:00.000Z").getTime(),
      leads: [],
      proposals: [
        {
          emitida_em: inicio,
          pago_em: null,
          cancelada_em: null,
          vencimento: fim,
        },
        {
          emitida_em: fim,
          pago_em: null,
          cancelada_em: fim,
          vencimento: null,
        },
        {
          emitida_em: null,
          pago_em: null,
          cancelada_em: null,
          vencimento: inicio,
        },
      ],
    });

    expect(alerts.map(({ kind, count }) => [kind, count])).toEqual([
      ["vendas-nao-pagas", 1],
      ["renovacoes", 1],
    ]);
  });

  it("só conta como sem atendimento e SLA lead novo, atual e ainda sem contato", () => {
    const leadBase = {
      status_pipeline: "novo",
      ultimo_atendimento_em: null,
      bloqueado: false,
      arquivado: false,
      criado_em: "2026-07-29T11:00:00.000Z",
    };
    const alerts = buildDashboardAlerts({
      inicio,
      fim,
      now: new Date("2026-07-29T12:00:00.000Z").getTime(),
      slaSeconds: 180,
      leads: [
        leadBase,
        { ...leadBase, status_pipeline: "contato" },
        { ...leadBase, ultimo_atendimento_em: "2026-07-29T11:01:00.000Z" },
        { ...leadBase, bloqueado: true },
        { ...leadBase, arquivado: true },
      ],
      proposals: [],
    });

    expect(alerts.map(({ kind, count }) => [kind, count])).toEqual([
      ["sem-atendimento", 1],
      ["sla-estourado", 1],
    ]);
  });

  it("valida filtros tipados de Leads, Vendas, Estornos e Renovações", () => {
    expect(leadsAlertSearchSchema.parse({ inicio, fim, alerta: "sla-estourado" })).toEqual({
      inicio,
      fim,
      alerta: "sla-estourado",
    });
    expect(salesAlertSearchSchema.safeParse({ inicio, fim, tab: "inventada" }).success).toBe(false);
    expect(dashboardDestinationPeriodSchema.parse({ inicio, fim })).toEqual({ inicio, fim });
    expect(renewalsAlertSearchSchema.parse({ inicio, fim })).toEqual({ inicio, fim });
    for (const schema of [
      dashboardDestinationPeriodSchema,
      leadsAlertSearchSchema,
      salesAlertSearchSchema,
      renewalsAlertSearchSchema,
    ]) {
      expect(schema.safeParse({ inicio: "data-inválida", fim }).success).toBe(false);
    }
  });

  it("renderiza alertas como botões nomeados e ícones decorativos", () => {
    const alerts = buildDashboardAlerts({
      inicio,
      fim,
      now: new Date("2026-07-29T12:00:00.000Z").getTime(),
      leads: [
        {
          status_pipeline: "novo",
          ultimo_atendimento_em: null,
          bloqueado: false,
          arquivado: false,
          criado_em: "2026-07-29T11:00:00.000Z",
        },
      ],
      proposals: [],
    });
    const html = renderToStaticMarkup(
      createElement(DashboardAlerts, { alerts, navigate: vi.fn() as never }),
    );

    expect(html).toContain("<button");
    expect(html).toContain('aria-label="1 leads sem atendimento. Agir"');
    expect(html).toContain('aria-hidden="true"');
  });
});
