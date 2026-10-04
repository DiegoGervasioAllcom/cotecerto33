import { describe, it, expect } from "vitest";
import { seguradoSchema } from "@/lib/schemas/cotacaoSegurado.schema";
import { seguroSchema } from "@/lib/schemas/cotacaoSeguro.schema";

// `celular` é exceção à regra "todo campo é opcional" desta etapa (email e
// número são opcionais; ver schema) — todo caso abaixo que testa
// OUTRO campo precisa incluir valor válido para ele, senão falha por
// um motivo que não é o que o teste quer verificar. `nomeSocial` é opcional
// (só é validado quando preenchido). `nome` e `estadoCivil` não bloqueiam o
// avanço de etapa (só o Calcular, via useSimulacaoCalculo.ts).
const CAMPOS_OBRIGATORIOS_VALIDOS = {
  nome: "Fulano de Tal",
  estadoCivil: "Solteiro(a)",
  email: "fulano@email.com",
  numero: "123",
  celular: "(11) 98765-4321",
};

describe("seguradoSchema", () => {
  it("rejeita objeto vazio (celular é obrigatório)", () => {
    expect(seguradoSchema.safeParse({}).success).toBe(false);
  });

  it("aceita e-mail e número vazios (opcionais; obrigatórios só na transmissão)", () => {
    expect(
      seguradoSchema.safeParse({ celular: "(11) 98765-4321", email: "", numero: "" }).success,
    ).toBe(true);
    expect(seguradoSchema.safeParse({ celular: "(11) 98765-4321" }).success).toBe(true);
  });

  it("e-mail preenchido com formato inválido continua falhando", () => {
    expect(
      seguradoSchema.safeParse({ celular: "(11) 98765-4321", email: "sem-arroba" }).success,
    ).toBe(false);
  });

  it("número preenchido acima de 20 caracteres continua falhando", () => {
    expect(
      seguradoSchema.safeParse({ celular: "(11) 98765-4321", numero: "1".repeat(21) }).success,
    ).toBe(false);
  });

  it("celular vazio continua falhando", () => {
    expect(seguradoSchema.safeParse({ email: "a@b.com", numero: "1" }).success).toBe(false);
  });

  it("aceita nomeSocial ausente (campo opcional)", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS }).success).toBe(true);
  });

  it("aceita nome vazio (não bloqueia etapa; obrigatoriedade fica no gate de Calcular)", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, nome: "" }).success).toBe(
      true,
    );
  });

  it("aceita nome de uma palavra só (não bloqueia etapa)", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, nome: "Fulano" }).success,
    ).toBe(true);
  });

  it("aceita estado civil vazio (não bloqueia etapa; obrigatoriedade fica no gate de Calcular)", () => {
    expect(
      seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, estadoCivil: "" }).success,
    ).toBe(true);
  });

  it("aceita nomeSocial vazio ou só espaços (opcional)", () => {
    for (const nomeSocial of ["", "   "]) {
      expect(
        seguradoSchema.safeParse({
          ...CAMPOS_OBRIGATORIOS_VALIDOS,
          nome: "Fulano de Tal",
          nomeSocial,
        }).success,
      ).toBe(true);
    }
  });

  it("rejeita nomeSocial preenchido igual ao nome (case-insensitive)", () => {
    expect(
      seguradoSchema.safeParse({
        ...CAMPOS_OBRIGATORIOS_VALIDOS,
        nome: "Fulano de Tal",
        nomeSocial: "fulano de tal",
      }).success,
    ).toBe(false);
  });

  it("rejeita nomeSocial preenchido de uma palavra só (não é composto)", () => {
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

  it("aceita quando email está vazio (opcional)", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, email: "" }).success).toBe(
      true,
    );
  });

  it("aceita quando número está vazio (opcional)", () => {
    expect(seguradoSchema.safeParse({ ...CAMPOS_OBRIGATORIOS_VALIDOS, numero: "" }).success).toBe(
      true,
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
