import { describe, expect, it } from "vitest";
import {
  AVISO_CARTAO_MAPFRE,
  ORGAOS_EMISSORES_MAPFRE,
  RENDAS_MENSAIS_MAPFRE,
  TIPOS_DOCUMENTO_MAPFRE,
  camposMapfrePayload,
  camposPagamentoMapfrePayload,
  dataEmissaoValida,
  ehCartaoMapfre,
  ehDebitoMapfre,
  ehSeguradoraMapfre,
  erroDadosMapfre,
  erroPagamentoMapfre,
} from "@/lib/transmissao-mapfre";
import { RAMOS_ATIVIDADE_MAPFRE } from "@/components/venda/novo-lead/enumsRamoAtividadeMapfre";
import { BANCOS_DEBITO_MAPFRE } from "@/components/venda/novo-lead/enumsBancosDebito";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";
import { produtoDaOferta } from "@/lib/transmissao-allianz";
import { tipoPagamentoPorto } from "@/lib/transmissao-pagamento";
import {
  validarDadosComplementaresMapfre,
  type DadosComplementaresTransmissao,
} from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const ok = {
  tipoDocumento: "RG - REGISTRO GERAL",
  dataEmissaoRg: "10/05/2015",
  orgaoEmissorRg: "SSP - SP",
  ramoAtividade: RAMOS_ATIVIDADE_MAPFRE[0],
  rendaMensal: "Até R$ 3.500,00",
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
    ...extra,
  }) as DadosComplementaresTransmissao;

describe("Mapfre — detecção e formas", () => {
  it("reconhece a Mapfre", () => {
    expect(ehSeguradoraMapfre("Mapfre")).toBe(true);
    expect(ehSeguradoraMapfre("Porto")).toBe(false);
  });
  it("débito: as duas formas; cartão separado; boleto nada", () => {
    expect(ehDebitoMapfre("Mapfre", "Débito em Conta")).toBe(true);
    expect(ehDebitoMapfre("Mapfre", "Débito c/ 1ª em Boleto")).toBe(true);
    expect(ehDebitoMapfre("Mapfre", "Boleto Bancário")).toBe(false);
    expect(ehCartaoMapfre("Mapfre", "Cartão de Crédito")).toBe(true);
    expect(ehDebitoMapfre("Porto", "Débito em Conta")).toBe(false);
  });
  it("não cai no pagamento do grupo Porto", () => {
    expect(tipoPagamentoPorto("Mapfre", "Cartão de Crédito")).toBeNull();
    expect(tipoPagamentoPorto("Mapfre", "Débito em Conta")).toBeNull();
  });
  it("produto = produto || nome ('Customizado')", () => {
    expect(produtoDaOferta("Mapfre", null, "Customizado")).toBe("Customizado");
    expect(produtoDaOferta("Mapfre", "Customizado", "x")).toBe("Customizado");
  });
});

describe("Mapfre — listas", () => {
  it.each([
    ["tipos", TIPOS_DOCUMENTO_MAPFRE as readonly string[], 8],
    ["órgãos", ORGAOS_EMISSORES_MAPFRE, 32],
    ["rendas", RENDAS_MENSAIS_MAPFRE as readonly string[], 7],
    ["ramos", RAMOS_ATIVIDADE_MAPFRE, 338],
    ["bancos", BANCOS_DEBITO_MAPFRE.map((b) => b.nome), 17],
  ])("%s sem duplicatas e com o tamanho certo", (_n, lista, tam) => {
    expect(new Set(lista).size).toBe(lista.length);
    expect(lista.length).toBe(tam);
  });
  it("bancos por seguradora devolve os da Mapfre", () => {
    expect(bancosDaSeguradora("Mapfre")).toBe(BANCOS_DEBITO_MAPFRE);
  });
});

describe("Mapfre — data de emissão", () => {
  const hoje = new Date(2026, 9, 29);
  it("aceita data real não futura", () => {
    expect(dataEmissaoValida("29/10/2026", hoje)).toBe(true);
    expect(dataEmissaoValida("01/01/2000", hoje)).toBe(true);
  });
  it.each(["30/10/2026", "31/02/2020", "1/1/2020", "", undefined])("recusa %s", (v) => {
    expect(dataEmissaoValida(v, hoje)).toBe(false);
  });
});

describe("Mapfre — schema (validação do passo)", () => {
  it("passa com os 5 obrigatórios", () => {
    expect(validarDadosComplementaresMapfre(form(ok)).success).toBe(true);
  });
  it.each(["tipoDocumento", "dataEmissaoRg", "orgaoEmissorRg", "ramoAtividade", "rendaMensal"])(
    "exige %s (sem valor padrão)",
    (campo) => {
      const r = validarDadosComplementaresMapfre(form({ ...ok, [campo]: "" }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.some((i) => i.path[0] === campo)).toBe(true);
    },
  );
  it("não exige RG, renavam nem cor", () => {
    const r = validarDadosComplementaresMapfre(form(ok));
    expect(r.success && r.data.rg).toBe("");
  });
  it("recusa valores fora das listas", () => {
    expect(
      validarDadosComplementaresMapfre(form({ ...ok, orgaoEmissorRg: "SSP - XX" })).success,
    ).toBe(false);
    expect(
      validarDadosComplementaresMapfre(form({ ...ok, rendaMensal: "Até R$ 1.500,00" })).success,
    ).toBe(false);
  });
});

describe("Mapfre — servidor e payload", () => {
  it("não exige nada de outras seguradoras", () => {
    expect(erroDadosMapfre("Porto", undefined)).toBeNull();
    expect(camposMapfrePayload("Porto", ok)).toEqual({});
  });
  it("exige os 5 campos", () => {
    expect(erroDadosMapfre("Mapfre", ok)).toBeNull();
    expect(erroDadosMapfre("Mapfre", { ...ok, tipoDocumento: undefined })).toMatch(/documento/i);
    expect(erroDadosMapfre("Mapfre", undefined)).not.toBeNull();
  });
  it("payload só com o que veio; opcionais ausentes ficam de fora", () => {
    expect(camposMapfrePayload("Mapfre", ok)).toEqual(ok);
    expect(
      camposMapfrePayload("Mapfre", {
        ...ok,
        kitApolicePorEmail: "Não",
        certificadoEmNomeDe: " Ana ",
      }),
    ).toMatchObject({ kitApolicePorEmail: "Não", certificadoEmNomeDe: "Ana" });
  });
});

describe("Mapfre — pagamento", () => {
  const conta = { banco: "237", agencia: "1234", conta: "12345-6" };
  it("boleto não pede nada", () => {
    expect(erroPagamentoMapfre("Mapfre", "Boleto Bancário", undefined)).toBeNull();
  });
  it("débito exige conta e aceite", () => {
    expect(erroPagamentoMapfre("Mapfre", "Débito em Conta", undefined)).toMatch(/banco/i);
    expect(erroPagamentoMapfre("Mapfre", "Débito em Conta", { contaDebito: conta })).toMatch(
      /titular/i,
    );
    expect(
      erroPagamentoMapfre("Mapfre", "Débito c/ 1ª em Boleto", {
        contaDebito: conta,
        cienteTitularConta: true,
      }),
    ).toBeNull();
    expect(
      erroPagamentoMapfre("Mapfre", "Débito em Conta", {
        contaDebito: { ...conta, banco: "999" },
        cienteTitularConta: true,
      }),
    ).toMatch(/banco/i);
  });
  it("payload do débito leva conta + ciente", () => {
    expect(
      camposPagamentoMapfrePayload("Mapfre", "Débito em Conta", {
        contaDebito: { ...conta, agencia: " 1234 " },
        cienteTitularConta: true,
      }),
    ).toEqual({ contaDebito: conta, cienteTitularConta: true });
  });
  it("cartão não pede dados e não envia `cartao`", () => {
    expect(erroPagamentoMapfre("Mapfre", "Cartão de Crédito", undefined)).toBeNull();
    const campos = camposPagamentoMapfrePayload("Mapfre", "Cartão de Crédito", {
      contaDebito: conta,
    });
    expect(campos).toEqual({});
    expect(AVISO_CARTAO_MAPFRE).toMatch(/link por e-mail e WhatsApp/);
  });
});
