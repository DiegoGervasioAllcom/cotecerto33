import { describe, expect, it } from "vitest";
import { OCUPACOES_HDI } from "@/components/venda/novo-lead/enumsOcupacaoHdi";
import {
  BANCOS_DEBITO_ALIRO,
  BANCOS_DEBITO_ALLIANZ,
  BANCOS_DEBITO_BRADESCO,
  BANCOS_DEBITO_HDI,
  BANCOS_DEBITO_MAPFRE,
  BANCOS_DEBITO_PORTO,
  BANCOS_DEBITO_YELUM,
} from "@/components/venda/novo-lead/enumsBancosDebito";
import { validarDadosComplementaresHdi } from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";
import {
  camposHdiPayload,
  ehSeguradoraHdi,
  ERRO_PRODUTO_SEM_ID_HDI,
  erroDadosHdi,
  FAIXAS_SALARIAIS_HDI,
  UFS_HDI,
  ufPlacaDoEndereco,
} from "@/lib/transmissao-hdi";
import {
  camposPagamentoYelumPayload,
  camposYelumPayload,
  ehCartaoYelum,
  ehDebitoYelum,
  erroDadosYelum,
  erroPagamentoYelum,
  validarContaYelum,
} from "@/lib/transmissao-yelum";

const base = {
  rg: "",
  dataEmissaoRg: "",
  orgaoEmissorRg: "",
  cepResidencial: "01310-100",
  numeroEndereco: "10",
  email: "a@b.com",
  mesmoEnderecoCorrespondencia: true,
  enderecoCorrespondencia: {
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
    uf: "",
  },
  renavam: "",
  corVeiculo: "",
  diaVencimentoDemaisParcelas: "",
  desejaReceberPropostaPorEmail: "Não" as const,
};
const completos = {
  ...base,
  ramoAtividade: OCUPACOES_HDI[0],
  rendaMensal: FAIXAS_SALARIAIS_HDI[0],
  pessoaPoliticamenteExposta: "Não" as const,
  ufPlaca: "SP",
};
const conta = { banco: "104", agencia: "1234", conta: "12345-6" };

describe("HDI: dados", () => {
  it("schema aceita completo e exige ocupação, faixa, PEP e UF", () => {
    expect(validarDadosComplementaresHdi(completos).success).toBe(true);
    for (const campo of ["ramoAtividade", "rendaMensal", "pessoaPoliticamenteExposta", "ufPlaca"]) {
      const r = validarDadosComplementaresHdi({ ...completos, [campo]: undefined });
      expect(r.success).toBe(false);
    }
  });
  it("rejeita UF inválida e PEP 'Relacionamento Próximo'", () => {
    expect(validarDadosComplementaresHdi({ ...completos, ufPlaca: "XX" }).success).toBe(false);
    const r = validarDadosComplementaresHdi({
      ...completos,
      pessoaPoliticamenteExposta: "Relacionamento Próximo" as never,
    });
    expect(r.success).toBe(false);
  });
  it("produtoId ausente bloqueia a HDI; outras seguradoras não são afetadas", () => {
    expect(erroDadosHdi("hdi seguros", completos, undefined)).toBe(ERRO_PRODUTO_SEM_ID_HDI);
    expect(erroDadosHdi("HDI", completos, "  ")).toBe(ERRO_PRODUTO_SEM_ID_HDI);
    expect(erroDadosHdi("HDI", completos, "10050_1")).toBeNull();
    expect(erroDadosHdi("HDI", { ...completos, ufPlaca: "ZZ" }, "10050_1")).toContain("UF");
    expect(erroDadosHdi("Suhai", undefined, undefined)).toBeNull();
    expect(ehSeguradoraHdi("hdi")).toBe(true);
    expect(ehSeguradoraHdi("porto")).toBe(false);
  });
  it("payload não leva cpfVendedor/tipoLogradouro e põe a UF em maiúsculas", () => {
    const p = camposHdiPayload("hdi seguros", {
      ...completos,
      ufPlaca: "sp",
      cpfVendedor: "123",
      tipoLogradouro: "Rua",
    } as never);
    expect(p).toEqual({
      ramoAtividade: OCUPACOES_HDI[0],
      rendaMensal: FAIXAS_SALARIAIS_HDI[0],
      pessoaPoliticamenteExposta: "Não",
      ufPlaca: "SP",
    });
    expect(camposHdiPayload("yelum", completos)).toEqual({});
  });
  it("UF do endereço é pré-selecionada (ou vazia)", () => {
    expect(ufPlacaDoEndereco("rj")).toBe("RJ");
    expect(ufPlacaDoEndereco("")).toBeUndefined();
    expect(ufPlacaDoEndereco("Rio")).toBeUndefined();
  });
});

describe("HDI: pagamento", () => {
  it("débito exige conta com dígito + aceite e não envia agenciaDv", () => {
    expect(validarContaYelum({ ...conta, conta: "12345" }, "hdi seguros").conta).toBeTruthy();
    expect(validarContaYelum(conta, "hdi seguros")).toEqual({});
    expect(erroPagamentoYelum("hdi seguros", "Débito em Conta", { contaDebito: conta })).toMatch(
      /confirme/,
    );
    expect(
      erroPagamentoYelum("hdi seguros", "Débito em Conta", {
        contaDebito: conta,
        cienteTitularConta: true,
      }),
    ).toBeNull();
    const p = camposPagamentoYelumPayload("hdi seguros", "Débito em Conta", {
      contaDebito: { ...conta, agenciaDv: "1" } as never,
      cienteTitularConta: true,
    });
    expect(p).toEqual({ contaDebito: conta, cienteTitularConta: true });
    expect(
      erroPagamentoYelum("hdi seguros", "Débito em Conta", {
        contaDebito: { ...conta, conta: "999" },
      }),
    ).not.toContain("999");
  });
  it("cartão e boleto não enviam nada", () => {
    expect(ehCartaoYelum("hdi seguros", "Cartão de Crédito")).toBe(true);
    expect(ehDebitoYelum("hdi seguros", "Cartão de Crédito")).toBe(false);
    for (const forma of ["Cartão de Crédito", "Boleto Bancário"]) {
      expect(camposPagamentoYelumPayload("hdi seguros", forma, { contaDebito: conta })).toEqual({});
      expect(erroPagamentoYelum("hdi seguros", forma, undefined)).toBeNull();
    }
  });
  it("HDI não ganha CPF do vendedor nem campos da Yelum", () => {
    expect(camposYelumPayload("hdi seguros", completos)).toEqual({});
    expect(erroDadosYelum("hdi seguros", undefined)).toBeNull();
  });
});

describe("HDI: listas", () => {
  const unicos = (l: readonly string[]) => new Set(l).size === l.length;
  it("contagens e sem duplicatas", () => {
    expect(OCUPACOES_HDI).toHaveLength(279);
    expect(FAIXAS_SALARIAIS_HDI).toHaveLength(7);
    expect(UFS_HDI).toHaveLength(27);
    expect(BANCOS_DEBITO_HDI).toHaveLength(16);
    expect(unicos(OCUPACOES_HDI)).toBe(true);
    expect(unicos(FAIXAS_SALARIAIS_HDI)).toBe(true);
    expect(unicos(UFS_HDI)).toBe(true);
    expect(unicos(BANCOS_DEBITO_HDI.map((b) => b.codigo))).toBe(true);
  });
});

describe("regressão: bancos das outras seguradoras", () => {
  it("cada uma mantém a sua lista", () => {
    expect(bancosDaSeguradora("hdi")).toBe(BANCOS_DEBITO_HDI);
    expect(bancosDaSeguradora("yelum")).toBe(BANCOS_DEBITO_YELUM);
    expect(bancosDaSeguradora("aliro")).toBe(BANCOS_DEBITO_ALIRO);
    expect(bancosDaSeguradora("bradesco")).toBe(BANCOS_DEBITO_BRADESCO);
    expect(bancosDaSeguradora("mapfre")).toBe(BANCOS_DEBITO_MAPFRE);
    expect(bancosDaSeguradora("allianz")).toBe(BANCOS_DEBITO_ALLIANZ);
    expect(bancosDaSeguradora("porto")).toBe(BANCOS_DEBITO_PORTO);
  });
  it("CPF do vendedor só na Yelum", () => {
    const d = { ramoAtividade: "x", rendaMensal: "y", tipoLogradouro: "RUA" };
    expect(erroDadosYelum("aliro", d)).not.toMatch(/CPF/);
    expect(erroDadosYelum("yelum", d)).toBeTruthy();
  });
});
