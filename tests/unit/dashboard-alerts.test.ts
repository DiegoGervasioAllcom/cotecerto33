import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardAlerts } from "@/components/comando/dashboard-alerts";
import {
  buildDashboardAlerts,
  buildDashboardAlertsFromCounts,
  dashboardDestinationPeriodSchema,
  leadsAlertSearchSchema,
  renewalsAlertSearchSchema,
  salesAlertSearchSchema,
  type DashboardAlertCounts,
} from "@/lib/dashboard-alerts";

const inicio = "2026-07-01T00:00:00.000Z";
const fim = "2026-08-01T00:00:00.000Z";

const zeroCounts: DashboardAlertCounts = {
  semAtendimento: 0,
  slaEstourado: 0,
  vendasNaoPagas: 0,
  estornos: 0,
  renovacoes: 0,
  franquiasAbaixoMeta: 0,
  vendedoresAtencao: 0,
  pendentesSeguradora: 0,
};

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

  it("aceita timestamps com offset numérico (não só 'Z'), como os devolvidos por normalizar_periodo_visao_geral", () => {
    // Bug ao vivo encontrado testando V11.7.6c no navegador: sem `offset: true`
    // no z.string().datetime(), a navegação para Vendas/Estornos/Renovações
    // quebrava com "Não foi possível carregar esta página" sempre que o
    // período normalizado vinha com offset (`+00:00`) em vez de `Z`.
    const inicioComOffset = "2026-07-01T03:00:00+00:00";
    const fimComOffset = "2026-08-01T03:00:00+00:00";
    for (const schema of [
      dashboardDestinationPeriodSchema,
      leadsAlertSearchSchema,
      salesAlertSearchSchema,
      renewalsAlertSearchSchema,
    ]) {
      expect(schema.safeParse({ inicio: inicioComOffset, fim: fimComOffset }).success).toBe(true);
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

describe("alertas V11.7.6b/7.6c (franquia abaixo da meta, vendedor em atenção, pendência da seguradora)", () => {
  it("não aparecem quando a contagem é zero", () => {
    const alerts = buildDashboardAlertsFromCounts({ counts: zeroCounts, inicio, fim });

    expect(alerts.map(({ kind }) => kind)).toEqual([]);
  });

  it("aparecem quando a contagem é maior que zero, com destino e busca corretos", () => {
    const alerts = buildDashboardAlertsFromCounts({
      counts: {
        ...zeroCounts,
        franquiasAbaixoMeta: 2,
        vendedoresAtencao: 3,
        pendentesSeguradora: 5,
      },
      inicio,
      fim,
    });

    expect(alerts.map(({ kind, count }) => [kind, count])).toEqual([
      ["franquias-abaixo-meta", 2],
      ["vendedores-atencao", 3],
      ["pendentes-seguradora", 5],
    ]);

    const franquias = alerts.find((a) => a.kind === "franquias-abaixo-meta");
    expect(franquias?.to).toBe("/operacao/franquias");
    expect(franquias?.search).toEqual({});

    const vendedores = alerts.find((a) => a.kind === "vendedores-atencao");
    expect(vendedores?.to).toBe("/operacao/acessos");
    expect(vendedores?.search).toEqual({});

    const seguradora = alerts.find((a) => a.kind === "pendentes-seguradora");
    expect(seguradora?.to).toBe("/operacao/vendas");
    expect(seguradora?.search).toEqual({ inicio, fim, tab: "transmissao" });
  });

  it("cada alerta novo aparece isoladamente quando só a sua contagem é positiva", () => {
    expect(
      buildDashboardAlertsFromCounts({
        counts: { ...zeroCounts, franquiasAbaixoMeta: 1 },
        inicio,
        fim,
      }).map(({ kind }) => kind),
    ).toEqual(["franquias-abaixo-meta"]);

    expect(
      buildDashboardAlertsFromCounts({
        counts: { ...zeroCounts, vendedoresAtencao: 1 },
        inicio,
        fim,
      }).map(({ kind }) => kind),
    ).toEqual(["vendedores-atencao"]);

    expect(
      buildDashboardAlertsFromCounts({
        counts: { ...zeroCounts, pendentesSeguradora: 1 },
        inicio,
        fim,
      }).map(({ kind }) => kind),
    ).toEqual(["pendentes-seguradora"]);
  });

  it("buildDashboardAlerts (heurística client-side) nunca gera os 3 alertas novos", () => {
    const alerts = buildDashboardAlerts({
      inicio,
      fim,
      now: new Date("2026-07-29T12:00:00.000Z").getTime(),
      leads: [],
      proposals: [],
    });

    expect(alerts.some(({ kind }) => (kind as string).includes("franquias"))).toBe(false);
    expect(alerts.some(({ kind }) => (kind as string).includes("vendedores"))).toBe(false);
    expect(alerts.some(({ kind }) => (kind as string).includes("pendentes"))).toBe(false);
  });
});
