import { describe, it, expect } from "vitest";
import { seguradoSchema } from "@/lib/schemas/cotacaoSegurado.schema";
import { seguroSchema } from "@/lib/schemas/cotacaoSeguro.schema";

// `nomeSocial` é a única exceção à regra "todo campo é opcional" desta etapa
// (ver comentário no schema) — por isso todo caso abaixo que testa OUTRO
// campo precisa incluir um nomeSocial válido, senão falha por um motivo que
// não é o que o teste quer verificar.
const NOME_SOCIAL_VALIDO = "Nome Social Válido";

describe("seguradoSchema", () => {
  it("rejeita objeto vazio (nomeSocial é obrigatório)", () => {
    expect(seguradoSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita nomeSocial vazio", () => {
    expect(seguradoSchema.safeParse({ nome: "Fulano de Tal", nomeSocial: "" }).success).toBe(false);
  });

  it("rejeita nomeSocial igual ao nome (case-insensitive)", () => {
    expect(
      seguradoSchema.safeParse({ nome: "Fulano de Tal", nomeSocial: "fulano de tal" }).success,
    ).toBe(false);
  });

  it("rejeita nomeSocial de uma palavra só (não é composto)", () => {
    expect(seguradoSchema.safeParse({ nome: "Fulano de Tal", nomeSocial: "Fulana" }).success).toBe(
      false,
    );
  });

  it("aceita nomeSocial composto e diferente do nome", () => {
    expect(
      seguradoSchema.safeParse({ nome: "Fulano de Tal", nomeSocial: "Fulana Souza" }).success,
    ).toBe(true);
  });

  it("aceita demais campos opcionais preenchidos com strings vazias", () => {
    expect(
      seguradoSchema.safeParse({
        cpf: "",
        pessoa: "",
        nome: "",
        nomeSocial: NOME_SOCIAL_VALIDO,
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
        nomeSocial: NOME_SOCIAL_VALIDO,
        celular: "(11) 98765-4321",
        telRes: "(11) 3456-7890",
        email: "fulano@email.com",
        cep: "01310-100",
        uf: "SP",
      }).success,
    ).toBe(true);
  });

  it("rejeita CPF com 10 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ cpf: "1234567890", nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(false);
  });

  it("aceita CNPJ com 14 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ cpf: "12345678000190", nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(true);
  });

  it("rejeita CEP com 7 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ cep: "1234567", nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(false);
  });

  it("aceita CEP com 8 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ cep: "01310100", nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(true);
  });

  it("rejeita email sem @", () => {
    expect(
      seguradoSchema.safeParse({ email: "invalido", nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(false);
  });

  it("rejeita email maior que 254", () => {
    const longEmail = "a".repeat(250) + "@a.com";
    expect(
      seguradoSchema.safeParse({ email: longEmail, nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(false);
  });

  it("rejeita celular com 9 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ celular: "123456789", nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(false);
  });

  it("rejeita tel_res com 9 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ telRes: "123456789", nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(false);
  });

  it("rejeita nome maior que 150", () => {
    expect(
      seguradoSchema.safeParse({ nome: "a".repeat(151), nomeSocial: NOME_SOCIAL_VALIDO }).success,
    ).toBe(false);
  });

  it("rejeita logradouro maior que 2000", () => {
    expect(
      seguradoSchema.safeParse({ logradouro: "a".repeat(2001), nomeSocial: NOME_SOCIAL_VALIDO })
        .success,
    ).toBe(false);
  });

  it("rejeita uf maior que 2", () => {
    expect(seguradoSchema.safeParse({ uf: "SPX", nomeSocial: NOME_SOCIAL_VALIDO }).success).toBe(
      false,
    );
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
