import { describe, expect, it } from "vitest";
import {
  customDashboardPeriodSchema,
  defaultCustomPeriod,
  selectCurrentDashboardPeriod,
  selectCustomDashboardPeriod,
} from "@/lib/dashboard-period";

describe("seleção de período da Visão geral", () => {
  it.each([
    ["dia", "Hoje"],
    ["semana", "Últimos 7 dias"],
    ["quinzena", "Últimos 15 dias"],
    ["mes", "Mês atual"],
  ] as const)("mantém o preset %s sem datas calculadas pelo navegador", (preset, label) => {
    expect(selectCurrentDashboardPeriod(preset)).toEqual({ preset, label });
  });

  it("mantém datas civis apenas no período personalizado", () => {
    expect(
      selectCustomDashboardPeriod({
        startDate: "2025-12-30",
        endDate: "2026-01-02",
      }),
    ).toEqual({
      preset: "personalizado",
      startDate: "2025-12-30",
      endDate: "2026-01-02",
      label: "30/12/2025 a 02/01/2026",
    });
  });

  it("gera defaults válidos para o formulário personalizado", () => {
    const values = defaultCustomPeriod(new Date(2026, 6, 29, 12));

    expect(values).toEqual({ startDate: "2026-07-29", endDate: "2026-07-29" });
    expect(customDashboardPeriodSchema.safeParse(values).success).toBe(true);
  });

  it.each([
    [{ startDate: "", endDate: "2026-07-29" }, "Informe uma data inicial válida."],
    [{ startDate: "2026-02-30", endDate: "2026-03-01" }, "Informe uma data inicial válida."],
    [
      { startDate: "2026-07-30", endDate: "2026-07-29" },
      "A data inicial deve ser anterior ou igual à data final.",
    ],
  ])("rejeita formulário personalizado inválido", (values, message) => {
    const result = customDashboardPeriodSchema.safeParse(values);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(message);
    }
  });
});
