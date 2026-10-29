import { describe, expect, it } from "vitest";
import {
  camposAllianzPayload,
  ehParcelado,
  ehSeguradoraAllianz,
  erroDadosAllianz,
  produtoDaOferta,
} from "@/lib/transmissao-allianz";
import { erroPagamentoPorto, tipoPagamentoPorto } from "@/lib/transmissao-pagamento";
import { validarCartao, bandeirasDaSeguradora } from "@/lib/transmissao-cartao";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";

const ok = {
  rendaMensal: "De R$ 3.001,00 até R$ 5.000,00",
  ramoAtividade: "Advogado",
  veiculoAlienado: "Não" as const,
};

describe("Allianz — detecção e parcelas", () => {
  it.each(["Allianz", "allianz", " ALLIANZ "])("%s é a Allianz", (n) => {
    expect(ehSeguradoraAllianz(n)).toBe(true);
  });
  it.each(["Porto", "Tokio", ""])("%s não é a Allianz", (n) => {
    expect(ehSeguradoraAllianz(n)).toBe(false);
  });
  it.each([
    ["À vista", false],
    ["a vista", false],
    ["", false],
    [undefined, false],
    ["2x", true],
    ["6x", true],
    ["em 12x de R$ 100,00", true],
  ])("parcelas %s → parcelado=%s", (p, esperado) => {
    expect(ehParcelado(p as string | undefined)).toBe(esperado);
  });
});

describe("Allianz — produto enviado ao robô", () => {
  it("usa o nome do card (plano), pois `produto` vem como 'Ampliado' nas Compreensivas", () => {
    expect(produtoDaOferta("Allianz", "Ampliado", "Básico")).toBe("Básico");
    expect(produtoDaOferta("allianz", null, "Incêndio, Roubo e Furto")).toBe(
      "Incêndio, Roubo e Furto",
    );
  });
  it("mantém produto ?? nome nas outras seguradoras", () => {
    expect(produtoDaOferta("Tokio", "Auto", "tokio")).toBe("Auto");
    expect(produtoDaOferta("Suhai", null, "Roubo e Furto")).toBe("Roubo e Furto");
    expect(produtoDaOferta("Suhai", "", "")).toBeUndefined();
  });
});

describe("Allianz — regra de bloqueio do servidor", () => {
  it("não exige nada de outras seguradoras", () => {
    expect(erroDadosAllianz("Porto", undefined, "À vista")).toBeNull();
  });
  it("passa com os dados certos (à vista)", () => {
    expect(erroDadosAllianz("Allianz", ok, "À vista")).toBeNull();
  });
  it("o ramo é o catálogo PRÓPRIO da Allianz (não o da Porto)", () => {
    expect(erroDadosAllianz("Allianz", { ...ok, ramoAtividade: "Advogados" }, "À vista")).toMatch(
      /ramo/i,
    );
    expect(erroDadosAllianz("Allianz", { ...ok, ramoAtividade: "Advogado" }, "À vista")).toBeNull();
  });
  it("exige renda da Allianz (faixas próprias), ramo da lista", () => {
    expect(
      erroDadosAllianz("Allianz", { ...ok, rendaMensal: "Até R$ 2.500,00" }, "À vista"),
    ).toMatch(/renda/i);
    expect(
      erroDadosAllianz("Allianz", { ...ok, ramoAtividade: "Qualquer coisa" }, "À vista"),
    ).toMatch(/ramo/i);
    expect(erroDadosAllianz("Allianz", undefined, "À vista")).toMatch(/renda/i);
  });
  it("no parcelado exige o dia de vencimento das demais parcelas", () => {
    expect(erroDadosAllianz("Allianz", ok, "6x")).toMatch(/dia de vencimento/i);
    expect(
      erroDadosAllianz("Allianz", { ...ok, diaVencimentoDemaisParcelas: "10" }, "6x"),
    ).toBeNull();
    expect(erroDadosAllianz("Allianz", { ...ok, diaVencimentoDemaisParcelas: "32" }, "6x")).toMatch(
      /dia de vencimento/i,
    );
  });
});

describe("Allianz — payload", () => {
  it("só para a Allianz", () => {
    expect(camposAllianzPayload("Tokio", ok)).toEqual({});
  });
  it("manda renda, ramo e alienado; alienado vem do cadastro quando não corrigido", () => {
    expect(camposAllianzPayload("Allianz", ok)).toEqual({
      rendaMensal: ok.rendaMensal,
      ramoAtividade: ok.ramoAtividade,
      veiculoAlienado: "Não",
    });
    expect(
      camposAllianzPayload("Allianz", { rendaMensal: ok.rendaMensal }, true).veiculoAlienado,
    ).toBe("Sim");
    expect(
      camposAllianzPayload("Allianz", { rendaMensal: ok.rendaMensal }, null).veiculoAlienado,
    ).toBe("Não");
  });
});

describe("Allianz — pagamento (mesmas formas da Porto, listas próprias)", () => {
  it("reconhece débito e cartão; boleto não tem passo", () => {
    expect(tipoPagamentoPorto("Allianz", "Débito em Conta")).toBe("debito");
    expect(tipoPagamentoPorto("Allianz", "Cartão de Crédito")).toBe("cartao");
    expect(tipoPagamentoPorto("Allianz", "Boleto Bancário")).toBeNull();
  });
  it("débito: aceita os bancos da Allianz (inclui BRB, 70) e recusa os que só a Porto tem", () => {
    const conta = { agencia: "1234", conta: "12345-6" };
    expect(
      erroPagamentoPorto("Allianz", "Débito em Conta", { contaDebito: { ...conta, banco: "70" } }),
    ).toBeNull();
    expect(
      erroPagamentoPorto("Allianz", "Débito em Conta", { contaDebito: { ...conta, banco: "4" } }),
    ).toMatch(/banco/i);
    expect(bancosDaSeguradora("Allianz")).toHaveLength(10);
  });
  it("cartão: sem Diners na Allianz", () => {
    const cartao = { nomeTitular: "FULANO", numero: "4111111111111111", validade: "12/2099" };
    expect(bandeirasDaSeguradora("Allianz")).not.toContain("Diners");
    expect(
      Object.keys(
        validarCartao(
          { ...cartao, bandeira: "Diners" },
          undefined,
          bandeirasDaSeguradora("Allianz"),
        ),
      ),
    ).toContain("bandeira");
    expect(
      validarCartao({ ...cartao, bandeira: "Elo" }, undefined, bandeirasDaSeguradora("Allianz")),
    ).toEqual({});
    expect(validarCartao({ ...cartao, bandeira: "Diners" })).toEqual({});
  });
});
