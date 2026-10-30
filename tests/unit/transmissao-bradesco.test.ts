import { describe, expect, it } from "vitest";
import {
  AVISO_FORMA_NAO_SUPORTADA_BRADESCO,
  RENDAS_MENSAIS_BRADESCO,
  TIPOS_LOGRADOURO_BRADESCO,
  camposBradescoPayload,
  camposPagamentoBradescoPayload,
  ehCartaoBradesco,
  ehDebitoBradesco,
  ehFormaNaoSuportadaBradesco,
  ehSeguradoraBradesco,
  erroDadosBradesco,
  erroPagamentoBradesco,
} from "@/lib/transmissao-bradesco";
import { RAMOS_ATIVIDADE_BRADESCO } from "@/components/venda/novo-lead/enumsRamoAtividadeBradesco";
import { BANCOS_DEBITO_BRADESCO } from "@/components/venda/novo-lead/enumsBancosDebito";
import { BANDEIRAS_BRADESCO, bandeirasDaSeguradora } from "@/lib/transmissao-cartao";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";
import { produtoDaOferta } from "@/lib/transmissao-allianz";
import { tipoPagamentoPorto } from "@/lib/transmissao-pagamento";
import {
  validarDadosComplementaresBradesco,
  type DadosComplementaresTransmissao,
} from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const ok = {
  ramoAtividade: RAMOS_ATIVIDADE_BRADESCO[0],
  rendaMensal: "DE R$ 1.001,00 A R$ 3.000,00",
  tipoLogradouro: "Rua",
};

const form = (extra: Record<string, unknown> = {}): DadosComplementaresTransmissao =>
  ({
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
    desejaReceberPropostaPorEmail: "Não",
    ...ok,
    ...extra,
  }) as DadosComplementaresTransmissao;

const conta = { banco: "237", agencia: "1234", conta: "12345-6" };
const cartao = {
  nomeTitular: "ANA SILVA",
  bandeira: "ELO" as const,
  numero: "4111111111111111",
  validade: "12/2099",
};

describe("Bradesco — detecção e formas", () => {
  it("reconhece a Bradesco e as formas", () => {
    expect(ehSeguradoraBradesco("Bradesco")).toBe(true);
    expect(ehSeguradoraBradesco("Porto")).toBe(false);
    expect(ehDebitoBradesco("Bradesco", "Débito em Conta")).toBe(true);
    expect(ehCartaoBradesco("Bradesco", "Cartão de Crédito")).toBe(true);
    expect(ehCartaoBradesco("Bradesco", "Cartão Bradesco Seguros")).toBe(false);
    expect(ehDebitoBradesco("Bradesco", "Boleto Bancário")).toBe(false);
  });
  it("não cai no pagamento do grupo Porto", () => {
    expect(tipoPagamentoPorto("Bradesco", "Cartão de Crédito")).toBeNull();
    expect(tipoPagamentoPorto("Bradesco", "Débito em Conta")).toBeNull();
  });
  it("produto = produto || nome", () => {
    expect(produtoDaOferta("Bradesco", null, "Seguro Auto Tradicional")).toBe(
      "Seguro Auto Tradicional",
    );
  });
});

describe("Bradesco — 'Cartão Bradesco Seguros' bloqueada", () => {
  it("marca como não suportada e o servidor recusa", () => {
    expect(ehFormaNaoSuportadaBradesco("Bradesco", "Cartão Bradesco Seguros")).toBe(true);
    expect(ehFormaNaoSuportadaBradesco("Bradesco", "Cartão de Crédito")).toBe(false);
    expect(ehFormaNaoSuportadaBradesco("Porto", "Cartão Bradesco Seguros")).toBe(false);
    expect(erroDadosBradesco("Bradesco", "Cartão Bradesco Seguros", ok)).toBe(
      AVISO_FORMA_NAO_SUPORTADA_BRADESCO,
    );
    expect(AVISO_FORMA_NAO_SUPORTADA_BRADESCO).toMatch(/ainda não está disponível/);
  });
});

describe("Bradesco — listas", () => {
  it.each([
    ["ramos", RAMOS_ATIVIDADE_BRADESCO, 147],
    ["rendas", RENDAS_MENSAIS_BRADESCO as readonly string[], 5],
    ["bancos", BANCOS_DEBITO_BRADESCO.map((b) => b.nome), 16],
    ["códigos", BANCOS_DEBITO_BRADESCO.map((b) => b.codigo), 16],
    ["bandeiras", BANDEIRAS_BRADESCO as readonly string[], 7],
    ["logradouros", TIPOS_LOGRADOURO_BRADESCO as readonly string[], 10],
  ])("%s sem duplicatas e com o tamanho certo", (_n, lista, tam) => {
    expect(new Set(lista).size).toBe(lista.length);
    expect(lista.length).toBe(tam);
  });
  it("listas por seguradora devolvem as da Bradesco", () => {
    expect(bancosDaSeguradora("Bradesco")).toBe(BANCOS_DEBITO_BRADESCO);
    expect(bandeirasDaSeguradora("Bradesco")).toBe(BANDEIRAS_BRADESCO);
  });
});

describe("Bradesco — schema (validação do passo)", () => {
  it("passa com ramo, renda e tipo de logradouro", () => {
    const r = validarDadosComplementaresBradesco(form());
    expect(r.success).toBe(true);
    expect(r.success && r.data.rg).toBe("");
  });
  it.each(["ramoAtividade", "rendaMensal", "tipoLogradouro"])(
    "exige %s (sem valor padrão)",
    (campo) => {
      const r = validarDadosComplementaresBradesco(form({ [campo]: "" }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.some((i) => i.path[0] === campo)).toBe(true);
    },
  );
  it("recusa valores fora das listas (inclusive faixa inexistente)", () => {
    expect(
      validarDadosComplementaresBradesco(form({ rendaMensal: "DE R$ 6.001,00 A R$ 10.000,00" }))
        .success,
    ).toBe(false);
    expect(validarDadosComplementaresBradesco(form({ ramoAtividade: "INVENTADO" })).success).toBe(
      false,
    );
  });
});

describe("Bradesco — servidor e payload", () => {
  it("não exige nada de outras seguradoras", () => {
    expect(erroDadosBradesco("Porto", "Boleto", undefined)).toBeNull();
    expect(camposBradescoPayload("Porto", ok)).toEqual({});
  });
  it("exige os 3 campos", () => {
    expect(erroDadosBradesco("Bradesco", "Boleto Bancário", ok)).toBeNull();
    expect(
      erroDadosBradesco("Bradesco", "Boleto Bancário", { ...ok, tipoLogradouro: undefined }),
    ).toMatch(/logradouro/i);
    expect(erroDadosBradesco("Bradesco", "Boleto Bancário", undefined)).not.toBeNull();
  });
  it("payload leva ramo, renda e tipo de logradouro", () => {
    expect(camposBradescoPayload("Bradesco", ok)).toEqual(ok);
  });
});

describe("Bradesco — pagamento", () => {
  it("boleto não pede nada e não envia nada por padrão", () => {
    expect(erroPagamentoBradesco("Bradesco", "Boleto Bancário", undefined)).toBeNull();
    expect(
      camposPagamentoBradescoPayload("Bradesco", "Boleto Bancário", {
        creditoEmConta: { opcao: "Não", conta: { banco: "", agencia: "", conta: "" } },
      }),
    ).toEqual({});
  });
  it("débito exige conta e aceite; mensagem não repete o valor", () => {
    expect(erroPagamentoBradesco("Bradesco", "Débito em Conta", undefined)).toMatch(/banco/i);
    const semAceite = erroPagamentoBradesco("Bradesco", "Débito em Conta", {
      contaDebito: conta,
    });
    expect(semAceite).toMatch(/titular/i);
    expect(semAceite).not.toContain("12345");
    expect(
      erroPagamentoBradesco("Bradesco", "Débito em Conta", {
        contaDebito: { ...conta, agenciaDv: "123" },
        cienteTitularConta: true,
      }),
    ).toMatch(/dígito da agência/i);
    expect(
      erroPagamentoBradesco("Bradesco", "Débito em Conta", {
        contaDebito: conta,
        cienteTitularConta: true,
      }),
    ).toBeNull();
  });
  it("payload do débito leva conta (com dígito da agência) + ciente", () => {
    expect(
      camposPagamentoBradescoPayload("Bradesco", "Débito em Conta", {
        contaDebito: { ...conta, agencia: " 1234 ", agenciaDv: "5" },
        cienteTitularConta: true,
      }),
    ).toEqual({
      contaDebito: { ...conta, agenciaDv: "5" },
      cienteTitularConta: true,
    });
  });
  it("cartão exige os dados e vai no payload", () => {
    expect(erroPagamentoBradesco("Bradesco", "Cartão de Crédito", undefined)).toMatch(/cartão/i);
    expect(
      erroPagamentoBradesco("Bradesco", "Cartão de Crédito", {
        cartao: { ...cartao, bandeira: "" },
      }),
    ).toMatch(/bandeira/i);
    expect(erroPagamentoBradesco("Bradesco", "Cartão de Crédito", { cartao })).toBeNull();
    expect(
      camposPagamentoBradescoPayload("Bradesco", "Cartão de Crédito", { cartao }).cartao,
    ).toEqual(cartao);
  });
  it("creditoEmConta: com 'Sim' valida e vai com tipo/banco/agência/conta", () => {
    const vazio = { banco: "", agencia: "", conta: "" };
    expect(
      erroPagamentoBradesco("Bradesco", "Boleto Bancário", {
        creditoEmConta: { opcao: "Sim, conta corrente", conta: vazio },
      }),
    ).toMatch(/crédito em conta/i);
    expect(
      camposPagamentoBradescoPayload("Bradesco", "Boleto Bancário", {
        creditoEmConta: { opcao: "Sim, conta poupança", conta: { ...conta, agenciaDv: "1" } },
      }).creditoEmConta,
    ).toEqual({ tipo: "poupanca", ...conta, agenciaDv: "1" });
    expect(
      camposPagamentoBradescoPayload("Bradesco", "Boleto Bancário", {
        creditoEmConta: { opcao: "Sim, conta corrente", conta },
      }).creditoEmConta?.tipo,
    ).toBe("corrente");
  });
});

describe("bandeirasDaSeguradora — a Bradesco não muda as outras", () => {
  it("Bradesco tem as 7 bandeiras do select do portal", () => {
    expect([...bandeirasDaSeguradora("bradesco")]).toEqual([
      "Visa",
      "AMEX",
      "ELO",
      "Mastercard",
      "Diners",
      "Aura",
      "JCB",
    ]);
  });
  it("Porto/Azul seguem sem Aura, AMEX e JCB", () => {
    for (const s of ["porto", "azul"]) {
      const b = bandeirasDaSeguradora(s);
      expect(b).not.toContain("Aura");
      expect(b).not.toContain("AMEX");
      expect(b).not.toContain("JCB");
    }
  });
  it("Allianz segue sem Diners", () => {
    expect(bandeirasDaSeguradora("allianz")).not.toContain("Diners");
  });
});
