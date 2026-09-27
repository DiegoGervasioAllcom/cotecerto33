import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lerFocoMotivo,
  parseFoco,
  removerFocoMotivo,
  salvarFocoMotivo,
  serializeFoco,
} from "@/lib/use-foco-ao-chegar";

describe("parseFoco (unitário puro — foco=<fonte>:<id>)", () => {
  it("aceita as 5 fontes da agenda", () => {
    expect(parseFoco("retorno:abc")).toEqual({ fonte: "retorno", id: "abc" });
    expect(parseFoco("risco:cot-1")).toEqual({ fonte: "risco", id: "cot-1" });
    expect(parseFoco("seguradora:prop-1")).toEqual({ fonte: "seguradora", id: "prop-1" });
    expect(parseFoco("aprovacao:sol-1")).toEqual({ fonte: "aprovacao", id: "sol-1" });
    expect(parseFoco("lembrete:lem-1")).toEqual({ fonte: "lembrete", id: "lem-1" });
  });

  it("aceita 'transmissao' — não é fonte da agenda (não entra em FonteAgenda/contarPorFonte), só mais uma origem de foco (pós-Etapa 7)", () => {
    expect(parseFoco("transmissao:prop-1")).toEqual({ fonte: "transmissao", id: "prop-1" });
  });

  it("mantém o id intacto mesmo com ':' dentro dele (uuid nunca tem, mas o parser não deve truncar)", () => {
    expect(parseFoco("risco:abc:def")).toEqual({ fonte: "risco", id: "abc:def" });
  });

  it("undefined/vazio não é foco", () => {
    expect(parseFoco(undefined)).toBeNull();
    expect(parseFoco(null)).toBeNull();
    expect(parseFoco("")).toBeNull();
  });

  it("fonte desconhecida é rejeitada — nunca inventa uma fonte", () => {
    expect(parseFoco("pipeline:abc")).toBeNull();
    expect(parseFoco("qualquercoisa:abc")).toBeNull();
  });

  it("sem ':' ou sem id depois dele é inválido", () => {
    expect(parseFoco("risco")).toBeNull();
    expect(parseFoco("risco:")).toBeNull();
    expect(parseFoco(":abc")).toBeNull();
  });
});

describe("serializeFoco", () => {
  it("é o inverso de parseFoco", () => {
    const foco = { fonte: "seguradora" as const, id: "prop-42" };
    expect(parseFoco(serializeFoco(foco))).toEqual(foco);
  });
});

describe("salvarFocoMotivo/lerFocoMotivo (motivo real da faixa — nunca texto inventado)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sessionStorage indisponível (modo privado/cota cheia) não quebra e não lê motivo nenhum", () => {
    // Simula o caso real de storage indisponível — Safari privado e cota
    // cheia lançam ao chamar setItem/getItem, não por a global faltar.
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new DOMException("SecurityError");
      },
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("SecurityError");
      },
    });
    expect(() => salvarFocoMotivo("risco:1", { titulo: "x", texto: "y" })).not.toThrow();
    expect(lerFocoMotivo("risco:1")).toBeNull();
  });

  it("com sessionStorage disponível, grava e lê de volta o motivo real", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });

    const foco = serializeFoco({ fonte: "risco", id: "cot-9" });
    salvarFocoMotivo(foco, { titulo: "Negócio em risco", texto: "Parado há 3 dias" });

    expect(lerFocoMotivo(foco)).toEqual({ titulo: "Negócio em risco", texto: "Parado há 3 dias" });
    // fonte:id diferente não vê o motivo de outro item.
    expect(lerFocoMotivo("risco:outro")).toBeNull();
  });

  it("chave malformada no storage (JSON inválido ou shape errado) cai pra null, nunca inventa texto", () => {
    const store = new Map<string, string>([
      ["cotecerto:foco-motivo:risco:1", "{ isso não é json"],
      ["cotecerto:foco-motivo:risco:2", JSON.stringify({ titulo: 123 })],
    ]);
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });

    expect(lerFocoMotivo("risco:1")).toBeNull();
    expect(lerFocoMotivo("risco:2")).toBeNull();
  });
});

describe("removerFocoMotivo (limpa o motivo ao sair do foco — revisão da V12.3.11)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("remove só a chave do foco encerrado, sem afetar outras", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });

    const focoA = serializeFoco({ fonte: "risco", id: "1" });
    const focoB = serializeFoco({ fonte: "seguradora", id: "2" });
    salvarFocoMotivo(focoA, { titulo: "A", texto: "a" });
    salvarFocoMotivo(focoB, { titulo: "B", texto: "b" });

    removerFocoMotivo(focoA);

    expect(lerFocoMotivo(focoA)).toBeNull();
    expect(lerFocoMotivo(focoB)).toEqual({ titulo: "B", texto: "b" });
  });

  it("sessionStorage indisponível não quebra (best-effort, mesmo espírito de salvarFocoMotivo)", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new DOMException("SecurityError");
      },
      setItem: () => {
        throw new DOMException("QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("SecurityError");
      },
    });
    expect(() => removerFocoMotivo("risco:1")).not.toThrow();
  });
});
