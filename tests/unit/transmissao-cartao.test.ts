import { describe, expect, it } from "vitest";
import {
  ehCartaoPorto,
  ehCartaoTerceirosPorto,
  formatarNumeroCartao,
  luhnValido,
  mascararValidade,
  validarCartao,
} from "@/lib/transmissao-cartao";

// 4111…1111 é o número de teste público (passa no Luhn).
const cartaoOk = {
  nomeTitular: "TESTE DESENV",
  bandeira: "Visa",
  numero: "4111111111111111",
  validade: "12/2030",
} as const;
const AGORA = new Date(2026, 9, 15); // 15/10/2026

describe("cartão — detecção das formas da Porto", () => {
  it.each([
    ["Porto", "Cartão de Crédito (Demais Bandeiras)"],
    ["Porto Seguro", "Cartão Porto Bank (Terceiros)"],
  ])("%s + %s é cartão da Porto", (s, f) => expect(ehCartaoPorto(s, f)).toBe(true));

  it.each([
    ["Porto", "Boleto Bancário"],
    ["Porto", "Débito em Conta"],
    ["Suhai", "Cartão de Crédito"],
    // reconhecimento explícito: uma forma futura com "cart" no nome não cai aqui
    ["Porto", "Cartão de Débito"],
    ["Porto", "Carteira digital"],
  ])("%s + %s NÃO é", (s, f) => expect(ehCartaoPorto(s, f)).toBe(false));

  it("só o Porto Bank (Terceiros) é de terceiros", () => {
    expect(ehCartaoTerceirosPorto("Porto", "Cartão Porto Bank (Terceiros)")).toBe(true);
    expect(ehCartaoTerceirosPorto("Porto", "Cartão de Crédito (Demais Bandeiras)")).toBe(false);
    expect(ehCartaoTerceirosPorto("Suhai", "Cartão Porto Bank (Terceiros)")).toBe(false);
  });
});

describe("cartão — Luhn e máscaras", () => {
  it("Luhn", () => {
    expect(luhnValido("4111111111111111")).toBe(true);
    expect(luhnValido("4111 1111 1111 1111")).toBe(true);
    expect(luhnValido("4111111111111112")).toBe(false);
    expect(luhnValido("")).toBe(false);
  });
  it("formata o número em grupos de 4 (máx. 16 dígitos)", () => {
    expect(formatarNumeroCartao("4111111111111111")).toBe("4111 1111 1111 1111");
    expect(formatarNumeroCartao("41111")).toBe("4111 1");
    expect(formatarNumeroCartao("41111111111111119999")).toBe("4111 1111 1111 1111");
  });
  it("máscara de validade MM/AAAA", () => {
    expect(mascararValidade("1")).toBe("1");
    expect(mascararValidade("122030")).toBe("12/2030");
    expect(mascararValidade("12/20301")).toBe("12/2030");
  });
});

describe("cartão — validação", () => {
  it("aceita o cartão válido", () => {
    expect(validarCartao(cartaoOk, AGORA)).toEqual({});
  });

  it.each([
    ["titular vazio", { ...cartaoOk, nomeTitular: " " }, "nomeTitular"],
    ["bandeira vazia", { ...cartaoOk, bandeira: "" }, "bandeira"],
    ["bandeira inexistente", { ...cartaoOk, bandeira: "Amex" }, "bandeira"],
    ["número curto", { ...cartaoOk, numero: "411111" }, "numero"],
    ["número longo", { ...cartaoOk, numero: "41111111111111111" }, "numero"],
    ["número sem Luhn", { ...cartaoOk, numero: "4111111111111112" }, "numero"],
    ["validade em formato errado", { ...cartaoOk, validade: "2030-12" }, "validade"],
    ["mês 13", { ...cartaoOk, validade: "13/2030" }, "validade"],
    ["cartão vencido", { ...cartaoOk, validade: "09/2026" }, "validade"],
  ])("recusa %s", (_n, cartao, campo) => {
    expect(Object.keys(validarCartao(cartao as never, AGORA))).toContain(campo);
  });

  it("validade no mês atual ainda vale", () => {
    expect(validarCartao({ ...cartaoOk, validade: "10/2026" }, AGORA)).toEqual({});
  });

  it("o servidor recebe JSON arbitrário: tipos errados dão erro controlado", () => {
    const estranho = { nomeTitular: 1, bandeira: {}, numero: 4111, validade: [] } as never;
    expect(Object.keys(validarCartao(estranho, AGORA)).sort()).toEqual([
      "bandeira",
      "nomeTitular",
      "numero",
      "validade",
    ]);
    expect(Object.keys(validarCartao(undefined, AGORA)).length).toBe(4);
  });

  it("as mensagens de erro NUNCA repetem o valor (dado financeiro)", () => {
    const sensivel = {
      nomeTitular: "",
      bandeira: "Amex",
      numero: "4111111111111112",
      validade: "01/2020",
    };
    const msgs = JSON.stringify(validarCartao(sensivel as never, AGORA));
    for (const v of ["4111111111111112", "4111 1111", "01/2020", "Amex"])
      expect(msgs).not.toContain(v);
  });
});
