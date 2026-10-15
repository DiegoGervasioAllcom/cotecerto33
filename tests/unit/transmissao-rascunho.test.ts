import { describe, expect, it } from "vitest";
import {
  aplicarRascunho,
  baseDoForm,
  type RascunhoDadosTransmissao,
} from "@/lib/transmissao-rascunho";
import type { DadosComplementaresTransmissao } from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const f = {
  cep: "04567-090",
  numero: "10",
  complemento: "",
  email: "a@x.com",
  renavam: "123.456.789-01",
  cor: "Branco",
};

const dadosDigitados = {
  rg: "123456789",
  dataEmissaoRg: "13/05/2020",
  orgaoEmissorRg: "SSP",
  cepResidencial: "04567-090",
  numeroEndereco: "10",
  complementoEndereco: "",
  email: "a@x.com",
  mesmoEnderecoCorrespondencia: true,
  enderecoCorrespondencia: { cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "" },
  renavam: "12345678901",
  corVeiculo: "Branco",
  diaVencimentoDemaisParcelas: "10",
  desejaReceberPropostaPorEmail: "Não",
  rendaMensal: "Até R$ 2.500,00",
} as DadosComplementaresTransmissao;

function rascunho(): RascunhoDadosTransmissao {
  return { dados: { ...dadosDigitados }, base: baseDoForm(f) };
}

describe("baseDoForm", () => {
  it("normaliza o renavam para só dígitos", () => {
    expect(baseDoForm(f).renavam).toBe("12345678901");
  });
});

describe("aplicarRascunho", () => {
  it("mantém tudo que foi digitado quando o Form não mudou", () => {
    expect(aplicarRascunho(rascunho(), baseDoForm(f))).toEqual(dadosDigitados);
  });

  it("mantém o que o vendedor editou na Etapa 7 se o Form não mudou", () => {
    const r = rascunho();
    r.dados.email = "editado@x.com";
    expect(aplicarRascunho(r, baseDoForm(f)).email).toBe("editado@x.com");
  });

  it("usa o valor corrigido no Form quando ele mudou desde o rascunho", () => {
    const r = rascunho();
    r.dados.email = "editado@x.com";
    const depois = baseDoForm({ ...f, email: "corrigido@x.com", cor: "Preto" });
    const res = aplicarRascunho(r, depois);
    expect(res.email).toBe("corrigido@x.com");
    expect(res.corVeiculo).toBe("Preto");
    expect(res.rg).toBe("123456789");
    expect(res.rendaMensal).toBe("Até R$ 2.500,00");
  });

  it("não altera o rascunho recebido", () => {
    const r = rascunho();
    aplicarRascunho(r, baseDoForm({ ...f, numero: "99" }));
    expect(r.dados.numeroEndereco).toBe("10");
  });

  it("não acusa mudança quando o renavam só muda de formatação", () => {
    const r = rascunho();
    r.dados.renavam = "99999999999";
    const res = aplicarRascunho(r, baseDoForm({ ...f, renavam: "12345678901" }));
    expect(res.renavam).toBe("99999999999");
  });

  it("usa o renavam do Form quando os dígitos mudaram", () => {
    const res = aplicarRascunho(rascunho(), baseDoForm({ ...f, renavam: "987.654.321-00" }));
    expect(res.renavam).toBe("98765432100");
  });

  it("usa o Form atual em CEP, número e complemento quando mudaram", () => {
    const res = aplicarRascunho(
      rascunho(),
      baseDoForm({ ...f, cep: "01001-000", numero: "55", complemento: "Apto 3" }),
    );
    expect(res.cepResidencial).toBe("01001-000");
    expect(res.numeroEndereco).toBe("55");
    expect(res.complementoEndereco).toBe("Apto 3");
  });
});
