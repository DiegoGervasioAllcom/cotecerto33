import { describe, it, expect } from "vitest";
import { onlyDigits, maskCpfCnpj, maskTelefone, maskCep } from "@/lib/masks";

// Format-agnósticas: strip-and-remask. Devem ser idempotentes (aplicar 2x = 1x)
// e funcionar tanto com valor já mascarado (hoje) quanto só-dígitos (pós D3.1).
describe("onlyDigits", () => {
  it("extrai só dígitos", () => {
    expect(onlyDigits("123.456.789-00")).toBe("12345678900");
  });
  it("lida com null/undefined/vazio", () => {
    expect(onlyDigits(null)).toBe("");
    expect(onlyDigits(undefined)).toBe("");
    expect(onlyDigits("")).toBe("");
  });
});

describe("maskCpfCnpj", () => {
  it("formata CPF (11 dígitos)", () => {
    expect(maskCpfCnpj("12345678900")).toBe("123.456.789-00");
  });
  it("formata CNPJ (14 dígitos)", () => {
    expect(maskCpfCnpj("12345678000199")).toBe("12.345.678/0001-99");
  });
  it("é idempotente: aplicar 2x = aplicar 1x", () => {
    const once = maskCpfCnpj("12345678900");
    expect(maskCpfCnpj(once)).toBe(once);
    const onceCnpj = maskCpfCnpj("12345678000199");
    expect(maskCpfCnpj(onceCnpj)).toBe(onceCnpj);
  });
  it("lida com null/undefined/vazio sem quebrar", () => {
    expect(maskCpfCnpj(null)).toBe("");
    expect(maskCpfCnpj(undefined)).toBe("");
    expect(maskCpfCnpj("")).toBe("");
  });
});

describe("maskTelefone", () => {
  it("formata fixo (10 dígitos)", () => {
    expect(maskTelefone("1133334444")).toBe("(11) 3333-4444");
  });
  it("formata celular (11 dígitos)", () => {
    expect(maskTelefone("11933334444")).toBe("(11) 93333-4444");
  });
  it("é idempotente", () => {
    const once = maskTelefone("11933334444");
    expect(maskTelefone(once)).toBe(once);
  });
  it("lida com null/undefined/vazio", () => {
    expect(maskTelefone(null)).toBe("");
    expect(maskTelefone(undefined)).toBe("");
    expect(maskTelefone("")).toBe("");
  });
});

describe("maskCep", () => {
  it("formata CEP", () => {
    expect(maskCep("12345678")).toBe("12345-678");
  });
  it("é idempotente", () => {
    const once = maskCep("12345678");
    expect(maskCep(once)).toBe(once);
  });
  it("lida com null/undefined/vazio", () => {
    expect(maskCep(null)).toBe("");
    expect(maskCep(undefined)).toBe("");
    expect(maskCep("")).toBe("");
  });
});
