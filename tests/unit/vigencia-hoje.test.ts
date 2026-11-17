import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { vigenciaAPartirDeHoje } from "@/components/venda/novo-lead/steps/StepSeguro";

// Fuso do Brasil (UTC-3): 23h30 local já é o dia seguinte em UTC, o caso do defeito antigo.
const TZ_ORIGINAL = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/Sao_Paulo";
  return () => {
    if (TZ_ORIGINAL === undefined) delete process.env.TZ;
    else process.env.TZ = TZ_ORIGINAL;
  };
});
afterEach(() => vi.useRealTimers());

describe("vigenciaAPartirDeHoje", () => {
  test("anual: começa hoje e termina um ano depois, menos um dia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 10, 0, 0));
    expect(vigenciaAPartirDeHoje(1)).toEqual({ ini: "2026-11-17", fim: "2027-11-16" });
  });

  test("à noite (horário local) continua sendo o dia de hoje, sem virar para amanhã em UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 17, 23, 30, 0));
    expect(vigenciaAPartirDeHoje(1).ini).toBe("2026-11-17");
  });
});
