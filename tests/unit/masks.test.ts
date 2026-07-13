import { describe, it, expect } from "vitest";
import { maskBRL, parseBRL, formatBRL, formatPct, maskPct, parsePct, applyMask } from "@/lib/masks";

// Smoke do runner + alias @/ — roda offline, sem banco.
describe("masks (unitário puro)", () => {
  it("maskBRL formata dígitos como moeda", () => {
    expect(maskBRL("123456")).toContain("1.234,56");
  });
  it("parseBRL inverte a formatação", () => {
    expect(parseBRL(maskBRL("123456"))).toBe(1234.56);
  });
  it("formatBRL lida com null/undefined sem quebrar", () => {
    expect(() => formatBRL(null)).not.toThrow();
    expect(() => formatBRL(undefined)).not.toThrow();
  });
  it("pct: mask e parse são consistentes", () => {
    expect(maskPct("15,5")).toBe("15,5%");
    expect(parsePct("15,5%")).toBeCloseTo(15.5);
    expect(maskPct("")).toBe("");
  });
  it("applyMask sem máscara devolve o valor original", () => {
    expect(applyMask("abc", undefined)).toBe("abc");
  });
  it("applyMask roteia para a máscara certa", () => {
    expect(applyMask("123456", "brl")).toBe(maskBRL("123456"));
    expect(applyMask("15,5", "pct")).toBe(maskPct("15,5"));
  });
  it("maskPct trunca em duas casas decimais", () => {
    expect(maskPct("12,3456")).toBe("12,34%");
  });
  it("formatBRL formata número com duas casas", () => {
    expect(formatBRL(1234.5)).toBe("R$ 1.234,50");
    expect(formatBRL(NaN)).toBe(""); // não-finito também vira vazio
  });
  it("formatPct formata número e trata null/não-finito", () => {
    expect(formatPct(15.5)).toBe("15,5%");
    expect(formatPct(null)).toBe("");
    expect(formatPct(Infinity)).toBe("");
  });
});
