import { describe, expect, it } from "vitest";
import {
  bannerDispensado,
  deveRedirecionar,
  dispensarBanner,
  ehDispositivoMobile,
  lerPreferenciaVersao,
  preferirVersaoCompleta,
  limparPreferenciaVersao,
} from "@/lib/banner-mobile";

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

describe("deveRedirecionar", () => {
  const base = {
    mobile: true,
    preferencia: null,
    jaRedirecionouNaSessao: false,
    pathname: "/inicio",
  } as const;
  it("redireciona no mobile na landing e na raiz", () => {
    expect(deveRedirecionar(base)).toBe(true);
    expect(deveRedirecionar({ ...base, pathname: "/" })).toBe(true);
    expect(deveRedirecionar({ ...base, pathname: "/comando/visao-geral" })).toBe(true);
  });
  it("desktop não redireciona", () => {
    expect(deveRedirecionar({ ...base, mobile: false })).toBe(false);
  });
  it("preferência completa não redireciona", () => {
    expect(deveRedirecionar({ ...base, preferencia: "completa" })).toBe(false);
  });
  it("não repete na mesma sessão", () => {
    expect(deveRedirecionar({ ...base, jaRedirecionouNaSessao: true })).toBe(false);
  });
  it("deep link, auth, convite e /m não redirecionam", () => {
    for (const pathname of ["/venda/cotacoes/abc", "/auth", "/convite/x", "/m/cotacoes"]) {
      expect(deveRedirecionar({ ...base, pathname })).toBe(false);
    }
  });
});

describe("preferência de versão", () => {
  it("grava, lê e limpa", () => {
    const d: Record<string, string> = {};
    const s = {
      getItem: (k: string) => d[k] ?? null,
      setItem: (k: string, v: string) => void (d[k] = v),
      removeItem: (k: string) => void delete d[k],
    };
    expect(lerPreferenciaVersao(s)).toBeNull();
    preferirVersaoCompleta(s);
    expect(lerPreferenciaVersao(s)).toBe("completa");
    limparPreferenciaVersao(s);
    expect(lerPreferenciaVersao(s)).toBeNull();
  });
  it("storage indisponível ou que lança não quebra", () => {
    const ruim = {
      getItem: () => {
        throw new Error("x");
      },
      setItem: () => {
        throw new Error("x");
      },
      removeItem: () => {
        throw new Error("x");
      },
    };
    expect(() => preferirVersaoCompleta(ruim)).not.toThrow();
    expect(() => limparPreferenciaVersao(ruim)).not.toThrow();
    expect(lerPreferenciaVersao(ruim)).toBeNull();
    expect(lerPreferenciaVersao(null)).toBeNull();
  });
});
