import { describe, it, expect } from "vitest";
import { seguradoSchema } from "@/lib/schemas/cotacaoSegurado.schema";
import { seguroSchema } from "@/lib/schemas/cotacaoSeguro.schema";

// `nome`, `nomeSocial`, `estadoCivil`, `email`, `numero` e `celular` são
// exceções à regra "todo campo é opcional" desta etapa (ver comentário no
// schema) — por isso todo caso abaixo que testa OUTRO campo precisa incluir
// valores válidos para esses seis, senão falha por um motivo que não é o
// que o teste quer verificar.
const NOME_SOCIAL_VALIDO = "Nome Social Válido";
const CAMPOS_OBRIGATORIOS_VALIDOS = {
  nome: "Fulano de Tal",
  nomeSocial: NOME_SOCIAL_VALIDO,
  estadoCivil: "Solteiro(a)",
  email: "fulano@email.com",
  numero: "123",
  celular: "(11) 98765-4321",
};

describe("seguradoSchema", () => {
  it("rejeita objeto vazio (nome, nomeSocial, estado civil, email, número e celular são obrigatórios)", () => {
    expect(seguradoSchema.safeParse({}).success).toBe(false);
  });

  it("rejeita nome vazio", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, nome: "" }).success).toBe(
      false,
    );
  });

  it("rejeita nome de uma palavra só (não é nome completo)", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, nome: "Fulano" }).success,
    ).toBe(false);
  });

  it("rejeita estado civil vazio", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, estadoCivil: "" }).success,
    ).toBe(false);
  });

  it("rejeita nomeSocial vazio", () => {
    expect(
      seguradoSchema.safeParse({
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        nome: "Fulano de Tal",
        nomeSocial: "",
      }).success,
    ).toBe(false);
  });

  it("rejeita nomeSocial igual ao nome (case-insensitive)", () => {
    expect(
      seguradoSchema.safeParse({
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        nome: "Fulano de Tal",
        nomeSocial: "fulano de tal",
      }).success,
    ).toBe(false);
  });

  it("rejeita nomeSocial de uma palavra só (não é composto)", () => {
    expect(
      seguradoSchema.safeParse({
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        nome: "Fulano de Tal",
        nomeSocial: "Fulana",
      }).success,
    ).toBe(false);
  });

  it("aceita nomeSocial composto e diferente do nome", () => {
    expect(
      seguradoSchema.safeParse({
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        nome: "Fulano de Tal",
        nomeSocial: "Fulana Souza",
      }).success,
    ).toBe(true);
  });

  it("rejeita quando email está vazio", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, email: "" }).success).toBe(
      false,
    );
  });

  it("rejeita quando número está vazio", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, numero: "" }).success).toBe(
      false,
    );
  });

  it("rejeita quando celular está vazio", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, celular: "" }).success).toBe(
      false,
    );
  });

  it("aceita demais campos opcionais preenchidos com strings vazias", () => {
    expect(
      seguradoSchema.safeParse({
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        cpf: "",
        pessoa: "",
        sexo: "",
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
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        cpf: "123.456.789-00",
        nome: "Fulano de Tal",
        cep: "01310-100",
        uf: "SP",
      }).success,
    ).toBe(true);
  });

  it("rejeita CPF com 10 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, cpf: "1234567890" }).success,
    ).toBe(false);
  });

  it("rejeita CNPJ com 14 dígitos (robô Quiver só cota Pessoa Física — R.10)", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, cpf: "12345678000190" }).success,
    ).toBe(false);
  });

  it("rejeita CEP com 7 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, cep: "1234567" }).success,
    ).toBe(false);
  });

  it("aceita CEP com 8 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, cep: "01310100" }).success,
    ).toBe(true);
  });

  it("rejeita email sem @", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, email: "invalido" }).success,
    ).toBe(false);
  });

  it("rejeita email maior que 254", () => {
    const longEmail = "a".repeat(250) + "@a.com";
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, email: longEmail }).success,
    ).toBe(false);
  });

  it("rejeita celular com 9 dígitos", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, celular: "123456789" }).success,
    ).toBe(false);
  });

  it("rejeita nome maior que 150", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, nome: "a".repeat(151) }).success,
    ).toBe(false);
  });

  it("rejeita logradouro maior que 2000", () => {
    expect(
      seguradoSchema.safeParse({
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        logradouro: "a".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("rejeita uf maior que 2", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, uf: "SPX" }).success).toBe(
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
