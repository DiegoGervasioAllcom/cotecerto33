import { describe, expect, it } from "vitest";
import { dadosComplementaresTransmissaoSchema } from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const dadosValidos = {
  rg: "12.345.678-9",
  dataEmissaoRg: "15/08/2020",
  orgaoEmissorRg: "SSP/SP",
  cepResidencial: "04567-090",
  numeroEndereco: "123",
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
});
