import { describe, expect, it } from "vitest";
import {
  AVISO_CARTAO_YELUM,
  ERRO_CONTA_SEM_DIGITO,
  RENDAS_MENSAIS_YELUM,
  TIPOS_LOGRADOURO_YELUM,
  camposPagamentoYelumPayload,
  camposYelumPayload,
  ehCartaoYelum,
  ehDebitoYelum,
  ehSeguradoraYelum,
  erroDadosYelum,
  erroPagamentoYelum,
  tipoLogradouroYelumDoEndereco,
  validarContaYelum,
} from "@/lib/transmissao-yelum";
import { RAMOS_ATIVIDADE_YELUM } from "@/components/venda/novo-lead/enumsRamoAtividadeYelum";
import {
  BANCOS_DEBITO_ALLIANZ,
  BANCOS_DEBITO_BRADESCO,
  BANCOS_DEBITO_MAPFRE,
  BANCOS_DEBITO_PORTO,
  BANCOS_DEBITO_YELUM,
} from "@/components/venda/novo-lead/enumsBancosDebito";
import {
  BANDEIRAS_BRADESCO,
  BANDEIRAS_CARTAO,
  bandeirasDaSeguradora,
} from "@/lib/transmissao-cartao";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";
import { produtoDaOferta } from "@/lib/transmissao-allianz";
import { tipoPagamentoPorto } from "@/lib/transmissao-pagamento";
import {
  validarDadosComplementaresYelum,
  type DadosComplementaresTransmissao,
} from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const CPF_OK = "529.982.247-25";
const ok = {
  ramoAtividade: RAMOS_ATIVIDADE_YELUM[0],
  rendaMensal: "ATE 3 SALARIOS",
  tipoLogradouro: "RUA",
  cpfVendedor: CPF_OK,
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
const FORMAS = [
  "Boleto Bancário",
  "Débito em Conta",
  "Cartão de Crédito",
  "PIX",
  "Boleto + Débito em Conta",
  "PIX + Débito em conta",
  "Boleto + Cartão de Crédito",
];

describe("Yelum — detecção e formas", () => {
  it("reconhece a Yelum e não a confunde com o grupo Porto", () => {
    expect(ehSeguradoraYelum("Yelum")).toBe(true);
    expect(ehSeguradoraYelum("Porto")).toBe(false);
    for (const f of FORMAS) expect(tipoPagamentoPorto("Yelum", f)).toBeNull();
  });
  it("as 7 formas: débito e cartão pela forma base (inclusive combinadas)", () => {
    const deb = FORMAS.filter((f) => ehDebitoYelum("Yelum", f));
    const car = FORMAS.filter((f) => ehCartaoYelum("Yelum", f));
    expect(deb).toEqual(["Débito em Conta", "Boleto + Débito em Conta", "PIX + Débito em conta"]);
    expect(car).toEqual(["Cartão de Crédito", "Boleto + Cartão de Crédito"]);
    expect(ehDebitoYelum("Porto", "Débito em Conta")).toBe(false);
  });
  it("produto = produto || nome", () => {
    expect(produtoDaOferta("Yelum", null, "Compreensiva")).toBe("Compreensiva");
  });
});

describe("Yelum — listas", () => {
  it.each([
    ["ramos", RAMOS_ATIVIDADE_YELUM, 353],
    ["rendas", RENDAS_MENSAIS_YELUM as readonly string[], 8],
    ["logradouros", TIPOS_LOGRADOURO_YELUM as readonly string[], 16],
    ["bancos", BANCOS_DEBITO_YELUM.map((b) => b.nome), 19],
    ["códigos", BANCOS_DEBITO_YELUM.map((b) => b.codigo), 19],
  ])("%s sem duplicatas e com o tamanho certo", (_n, lista, tam) => {
    expect(new Set(lista).size).toBe(lista.length);
    expect(lista.length).toBe(tam);
  });
  it("bancosDaSeguradora devolve os da Yelum", () => {
    expect(bancosDaSeguradora("Yelum")).toBe(BANCOS_DEBITO_YELUM);
  });
  it("regressão: listas das outras seguradoras não mudaram", () => {
    expect(bancosDaSeguradora("Porto")).toBe(BANCOS_DEBITO_PORTO);
    expect(bancosDaSeguradora("Azul")).toBe(BANCOS_DEBITO_PORTO);
    expect(bancosDaSeguradora("Allianz")).toBe(BANCOS_DEBITO_ALLIANZ);
    expect(bancosDaSeguradora("Mapfre")).toBe(BANCOS_DEBITO_MAPFRE);
    expect(bancosDaSeguradora("Bradesco")).toBe(BANCOS_DEBITO_BRADESCO);
    expect(bandeirasDaSeguradora("Bradesco")).toBe(BANDEIRAS_BRADESCO);
    expect(bandeirasDaSeguradora("Porto")).toBe(BANDEIRAS_CARTAO);
    expect(bandeirasDaSeguradora("Allianz")).not.toContain("Diners");
  });
});

describe("Yelum — logradouro pré-selecionado", () => {
  it("só pré-seleciona quando casa com as 16 opções", () => {
    expect(tipoLogradouroYelumDoEndereco("Rua das Flores")).toBe("RUA");
    expect(tipoLogradouroYelumDoEndereco("Avenida Paulista")).toBe("AVENIDA");
    expect(tipoLogradouroYelumDoEndereco("Praça da Sé")).toBe("PRACA");
    expect(tipoLogradouroYelumDoEndereco("Travessa Azul")).toBeUndefined();
    expect(tipoLogradouroYelumDoEndereco("Rodovia BR 116")).toBeUndefined();
    expect(tipoLogradouroYelumDoEndereco("")).toBeUndefined();
  });
});

describe("Yelum — schema (validação do passo)", () => {
  it("passa com ramo, renda, logradouro e CPF válido", () => {
    const r = validarDadosComplementaresYelum(form());
    expect(r.success).toBe(true);
    expect(r.success && r.data.rg).toBe("");
  });
  it.each(["ramoAtividade", "rendaMensal", "tipoLogradouro", "cpfVendedor"])(
    "exige %s (sem valor padrão)",
    (campo) => {
      const r = validarDadosComplementaresYelum(form({ [campo]: "" }));
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.some((i) => i.path[0] === campo)).toBe(true);
    },
  );
  it("CPF inválido é rejeitado sem repetir o valor", () => {
    const r = validarDadosComplementaresYelum(form({ cpfVendedor: "111.111.111-11" }));
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues.map((i) => i.message).join(" ");
      expect(msg).not.toContain("111");
    }
    expect(validarDadosComplementaresYelum(form({ cpfVendedor: "52998224725" })).success).toBe(
      true,
    );
  });
  it("recusa valores fora das listas", () => {
    expect(validarDadosComplementaresYelum(form({ rendaMensal: "ATE 4 SALARIOS" })).success).toBe(
      false,
    );
    expect(validarDadosComplementaresYelum(form({ tipoLogradouro: "TRAVESSA" })).success).toBe(
      false,
    );
    expect(validarDadosComplementaresYelum(form({ ramoAtividade: "INVENTADO" })).success).toBe(
      false,
    );
  });
});

describe("Yelum — servidor e payload", () => {
  it("não exige nada de outras seguradoras", () => {
    expect(erroDadosYelum("Porto", undefined)).toBeNull();
    expect(camposYelumPayload("Porto", ok)).toEqual({});
  });
  it("exige os 4 campos", () => {
    expect(erroDadosYelum("Yelum", ok)).toBeNull();
    expect(erroDadosYelum("Yelum", { ...ok, cpfVendedor: "123" })).toMatch(/CPF/);
    expect(erroDadosYelum("Yelum", { ...ok, cpfVendedor: "123" })).not.toContain("123 ");
    expect(erroDadosYelum("Yelum", undefined)).not.toBeNull();
  });
  it("payload envia o CPF só com dígitos, alienado padrão Não e kit só se mexido", () => {
    const p = camposYelumPayload("Yelum", ok);
    expect(p.cpfVendedor).toBe("52998224725");
    expect(p.veiculoAlienado).toBe("Não");
    expect("kitApolicePorEmail" in p).toBe(false);
    expect(camposYelumPayload("Yelum", ok, true).veiculoAlienado).toBe("Sim");
    expect(
      camposYelumPayload("Yelum", { ...ok, veiculoAlienado: "Sim", kitApolicePorEmail: "Não" }),
    ).toMatchObject({ veiculoAlienado: "Sim", kitApolicePorEmail: "Não" });
  });
  it("não envia documento, órgão nem renavam", () => {
    const p = camposYelumPayload("Yelum", ok) as Record<string, unknown>;
    for (const k of ["rg", "orgaoEmissorRg", "renavam", "tipoDocumento"])
      expect(k in p).toBe(false);
  });
});

describe("Yelum — pagamento", () => {
  it("boleto e PIX não pedem nada nem enviam nada", () => {
    for (const f of ["Boleto Bancário", "PIX"]) {
      expect(erroPagamentoYelum("Yelum", f, undefined)).toBeNull();
      expect(camposPagamentoYelumPayload("Yelum", f, { contaDebito: conta })).toEqual({});
    }
  });
  it("débito exige conta COM dígito e aceite; mensagens não repetem o valor", () => {
    for (const f of ["Débito em Conta", "Boleto + Débito em Conta", "PIX + Débito em conta"]) {
      expect(erroPagamentoYelum("Yelum", f, undefined)).toMatch(/banco/i);
      const semDv = erroPagamentoYelum("Yelum", f, { contaDebito: { ...conta, conta: "123456" } });
      expect(semDv).toContain(ERRO_CONTA_SEM_DIGITO);
      expect(semDv).not.toContain("123456");
      expect(erroPagamentoYelum("Yelum", f, { contaDebito: conta })).toMatch(/titular/i);
      expect(
        erroPagamentoYelum("Yelum", f, { contaDebito: conta, cienteTitularConta: true }),
      ).toBeNull();
    }
    expect(validarContaYelum({ ...conta, conta: "12345-X" }).conta).toBeUndefined();
    expect(validarContaYelum({ ...conta, conta: "-6" }).conta).toBeDefined();
    expect(validarContaYelum({ ...conta, banco: "999" }).banco).toBeDefined();
  });
  it("payload do débito: conta + aceite, sem agenciaDv e sem cartao", () => {
    const p = camposPagamentoYelumPayload("Yelum", "Débito em Conta", {
      contaDebito: { ...conta, agenciaDv: "9" } as typeof conta,
      cienteTitularConta: true,
    });
    expect(p).toEqual({ contaDebito: conta, cienteTitularConta: true });
    expect("agenciaDv" in (p.contaDebito ?? {})).toBe(false);
    expect("cartao" in p).toBe(false);
  });
  it("formas com cartão não pedem dados e não enviam cartao", () => {
    for (const f of ["Cartão de Crédito", "Boleto + Cartão de Crédito"]) {
      expect(erroPagamentoYelum("Yelum", f, undefined)).toBeNull();
      expect(camposPagamentoYelumPayload("Yelum", f, undefined)).toEqual({});
    }
    expect(AVISO_CARTAO_YELUM).toMatch(/não pede os dados do cartão/);
  });
});

describe("limite da conta (campo do portal: 11 caracteres)", () => {
  it("aceita até 9 dígitos + hífen + dígito", () => {
    expect(validarContaYelum({ ...conta, conta: "123456789-0" }).conta).toBeUndefined();
  });
  it("recusa 10 dígitos + hífen + dígito (12 caracteres não cabem no portal)", () => {
    expect(validarContaYelum({ ...conta, conta: "1234567890-1" }).conta).toBeDefined();
  });
});
