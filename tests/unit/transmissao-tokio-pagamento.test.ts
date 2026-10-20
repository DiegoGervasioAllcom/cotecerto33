import { describe, expect, it } from "vitest";
import {
  BANCOS_DEBITO_TOKIO,
  camposPagamentoTokioPayload,
  erroPagamentoTokio,
  tipoPagamentoTokio,
  validarCartaoTokio,
  validarDebitoTokio,
  type CartaoTokio,
  type DebitoTokio,
} from "@/lib/transmissao-tokio-pagamento";

const debito: DebitoTokio = {
  banco: "BANCO DO BRASIL",
  agencia: "1234",
  agenciaDv: "",
  conta: "12345-6",
  titularNome: "Fulano de Tal",
  titularDocumento: "52998224725",
  parentesco: "O Próprio Segurado",
  diaVencimento: "10",
  primeiraParcelaDebito: "",
  ciente: true,
};
const cartao: CartaoTokio = {
  envio: "tela",
  relacaoProprietario: "",
  cpfResponsavelLink: "",
  diaFatura: "10",
};

describe("tipoPagamentoTokio", () => {
  it("classifica as formas da Tokio", () => {
    expect(tipoPagamentoTokio("Tokio", "Débito/PIX Aut")).toBe("debito");
    expect(tipoPagamentoTokio("tokio", "Déb. Especial/PIX Aut")).toBe("debito");
    expect(tipoPagamentoTokio("tokio", "Cartão de Crédito")).toBe("cartao");
    expect(tipoPagamentoTokio("tokio", "Boleto Bancário")).toBeNull();
  });
  it("formas desconhecidas ou ambíguas caem em null (palavra inteira)", () => {
    expect(tipoPagamentoTokio("tokio", "PIX Automático")).toBeNull();
    expect(tipoPagamentoTokio("tokio", "Crédito")).toBeNull();
    expect(tipoPagamentoTokio("tokio", "Boleto sem adeb")).toBeNull();
  });
  it("ignora outras seguradoras", () => {
    expect(tipoPagamentoTokio("Porto", "Cartão de Crédito")).toBeNull();
    expect(tipoPagamentoTokio("Porto", "Débito em Conta")).toBeNull();
  });
});

describe("validarDebitoTokio", () => {
  it("aceita um débito completo", () => {
    expect(validarDebitoTokio(debito)).toEqual({});
  });
  it("exige a ciência, o titular válido e o banco da lista", () => {
    const e = validarDebitoTokio({
      ...debito,
      ciente: false,
      titularDocumento: "11111111111",
      banco: "BANCO QUALQUER",
    });
    expect(e.ciente).toBeTruthy();
    expect(e.titularDocumento).toBeTruthy();
    expect(e.banco).toBeTruthy();
  });
  it("aceita CNPJ do titular", () => {
    expect(validarDebitoTokio({ ...debito, titularDocumento: "11222333000181" })).toEqual({});
  });
  it("limita a agência a 4 dígitos e valida dia/parentesco", () => {
    const e = validarDebitoTokio({
      ...debito,
      agencia: "12345",
      diaVencimento: "32",
      parentesco: "Tio",
    });
    expect(Object.keys(e).sort()).toEqual(["agencia", "diaVencimento", "parentesco"]);
  });
  it("não repete o valor recebido nas mensagens", () => {
    const e = validarDebitoTokio({ ...debito, conta: "ABC", titularDocumento: "123" });
    expect(JSON.stringify(e)).not.toMatch(/ABC|123/);
  });
  it("lista de bancos tem 23 opções sem duplicata", () => {
    expect(new Set(BANCOS_DEBITO_TOKIO).size).toBe(BANCOS_DEBITO_TOKIO.length);
  });
});

describe("validarCartaoTokio", () => {
  it("aceita via tela só com o dia da fatura", () => {
    expect(validarCartaoTokio(cartao)).toEqual({});
  });
  it("via link exige CPF válido", () => {
    expect(validarCartaoTokio({ ...cartao, envio: "link" }).cpfResponsavelLink).toBeTruthy();
    expect(
      validarCartaoTokio({ ...cartao, envio: "link", cpfResponsavelLink: "52998224725" }),
    ).toEqual({});
  });
  it("exige o dia da fatura", () => {
    expect(validarCartaoTokio({ ...cartao, diaFatura: "" }).diaFatura).toBeTruthy();
  });
});

describe("erroPagamentoTokio", () => {
  it("Boleto e outras seguradoras: sem regra", () => {
    expect(erroPagamentoTokio("tokio", "Boleto Bancário", undefined)).toBeNull();
    expect(erroPagamentoTokio("suhai", "Cartão de Crédito", undefined)).toBeNull();
  });
  it("débito/cartão da Tokio sem dados bloqueia", () => {
    expect(erroPagamentoTokio("tokio", "Débito/PIX Aut", undefined)).toMatch(/^Débito em conta:/);
    expect(erroPagamentoTokio("tokio", "Cartão de Crédito", undefined)).toMatch(/^Cartão:/);
  });
  it("dados válidos passam", () => {
    expect(erroPagamentoTokio("tokio", "Débito/PIX Aut", { debito })).toBeNull();
    expect(erroPagamentoTokio("tokio", "Cartão de Crédito", { cartao })).toBeNull();
  });
});

describe("camposPagamentoTokioPayload", () => {
  it("monta o payload do débito (só dígitos no documento, ciência, dia)", () => {
    const p = camposPagamentoTokioPayload("tokio", "Débito/PIX Aut", {
      debito: {
        ...debito,
        titularDocumento: "529.982.247-25",
        agenciaDv: "7",
        primeiraParcelaDebito: "Sim",
      },
    });
    expect(p).toEqual({
      contaDebito: { banco: "BANCO DO BRASIL", agencia: "1234", agenciaDv: "7", conta: "12345-6" },
      titularConta: {
        nome: "Fulano de Tal",
        documento: "52998224725",
        parentesco: "O Próprio Segurado",
      },
      cienteTitularConta: true,
      debitoPrimeiraParcela: "Sim",
      diaVencimentoDemaisParcelas: "10",
    });
  });
  it("cartão via tela não leva CPF; via link leva só dígitos", () => {
    expect(camposPagamentoTokioPayload("tokio", "Cartão de Crédito", { cartao })).toEqual({
      cartaoTokio: { envio: "tela" },
      diaVencimentoDemaisParcelas: "10",
    });
    expect(
      camposPagamentoTokioPayload("tokio", "Cartão de Crédito", {
        cartao: {
          ...cartao,
          envio: "link",
          cpfResponsavelLink: "529.982.247-25",
          relacaoProprietario: "Pai",
        },
      }).cartaoTokio,
    ).toEqual({ envio: "link", relacaoProprietario: "Pai", cpfResponsavelLink: "52998224725" });
  });
  it("Boleto / outra seguradora / sem dados: vazio", () => {
    expect(camposPagamentoTokioPayload("tokio", "Boleto Bancário", { debito })).toEqual({});
    expect(camposPagamentoTokioPayload("porto", "Débito/PIX Aut", { debito })).toEqual({});
    expect(camposPagamentoTokioPayload("tokio", "Débito/PIX Aut", undefined)).toEqual({});
  });
});
