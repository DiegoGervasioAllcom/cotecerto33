import { describe, expect, it } from "vitest";
import { bannerDispensado, dispensarBanner, ehDispositivoMobile } from "@/lib/banner-mobile";

const mem = () => {
  const d: Record<string, string> = {};
  return {
    getItem: (k: string) => d[k] ?? null,
    setItem: (k: string, v: string) => void (d[k] = v),
  };
};

describe("banner mobile", () => {
  it("dispensar persiste", () => {
    const s = mem();
    expect(bannerDispensado(s)).toBe(false);
    dispensarBanner(s);
    expect(bannerDispensado(s)).toBe(true);
  });
  it("tolera storage ausente ou que lança", () => {
    const quebra = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
    };
    expect(bannerDispensado(null)).toBe(false);
    expect(bannerDispensado(quebra)).toBe(false);
    expect(() => dispensarBanner(quebra)).not.toThrow();
  });
  it("detecta viewport estreita ou touch", () => {
    expect(ehDispositivoMobile((q) => ({ matches: q.includes("max-width") }))).toBe(true);
    expect(ehDispositivoMobile((q) => ({ matches: q.includes("pointer") }))).toBe(true);
    expect(ehDispositivoMobile(() => ({ matches: false }))).toBe(false);
  });
});
