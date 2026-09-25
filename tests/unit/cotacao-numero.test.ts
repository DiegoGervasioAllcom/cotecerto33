import { describe, expect, it } from "vitest";
import { formatarNumeroCotacao } from "@/lib/cotacao-numero";
import { cotNum } from "@/components/venda/cotacoes/lista-helpers";

describe("formatarNumeroCotacao (fonte única de COT-AAAA-NNNNN)", () => {
  it("usa o ano de CRIAÇÃO da cotação, não o ano corrente", () => {
    expect(formatarNumeroCotacao(155032, "2026-01-15T10:00:00Z")).toBe("COT-2026-155032");
  });

  it("cotação criada em ano anterior mantém o ano antigo, mesmo olhada hoje", () => {
    // "hoje" (data do teste) é 2026 — a cotação foi criada em 2025.
    expect(formatarNumeroCotacao(42, "2025-12-31T23:59:00Z")).toBe("COT-2025-00042");
  });

  it("preenche com zeros à esquerda até 5 dígitos", () => {
    expect(formatarNumeroCotacao(42, "2026-09-25T00:00:00Z")).toBe("COT-2026-00042");
  });

  it("sem número ou sem data de criação, retorna null (rascunho ainda não salvo)", () => {
    expect(formatarNumeroCotacao(null, "2026-01-15T10:00:00Z")).toBeNull();
    expect(formatarNumeroCotacao(42, null)).toBeNull();
  });
});

describe("cotNum (wrapper usado pelas listas Em cotação/negociação/finalização)", () => {
  it("cotação criada em ano anterior aparece com o ano antigo na lista", () => {
    expect(cotNum(9, "2025-06-10T00:00:00Z")).toBe("COT-2025-00009");
  });
});
