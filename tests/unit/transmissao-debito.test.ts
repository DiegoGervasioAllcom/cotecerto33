import { describe, expect, it } from "vitest";
import { BANCOS_DEBITO_PORTO } from "@/components/venda/novo-lead/enumsBancosDebito";
import {
  camposDebitoPayload,
  ehDebitoEmContaPorto,
  erroContaDebito,
  validarContaDebito,
} from "@/lib/transmissao-debito";

const contaOk = { banco: "104", agencia: "1234", conta: "12345-6" } as const;

describe("débito em conta da Porto — detecção", () => {
  it.each([
    ["Porto", "Débito em Conta"],
    ["Porto Seguro", "debito em conta"],
    [" porto ", "  DÉBITO   EM CONTA "],
  ])("%s + %s é o débito em conta da Porto", (seguradora, forma) => {
    expect(ehDebitoEmContaPorto(seguradora, forma)).toBe(true);
  });

  it.each([
    ["Porto", "Boleto Bancário"],
    ["Porto", "Cartão de Crédito (Demais Bandeiras)"],
    ["Porto", "Cartão Porto Bank (Terceiros)"],
    ["Suhai", "Débito em Conta"],
    ["Mapfre", "Débito c/ 1ª em Boleto"],
    ["Porto", ""],
  ])("%s + %s NÃO é", (seguradora, forma) => {
    expect(ehDebitoEmContaPorto(seguradora, forma)).toBe(false);
  });
});

describe("débito em conta — catálogo de bancos", () => {
  it("é a lista fechada do portal: códigos numéricos únicos, nomes preenchidos", () => {
    expect(BANCOS_DEBITO_PORTO.length).toBe(16);
    const codigos = BANCOS_DEBITO_PORTO.map((b) => b.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(codigos.every((c) => /^\d+$/.test(c))).toBe(true);
    expect(BANCOS_DEBITO_PORTO.every((b) => b.nome.trim().length > 0)).toBe(true);
    expect(codigos).toEqual(expect.arrayContaining(["1", "104", "237", "341"]));
  });
});

describe("débito em conta — validação", () => {
  it("aceita banco do catálogo, agência e conta válidas", () => {
    expect(validarContaDebito(contaOk)).toEqual({});
  });

  it("aceita conta com dígito X e sem hífen", () => {
    expect(validarContaDebito({ ...contaOk, conta: "123456X" })).toEqual({});
    expect(validarContaDebito({ ...contaOk, conta: "1234567890" })).toEqual({});
  });

  it.each([
    ["banco vazio", { ...contaOk, banco: "" }, "banco"],
    ["banco fora do catálogo", { ...contaOk, banco: "999" }, "banco"],
    ["agência vazia", { ...contaOk, agencia: "" }, "agencia"],
    ["agência com letra", { ...contaOk, agencia: "12a4" }, "agencia"],
    ["agência com 7 dígitos", { ...contaOk, agencia: "1234567" }, "agencia"],
    ["conta vazia", { ...contaOk, conta: "" }, "conta"],
    ["conta com 12 caracteres", { ...contaOk, conta: "123456789012" }, "conta"],
    ["conta com símbolo", { ...contaOk, conta: "123.456" }, "conta"],
  ])("recusa %s", (_nome, conta, campo) => {
    expect(Object.keys(validarContaDebito(conta))).toContain(campo);
  });

  it("o servidor recebe JSON arbitrário: valores que não são texto dão erro controlado (sem TypeError)", () => {
    const estranho = { banco: 104, agencia: 1234, conta: { x: 1 } } as unknown as Parameters<
      typeof validarContaDebito
    >[0];
    expect(Object.keys(validarContaDebito(estranho)).sort()).toEqual(["agencia", "banco", "conta"]);
    expect(erroContaDebito("Porto", "Débito em Conta", estranho)).toMatch(/^Débito em conta:/);
  });

  it("sem conta informada, falha nos três campos", () => {
    expect(Object.keys(validarContaDebito(undefined)).sort()).toEqual([
      "agencia",
      "banco",
      "conta",
    ]);
  });
});

describe("débito em conta — regra de bloqueio do servidor", () => {
  it("passa com a conta válida", () => {
    expect(erroContaDebito("Porto", "Débito em Conta", contaOk)).toBeNull();
  });

  it("recusa o débito da Porto sem conta", () => {
    expect(erroContaDebito("Porto", "Débito em Conta", undefined)).toMatch(/^Débito em conta:/);
  });

  it("não exige conta de outras formas nem de outras seguradoras", () => {
    expect(erroContaDebito("Porto", "Boleto Bancário", undefined)).toBeNull();
    expect(erroContaDebito("Suhai", "Débito em Conta", undefined)).toBeNull();
  });

  it("a mensagem de erro NUNCA repete o valor recebido (dado financeiro)", () => {
    const sensivel = { banco: "999", agencia: "98765", conta: "55555-5Z" };
    const msg = erroContaDebito("Porto", "Débito em Conta", sensivel) ?? "";
    expect(msg.length).toBeGreaterThan(0);
    for (const valor of Object.values(sensivel)) expect(msg).not.toContain(valor);
  });
});

describe("débito em conta — campo do payload", () => {
  it("só vai no débito em conta da Porto, aparado", () => {
    expect(
      camposDebitoPayload("Porto", "Débito em Conta", {
        banco: "104",
        agencia: " 1234 ",
        conta: " 12345-6 ",
      }),
    ).toEqual({ contaDebito: { banco: "104", agencia: "1234", conta: "12345-6" } });
  });

  it("não envia em outras formas, outras seguradoras ou sem conta", () => {
    expect(camposDebitoPayload("Porto", "Boleto Bancário", contaOk)).toEqual({});
    expect(camposDebitoPayload("Suhai", "Débito em Conta", contaOk)).toEqual({});
    expect(camposDebitoPayload("Porto", "Débito em Conta", undefined)).toEqual({});
  });
});
