import { describe, it, expect } from "vitest";
import { cnpjCadastroSchema, cpfCadastroSchema } from "@/lib/schemas/cadastro.schema";

const cnpjValido = {
  nome: "Empresa LTDA",
  documento: "12.345.678/0001-90",
  socio_nome: "Fulano de Tal",
  email: "fulano@email.com",
  password: "123456",
};

const cpfValido = {
  nome: "Fulano de Tal",
  documento: "123.456.789-00",
  email: "fulano@email.com",
  password: "123456",
};

describe("cnpjCadastroSchema", () => {
  it("aceita dados válidos completos", () => {
    expect(cnpjCadastroSchema.safeParse(cnpjValido).success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, nome: "" }).success).toBe(false);
  });

  it("rejeita nome maior que 150", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, nome: "a".repeat(151) }).success).toBe(
      false,
    );
  });

  it("rejeita documento com 10 dígitos", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, documento: "1234567890" }).success).toBe(
      false,
    );
  });

  it("rejeita documento com 12 dígitos", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, documento: "123456789012" }).success).toBe(
      false,
    );
  });

  it("rejeita documento com 13 dígitos", () => {
    expect(
      cnpjCadastroSchema.safeParse({ ...cnpjValido, documento: "1234567890123" }).success,
    ).toBe(false);
  });

  it("aceita documento com 11 dígitos (CPF)", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, documento: "12345678900" }).success).toBe(
      true,
    );
  });

  it("aceita documento com 14 dígitos (CNPJ)", () => {
    expect(
      cnpjCadastroSchema.safeParse({ ...cnpjValido, documento: "12345678000190" }).success,
    ).toBe(true);
  });

  it("rejeita email sem @", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, email: "invalido" }).success).toBe(false);
  });

  it("rejeita email maior que 254", () => {
    const longEmail = "a".repeat(250) + "@a.com";
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, email: longEmail }).success).toBe(false);
  });

  it("rejeita senha menor que 6", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, password: "12345" }).success).toBe(false);
  });

  it("rejeita socio_cpf com 10 dígitos", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, socio_cpf: "1234567890" }).success).toBe(
      false,
    );
  });

  it("aceita socio_cpf vazio (opcional)", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, socio_cpf: "" }).success).toBe(true);
  });

  it("rejeita celular com 9 dígitos", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, celular: "123456789" }).success).toBe(
      false,
    );
  });

  it("aceita celular vazio (opcional)", () => {
    expect(cnpjCadastroSchema.safeParse({ ...cnpjValido, celular: "" }).success).toBe(true);
  });
});

describe("cpfCadastroSchema", () => {
  it("aceita dados válidos completos", () => {
    expect(cpfCadastroSchema.safeParse(cpfValido).success).toBe(true);
  });

  it("rejeita documento com 12 dígitos", () => {
    expect(cpfCadastroSchema.safeParse({ ...cpfValido, documento: "123456789012" }).success).toBe(
      false,
    );
  });

  it("aceita documento com 14 dígitos (CNPJ)", () => {
    expect(cpfCadastroSchema.safeParse({ ...cpfValido, documento: "12345678000190" }).success).toBe(
      true,
    );
  });
});
