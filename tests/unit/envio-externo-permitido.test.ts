import { describe, expect, test } from "vitest";
import { envioExternoPermitido } from "@/components/venda/cotacoes/comissao-impressao";

describe("envioExternoPermitido", () => {
  test("com comissão marcada, bloqueia o envio externo", () => {
    expect(envioExternoPermitido({ comComissao: true })).toBe(false);
  });
  test("sem comissão, permite", () => {
    expect(envioExternoPermitido({ comComissao: false })).toBe(true);
  });
});
