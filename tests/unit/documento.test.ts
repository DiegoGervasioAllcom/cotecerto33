import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido } from "@/lib/documento";

describe("CPF", () => {
  it.each(["111.444.777-35", "11144477735", "529.982.247-25"])("%s é válido", (cpf) => {
    expect(cpfValido(cpf)).toBe(true);
  });
  it.each(["111.444.777-36", "11111111111", "123", "", "abc", "1114447773"])(
    "%s é inválido",
    (cpf) => {
      expect(cpfValido(cpf)).toBe(false);
    },
  );
});

describe("CNPJ", () => {
  it.each(["11.222.333/0001-81", "11222333000181"])("%s é válido", (cnpj) => {
    expect(cnpjValido(cnpj)).toBe(true);
  });
  it.each(["11.222.333/0001-82", "11111111111111", "123", ""])("%s é inválido", (cnpj) => {
    expect(cnpjValido(cnpj)).toBe(false);
  });
});
