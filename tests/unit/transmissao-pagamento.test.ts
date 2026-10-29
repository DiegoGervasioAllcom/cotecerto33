import { describe, expect, it } from "vitest";
import {
  camposPagamentoPayload,
  erroPagamentoPorto,
  ocultarNumerosLongos,
  tipoPagamentoPorto,
} from "@/lib/transmissao-pagamento";

const DEBITO = "Débito em Conta";
const CREDITO = "Cartão de Crédito (Demais Bandeiras)";
const TERCEIROS = "Cartão Porto Bank (Terceiros)";

const conta = { banco: "104", agencia: "1234", conta: "12345-6" } as const;
const cartao = {
  nomeTitular: "TESTE DESENV",
  bandeira: "Visa",
  numero: "4111 1111 1111 1111",
  validade: "12/2099",
} as const;
const pagadorFisica = {
  tipoPessoa: "Física",
  nome: "Pagador de Teste",
  documento: "111.444.777-35",
  email: " teste@example.com ",
  ddd: "11",
  telefone: "98765-4321",
  sexo: "Masculino",
  estadoCivil: "Solteiro(a)",
  dataNascimento: "15/03/1985",
} as const;

describe("pagamento da Porto — qual conjunto de campos", () => {
  it.each([
    ["Porto", DEBITO, "debito"],
    ["Porto", CREDITO, "cartao"],
    ["Porto", TERCEIROS, "cartao_terceiros"],
    ["Porto Seguro", "debito em conta", "debito"],
    ["Azul", DEBITO, "debito"],
    ["Azul", CREDITO, "cartao"],
    ["Azul", TERCEIROS, "cartao_terceiros"],
    ["Azul", "Boleto Bancário", null],
    ["Porto", "Boleto Bancário", null],
    ["Porto", "Cartão de Débito", null],
    ["Suhai", "Cartão de Crédito", null],
    ["Suhai", DEBITO, null],
    ["Mapfre", "Débito c/ 1ª em Boleto", null],
  ])("%s + %s → %s", (s, f, esperado) => {
    expect(tipoPagamentoPorto(s, f)).toBe(esperado);
  });
});

describe("pagamento da Porto — regra de bloqueio do servidor", () => {
  it("passa com os dados certos de cada forma", () => {
    expect(erroPagamentoPorto("Porto", DEBITO, { contaDebito: { ...conta } })).toBeNull();
    expect(erroPagamentoPorto("Porto", CREDITO, { cartao: { ...cartao } })).toBeNull();
    expect(
      erroPagamentoPorto("Porto", TERCEIROS, {
        cartao: { ...cartao },
        pagador: { ...pagadorFisica },
      }),
    ).toBeNull();
  });

  it("recusa cada forma sem os dados", () => {
    expect(erroPagamentoPorto("Porto", DEBITO, undefined)).toMatch(/^Débito em conta:/);
    expect(erroPagamentoPorto("Porto", CREDITO, undefined)).toMatch(/^Cartão:/);
    expect(erroPagamentoPorto("Porto", TERCEIROS, { cartao: { ...cartao } })).toMatch(/^Pagador:/);
  });

  it("o cartão comum NÃO exige pagador", () => {
    expect(erroPagamentoPorto("Porto", CREDITO, { cartao: { ...cartao } })).toBeNull();
  });

  it("não exige nada de outras formas/seguradoras", () => {
    expect(erroPagamentoPorto("Porto", "Boleto Bancário", undefined)).toBeNull();
    expect(erroPagamentoPorto("Suhai", "Cartão de Crédito", undefined)).toBeNull();
    expect(erroPagamentoPorto("Suhai", DEBITO, undefined)).toBeNull();
  });

  it("a mensagem NUNCA repete o valor recebido", () => {
    const ruim = { ...cartao, numero: "4111 1111 1111 1112" };
    const msgs = [
      erroPagamentoPorto("Porto", CREDITO, { cartao: ruim }),
      erroPagamentoPorto("Porto", TERCEIROS, {
        cartao: { ...cartao },
        pagador: { ...pagadorFisica, documento: "111.444.777-36" },
      }),
      erroPagamentoPorto("Porto", DEBITO, {
        contaDebito: { banco: "999", agencia: "98765x", conta: "55555-5Z" },
      }),
    ].join(" | ");
    for (const v of [
      "4111 1111 1111 1112",
      "4111111111111112",
      "111.444.777-36",
      "11144477736",
      "98765x",
      "55555-5Z",
    ]) {
      expect(msgs).not.toContain(v);
    }
  });
});

describe("pagamento da Porto — campos do payload", () => {
  it("débito: o campo contaDebito", () => {
    expect(camposPagamentoPayload("Porto", DEBITO, { contaDebito: { ...conta } })).toEqual({
      contaDebito: { ...conta },
    });
  });

  it("cartão: número só com dígitos e titular truncado em 20", () => {
    const longo = { ...cartao, nomeTitular: "NOME BEM COMPRIDO DE TESTE SIMULADO" };
    const r = camposPagamentoPayload("Porto", CREDITO, { cartao: longo });
    expect(r.cartao).toEqual({
      nomeTitular: "NOME BEM COMPRIDO DE",
      bandeira: "Visa",
      numero: "4111111111111111",
      validade: "12/2099",
    });
    expect(r.cartao?.nomeTitular.length).toBeLessThanOrEqual(20);
    expect(r.pagador).toBeUndefined();
  });

  it("cartão comum descarta um pagador que sobrou no estado", () => {
    const r = camposPagamentoPayload("Porto", CREDITO, {
      cartao: { ...cartao },
      pagador: { ...pagadorFisica },
    });
    expect(r.pagador).toBeUndefined();
  });

  it("Terceiros: pagador normalizado (só dígitos nos números, e-mail aparado)", () => {
    const r = camposPagamentoPayload("Porto", TERCEIROS, {
      cartao: { ...cartao },
      pagador: { ...pagadorFisica },
    });
    expect(r.pagador).toEqual({
      tipoPessoa: "Física",
      nome: "Pagador de Teste",
      documento: "11144477735",
      email: "teste@example.com",
      ddd: "11",
      telefone: "987654321",
      sexo: "Masculino",
      estadoCivil: "Solteiro(a)",
      dataNascimento: "15/03/1985",
    });
  });

  it("Terceiros com pessoa Jurídica não envia sexo/estado civil/nascimento", () => {
    const r = camposPagamentoPayload("Porto", TERCEIROS, {
      cartao: { ...cartao },
      pagador: {
        ...pagadorFisica,
        tipoPessoa: "Jurídica",
        documento: "11.222.333/0001-81",
        sexo: "",
        estadoCivil: "",
        dataNascimento: "",
      },
    });
    expect(r.pagador).toEqual({
      tipoPessoa: "Jurídica",
      nome: "Pagador de Teste",
      documento: "11222333000181",
      email: "teste@example.com",
      ddd: "11",
      telefone: "987654321",
    });
  });

  it("nada sai para outras formas ou seguradoras, nem sem pagamento", () => {
    const tudo = {
      contaDebito: { ...conta },
      cartao: { ...cartao },
      pagador: { ...pagadorFisica },
    };
    expect(camposPagamentoPayload("Porto", "Boleto Bancário", tudo)).toEqual({});
    expect(camposPagamentoPayload("Suhai", CREDITO, tudo)).toEqual({});
    expect(camposPagamentoPayload("Porto", CREDITO, undefined)).toEqual({});
  });
});

describe("pagamento da Porto — mensagens vindas do robô/portal", () => {
  it("esconde sequências de 8+ dígitos (cartão, CPF/CNPJ, conta, telefone), com ou sem separadores", () => {
    const msg =
      "Cartão 4111 1111 1111 1111 recusado; CPF 111.444.777-35; CNPJ 11.222.333/0001-81; conta 12345678; tel 98765-4321";
    const r = ocultarNumerosLongos(msg);
    for (const v of ["4111", "111.444", "11.222", "12345678", "98765"]) expect(r).not.toContain(v);
    expect(r).toContain("••••");
  });

  it("não estraga números curtos úteis da mensagem", () => {
    const msg = "O campo deve possuir até 20 caracteres (HTTP 422, 1ª tentativa, agência 1234)";
    expect(ocultarNumerosLongos(msg)).toBe(msg);
  });
});
