import { describe, expect, it } from "vitest";
import {
  PRODUTOS,
  produtoNome,
  produtoPorRamo,
  produtoTemJornada,
} from "@/components/venda/novo-lead/produtos";

describe("catálogo de produtos (tipo de item segurado — V12.3.8)", () => {
  it("tem os 5 produtos do CHECK de `ramo`, na ordem do protótipo", () => {
    expect(PRODUTOS.map((p) => p.ramo)).toEqual([
      "Automóvel",
      "Moto",
      "Vida",
      "Residencial",
      "Celular",
    ]);
  });

  it("só Auto tem jornada pronta", () => {
    expect(produtoTemJornada("auto")).toBe(true);
    expect(produtoTemJornada("moto")).toBe(false);
    expect(produtoTemJornada("vida")).toBe(false);
    expect(produtoTemJornada("resid")).toBe(false);
    expect(produtoTemJornada("celular")).toBe(false);
  });

  it("produtoPorRamo resolve o produto a partir do rótulo gravado em `ramo`", () => {
    expect(produtoPorRamo("Moto")?.id).toBe("moto");
    expect(produtoPorRamo("Residencial")?.id).toBe("resid");
    expect(produtoPorRamo("Inexistente")).toBeUndefined();
  });

  it("produtoNome retorna o nome de exibição ou o próprio id como fallback", () => {
    expect(produtoNome("auto")).toBe("Auto");
    // @ts-expect-error id inválido só pra exercitar o fallback
    expect(produtoNome("xyz")).toBe("xyz");
  });
});
