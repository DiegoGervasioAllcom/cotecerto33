import { describe, expect, it } from "vitest";
import { dadosComplementaresTransmissaoSchema } from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const dadosValidos = {
  rg: "12.345.678-9",
  dataEmissaoRg: "15/08/2020",
  orgaoEmissorRg: "SSP/SP",
  cepResidencial: "04567-090",
  numeroEndereco: "123",
  mesmoEnderecoCorrespondencia: true,
  renavam: "12345678901",
  corVeiculo: "Branco",
  diaVencimentoDemaisParcelas: "15",
  desejaReceberPropostaPorEmail: "Não",
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
    ["mesmoEnderecoCorrespondencia", false],
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
});
