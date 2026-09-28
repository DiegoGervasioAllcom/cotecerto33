/**
 * `diasParaExpirar`/`expiraChip` (`@/components/venda/cotacoes/lista-helpers`)
 * — ajuste pós-deploy V12 (item 1): cotação vencida (d < 0) deixou de cair no
 * mesmo "Hoje" de d === 0 e passou a mostrar "Vencida há N dias".
 */
import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { diasParaExpirar, expiraChip } from "@/components/venda/cotacoes/lista-helpers";

const AGORA = new Date("2026-09-28T12:00:00Z");
const DIA_MS = 24 * 60 * 60 * 1000;

function criadoEmParaDias(d: number): string {
  // diasParaExpirar soma 5 dias corridos à criação — inverte essa conta pra
  // obter um `criado_em` cujo prazo restante seja exatamente `d`.
  return new Date(AGORA.getTime() + (d - 5) * DIA_MS).toISOString();
}

function textoChip(el: ReactElement): string {
  const children = (el.props as { children: unknown }).children;
  return Array.isArray(children) ? children.join("") : String(children);
}

function classeChip(el: ReactElement): string {
  return (el.props as { className: string }).className;
}

describe("diasParaExpirar/expiraChip (Cotecerto V12 — ajuste pós-deploy)", () => {
  it("d > 0: mantém o comportamento existente (dias restantes)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const criadoEm = criadoEmParaDias(2);
    expect(diasParaExpirar(criadoEm)).toBe(2);
    const chip = expiraChip(criadoEm) as ReactElement;
    expect(textoChip(chip)).toBe("2d");
    expect(classeChip(chip)).toContain("chip-alert");
    vi.useRealTimers();
  });

  it("d === 0: mostra 'Hoje'", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const criadoEm = criadoEmParaDias(0);
    expect(diasParaExpirar(criadoEm)).toBe(0);
    const chip = expiraChip(criadoEm) as ReactElement;
    expect(textoChip(chip)).toBe("Hoje");
    expect(classeChip(chip)).toContain("chip-alert");
    vi.useRealTimers();
  });

  it("d === -1: 'Vencida há 1 dia' (singular)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const criadoEm = criadoEmParaDias(-1);
    expect(diasParaExpirar(criadoEm)).toBe(-1);
    const chip = expiraChip(criadoEm) as ReactElement;
    expect(textoChip(chip)).toBe("Vencida há 1 dia");
    expect(classeChip(chip)).toContain("chip-alert");
    vi.useRealTimers();
  });

  it("d === -40: 'Vencida há 40 dias' (plural)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    const criadoEm = criadoEmParaDias(-40);
    expect(diasParaExpirar(criadoEm)).toBe(-40);
    const chip = expiraChip(criadoEm) as ReactElement;
    expect(textoChip(chip)).toBe("Vencida há 40 dias");
    expect(classeChip(chip)).toContain("chip-alert");
    vi.useRealTimers();
  });
});
