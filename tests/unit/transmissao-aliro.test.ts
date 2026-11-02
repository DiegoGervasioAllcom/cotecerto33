import { describe, expect, it } from "vitest";
import {
  BANCOS_DEBITO_ALIRO,
  BANCOS_DEBITO_YELUM,
  BANCOS_DEBITO_ALLIANZ,
  BANCOS_DEBITO_MAPFRE,
  BANCOS_DEBITO_PORTO,
} from "@/components/venda/novo-lead/enumsBancosDebito";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";
import {
  camposPagamentoYelumPayload,
  camposYelumPayload,
  ehCartaoYelum,
  ehDebitoYelum,
  ehFamiliaYelum,
  erroDadosYelum,
  erroPagamentoYelum,
  validarContaYelum,
} from "@/lib/transmissao-yelum";
import { validarDadosComplementaresYelum } from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";
import { RAMOS_ATIVIDADE_YELUM } from "@/components/venda/novo-lead/enumsRamoAtividadeYelum";

const completos = {
  ramoAtividade: RAMOS_ATIVIDADE_YELUM[0],
  rendaMensal: undefined as string | undefined,
  tipoLogradouro: TIPOS_LOGRADOURO_YELUM[0],
};
import { RENDAS_MENSAIS_YELUM, TIPOS_LOGRADOURO_YELUM } from "@/lib/transmissao-yelum";

const dados = { ...completos, rendaMensal: RENDAS_MENSAIS_YELUM[0] };
const conta = { banco: "104", agencia: "1234", conta: "123456-7" };

describe("Aliro (família Yelum)", () => {
  it("reconhece família", () => {
    expect(ehFamiliaYelum("Aliro")).toBe(true);
    expect(ehFamiliaYelum("Yelum")).toBe(true);
    expect(ehFamiliaYelum("Porto")).toBe(false);
  });

  it("não exige nem envia cpfVendedor; a Yelum continua exigindo/enviando", () => {
    expect(erroDadosYelum("Aliro", dados)).toBeNull();
    expect(erroDadosYelum("Yelum", dados)).toMatch(/CPF/);
    const comCpf = { ...dados, cpfVendedor: "529.982.247-25" };
    expect("cpfVendedor" in camposYelumPayload("Aliro", comCpf)).toBe(false);
    expect(camposYelumPayload("Yelum", comCpf).cpfVendedor).toBe("52998224725");
  });

  it("ramo, renda e logradouro obrigatórios", () => {
    const m = erroDadosYelum("Aliro", {});
    expect(m).toMatch(/exigido pela Aliro/);
    expect(erroDadosYelum("Aliro", { ...dados, ramoAtividade: undefined })).toBeTruthy();
    expect(erroDadosYelum("Aliro", { ...dados, rendaMensal: undefined })).toBeTruthy();
    expect(erroDadosYelum("Aliro", { ...dados, tipoLogradouro: undefined })).toBeTruthy();
  });

  it("schema do formulário não exige cpfVendedor para a Aliro", () => {
    const base = { ...dados } as never;
    const paths = (seg: string) => {
      const r = validarDadosComplementaresYelum(base, seg);
      return r.success ? [] : r.error.issues.map((x) => x.path[0]);
    };
    expect(paths("Aliro")).not.toContain("cpfVendedor");
  });

  it("bancos: 18, sem Inter e sem duplicatas", () => {
    expect(BANCOS_DEBITO_ALIRO).toHaveLength(18);
    expect(BANCOS_DEBITO_ALIRO.some((b) => b.codigo === "77")).toBe(false);
    expect(new Set(BANCOS_DEBITO_ALIRO.map((b) => b.codigo)).size).toBe(18);
    expect(
      BANCOS_DEBITO_YELUM.filter(
        (b) => !BANCOS_DEBITO_ALIRO.some((a) => a.codigo === b.codigo),
      ).map((b) => b.codigo),
    ).toEqual(["77"]);
    expect(bancosDaSeguradora("aliro")).toBe(BANCOS_DEBITO_ALIRO);
    expect(bancosDaSeguradora("Yelum")).toBe(BANCOS_DEBITO_YELUM);
    expect(bancosDaSeguradora("allianz")).toBe(BANCOS_DEBITO_ALLIANZ);
    expect(bancosDaSeguradora("mapfre")).toBe(BANCOS_DEBITO_MAPFRE);
    expect(bancosDaSeguradora("porto")).toBe(BANCOS_DEBITO_PORTO);
  });

  it("débito: banco do Inter recusado, conta com dígito e aceite exigidos, sem agenciaDv", () => {
    expect(validarContaYelum({ ...conta, banco: "77" }, "aliro").banco).toBeTruthy();
    expect(validarContaYelum({ ...conta, banco: "77" }, "yelum").banco).toBeUndefined();
    expect(validarContaYelum({ ...conta, conta: "123456" }, "aliro").conta).toBeTruthy();
    expect(erroPagamentoYelum("Aliro", "Débito em conta", { contaDebito: conta })).toMatch(
      /titular/,
    );
    expect(
      erroPagamentoYelum("Aliro", "Débito em conta", {
        contaDebito: conta,
        cienteTitularConta: true,
      }),
    ).toBeNull();
    const p = camposPagamentoYelumPayload("Aliro", "Débito em conta", {
      contaDebito: conta,
      cienteTitularConta: true,
    });
    expect(p.cienteTitularConta).toBe(true);
    expect(p.contaDebito).not.toHaveProperty("agenciaDv");
  });

  it("cartão não envia cartao; 7 formas reconhecidas", () => {
    expect(ehCartaoYelum("Aliro", "Cartão de crédito")).toBe(true);
    expect(
      camposPagamentoYelumPayload("Aliro", "Cartão de crédito", { contaDebito: conta }),
    ).toEqual({});
    expect(ehDebitoYelum("Aliro", "Débito em conta")).toBe(true);
    expect(ehDebitoYelum("Aliro", "Boleto")).toBe(false);
  });
});

describe("as 7 formas de pagamento da família Yelum", () => {
  const FORMAS = [
    { forma: "Boleto Bancário", debito: false, cartao: false },
    { forma: "Débito em Conta", debito: true, cartao: false },
    { forma: "Cartão de Crédito", debito: false, cartao: true },
    { forma: "PIX", debito: false, cartao: false },
    { forma: "Boleto + Débito em Conta", debito: true, cartao: false },
    { forma: "PIX + Débito em conta", debito: true, cartao: false },
    { forma: "Boleto + Cartão de Crédito", debito: false, cartao: true },
  ];
  for (const seguradora of ["yelum", "aliro"]) {
    it.each(FORMAS)(
      `$forma (${seguradora}): débito/cartão reconhecidos pela forma base`,
      ({ forma, debito, cartao }) => {
        expect(ehDebitoYelum(seguradora, forma)).toBe(debito);
        expect(ehCartaoYelum(seguradora, forma)).toBe(cartao);
      },
    );
  }
  it("outra seguradora nunca é reconhecida", () => {
    expect(ehDebitoYelum("porto", "Débito em Conta")).toBe(false);
    expect(ehCartaoYelum("mapfre", "Cartão de Crédito")).toBe(false);
  });
});
