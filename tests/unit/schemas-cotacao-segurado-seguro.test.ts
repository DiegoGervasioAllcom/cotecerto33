import { describe, it, expect } from "vitest";
import { seguradoSchema } from "@/lib/schemas/cotacaoSegurado.schema";
import { seguroSchema } from "@/lib/schemas/cotacaoSeguro.schema";

describe("seguradoSchema", () => {
  it("aceita objeto vazio (nenhum campo é obrigatório)", () => {
    expect(seguradoSchema.safeParse({}).success).toBe(true);
  });

  it("aceita todos os campos opcionais preenchidos com strings vazias", () => {
    expect(
      seguradoSchema.safeParse({
        cpf: "",
        pessoa: "",
        nome: "",
        nomeSocial: "",
        sexo: "",
        estadoCivil: "",
        celular: "",
        telRes: "",
        email: "",
        cep: "",
        logradouro: "",
        bairro: "",
        cidade: "",
        uf: "",
      }).success,
    ).toBe(true);
  });

  it("aceita dados completos válidos", () => {
    expect(
      seguradoSchema.safeParse({
        cpf: "123.456.789-00",
        nome: "Fulano de Tal",
        celular: "(11) 98765-4321",
        telRes: "(11) 3456-7890",
        email: "fulano@email.com",
        cep: "01310-100",
        uf: "SP",
      }).success,
    ).toBe(true);
  });

  it("rejeita CPF com 10 dígitos", () => {
    expect(seguradoSchema.safeParse({ cpf: "1234567890" }).success).toBe(false);
  });

  it("aceita CNPJ com 14 dígitos", () => {
    expect(seguradoSchema.safeParse({ cpf: "12345678000190" }).success).toBe(true);
  });

  it("rejeita CEP com 7 dígitos", () => {
    expect(seguradoSchema.safeParse({ cep: "1234567" }).success).toBe(false);
  });

  it("aceita CEP com 8 dígitos", () => {
    expect(seguradoSchema.safeParse({ cep: "01310100" }).success).toBe(true);
  });

  it("rejeita email sem @", () => {
    expect(seguradoSchema.safeParse({ email: "invalido" }).success).toBe(false);
  });

  it("rejeita email maior que 254", () => {
    const longEmail = "a".repeat(250) + "@a.com";
    expect(seguradoSchema.safeParse({ email: longEmail }).success).toBe(false);
  });

  it("rejeita celular com 9 dígitos", () => {
    expect(seguradoSchema.safeParse({ celular: "123456789" }).success).toBe(false);
  });

  it("rejeita tel_res com 9 dígitos", () => {
    expect(seguradoSchema.safeParse({ telRes: "123456789" }).success).toBe(false);
  });

  it("rejeita nome maior que 150", () => {
    expect(seguradoSchema.safeParse({ nome: "a".repeat(151) }).success).toBe(false);
  });

  it("rejeita logradouro maior que 2000", () => {
    expect(seguradoSchema.safeParse({ logradouro: "a".repeat(2001) }).success).toBe(false);
  });

  it("rejeita uf maior que 2", () => {
    expect(seguradoSchema.safeParse({ uf: "SPX" }).success).toBe(false);
  });
});

describe("seguroSchema", () => {
  it("aceita objeto vazio (nenhum campo é obrigatório)", () => {
    expect(seguroSchema.safeParse({}).success).toBe(true);
  });

  it("aceita dados válidos completos", () => {
    expect(
      seguroSchema.safeParse({
        tipoSeguro: "Renovação com nossa corretora",
        categoria: "Particular",
        ramo: "Automóvel",
        ciaAtual: "Porto Seguro",
        ciAtual: "Corretora X",
        classeBonus: "0",
        apoliceAtual: "123456",
      }).success,
    ).toBe(true);
  });

  it("rejeita ramo maior que 150", () => {
    expect(seguroSchema.safeParse({ ramo: "a".repeat(151) }).success).toBe(false);
  });

  it("rejeita tipoSeguro maior que 50", () => {
    expect(seguroSchema.safeParse({ tipoSeguro: "a".repeat(51) }).success).toBe(false);
  });

  it("rejeita apoliceAtual maior que 50", () => {
    expect(seguroSchema.safeParse({ apoliceAtual: "a".repeat(51) }).success).toBe(false);
  });
});
