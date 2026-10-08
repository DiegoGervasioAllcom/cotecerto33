import { describe, expect, it } from "vitest";
import { dadosComplementaresTransmissaoSchema } from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const dadosValidos = {
  rg: "12.345.678-9",
  dataEmissaoRg: "15/08/2020",
  orgaoEmissorRg: "SSP/SP",
  cepResidencial: "04567-090",
  numeroEndereco: "123",
  email: "cliente@email.com",
  mesmoEnderecoCorrespondencia: true,
  // Não exigido quando mesmoEnderecoCorrespondencia é true, mas o shape
  // sempre existe (o form já inicializa assim, ver
  // TransmissaoDadosComplementares.tsx).
  enderecoCorrespondencia: {
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
  },
  renavam: "12345678901",
  corVeiculo: "Branco",
  diaVencimentoDemaisParcelas: "15",
  desejaReceberPropostaPorEmail: "Não",
} as const;

const enderecoCorrespondenciaValido = {
  cep: "01310-100",
  logradouro: "Av. Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  uf: "SP",
} as const;

describe("dados complementares para transmissão Quiver", () => {
  it("aceita somente os campos necessários preenchidos", () => {
    expect(dadosComplementaresTransmissaoSchema.parse(dadosValidos)).toEqual(dadosValidos);
  });

  it.each([
    ["rg", ""],
    ["dataEmissaoRg", "2020-08-15"],
    ["orgaoEmissorRg", ""],
    ["cepResidencial", "1234"],
    ["numeroEndereco", ""],
    ["email", ""],
    ["email", "sem-arroba"],
    ["renavam", "12345678"],
    ["corVeiculo", ""],
    ["diaVencimentoDemaisParcelas", "31"],
    ["desejaReceberPropostaPorEmail", "Talvez"],
  ])("rejeita %s inválido", (campo, valor) => {
    const resultado = dadosComplementaresTransmissaoSchema.safeParse({
      ...dadosValidos,
      [campo]: valor,
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.path).toEqual([campo]);
    }
  });

  it("aceita CEP sem hífen, Renavam de 9 dígitos, vencimento no limite e envio por e-mail", () => {
    const resultado = dadosComplementaresTransmissaoSchema.safeParse({
      ...dadosValidos,
      cepResidencial: "04567090",
      renavam: "123456789",
      diaVencimentoDemaisParcelas: "30",
      desejaReceberPropostaPorEmail: "Sim",
    });

    expect(resultado.success).toBe(true);
  });

  describe("endereço de correspondência", () => {
    it("mesmoEnderecoCorrespondencia=false com endereço completo é aceito", () => {
      const resultado = dadosComplementaresTransmissaoSchema.safeParse({
        ...dadosValidos,
        mesmoEnderecoCorrespondencia: false,
        enderecoCorrespondencia: enderecoCorrespondenciaValido,
      });

      expect(resultado.success).toBe(true);
    });

    it("mesmoEnderecoCorrespondencia=false sem endereço preenchido é rejeitado", () => {
      const resultado = dadosComplementaresTransmissaoSchema.safeParse({
        ...dadosValidos,
        mesmoEnderecoCorrespondencia: false,
      });

      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        const caminhos = resultado.error.issues.map((i) => i.path.join("."));
        expect(caminhos).toEqual(
          expect.arrayContaining([
            "enderecoCorrespondencia.cep",
            "enderecoCorrespondencia.logradouro",
            "enderecoCorrespondencia.numero",
            "enderecoCorrespondencia.bairro",
            "enderecoCorrespondencia.cidade",
            "enderecoCorrespondencia.uf",
          ]),
        );
      }
    });

    it.each([
      ["cep", "123", "enderecoCorrespondencia.cep"],
      ["logradouro", "", "enderecoCorrespondencia.logradouro"],
      ["numero", "", "enderecoCorrespondencia.numero"],
      ["bairro", "", "enderecoCorrespondencia.bairro"],
      ["cidade", "", "enderecoCorrespondencia.cidade"],
      ["uf", "SPX", "enderecoCorrespondencia.uf"],
    ])("rejeita %s inválido no endereço de correspondência", (campo, valor, caminhoEsperado) => {
      const resultado = dadosComplementaresTransmissaoSchema.safeParse({
        ...dadosValidos,
        mesmoEnderecoCorrespondencia: false,
        enderecoCorrespondencia: { ...enderecoCorrespondenciaValido, [campo]: valor },
      });

      expect(resultado.success).toBe(false);
      if (!resultado.success) {
        expect(resultado.error.issues.map((i) => i.path.join("."))).toContain(caminhoEsperado);
      }
    });

    it("ignora um endereço de correspondência inválido quando mesmoEnderecoCorrespondencia é true", () => {
      const resultado = dadosComplementaresTransmissaoSchema.safeParse({
        ...dadosValidos,
        mesmoEnderecoCorrespondencia: true,
        enderecoCorrespondencia: {
          cep: "",
          logradouro: "",
          numero: "",
          bairro: "",
          cidade: "",
          uf: "",
        },
      });

      expect(resultado.success).toBe(true);
    });
  });

  describe("complemento", () => {
    const parse = (extra: object) =>
      dadosComplementaresTransmissaoSchema.safeParse({ ...dadosValidos, ...extra });
    it("recusa número com 11 caracteres", () => {
      expect(parse({ numeroEndereco: "12345678901" }).success).toBe(false);
    });
    it("recusa complemento com 31 e aceita vazio/30", () => {
      expect(parse({ complementoEndereco: "x".repeat(31) }).success).toBe(false);
      expect(parse({ complementoEndereco: "" }).success).toBe(true);
      expect(parse({ complementoEndereco: "x".repeat(30) }).success).toBe(true);
    });
    it("correspondência com e sem complemento", () => {
      const base = { mesmoEnderecoCorrespondencia: false };
      expect(
        parse({
          ...base,
          enderecoCorrespondencia: { ...enderecoCorrespondenciaValido, complemento: "AP 2" },
        }).success,
      ).toBe(true);
      expect(
        parse({ ...base, enderecoCorrespondencia: enderecoCorrespondenciaValido }).success,
      ).toBe(true);
      expect(
        parse({
          ...base,
          enderecoCorrespondencia: {
            ...enderecoCorrespondenciaValido,
            complemento: "x".repeat(31),
          },
        }).success,
      ).toBe(false);
    });
  });
});
