import { describe, expect, it } from "vitest";
import { RAMOS_ATIVIDADE_PORTO } from "@/components/venda/novo-lead/enumsRamoAtividade";
import { erroDeclaracoesPorto } from "@/lib/transmissao-porto";
import {
  dadosComplementaresTransmissaoPortoSchema,
  dadosComplementaresTransmissaoSchema,
} from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";

const base = {
  rg: "12.345.678-9",
  dataEmissaoRg: "15/08/2020",
  orgaoEmissorRg: "SSP/SP",
  cepResidencial: "04567-090",
  numeroEndereco: "123",
  email: "cliente@email.com",
  mesmoEnderecoCorrespondencia: true,
  enderecoCorrespondencia: { cep: "", logradouro: "", numero: "", bairro: "", cidade: "", uf: "" },
  renavam: "12345678901",
  corVeiculo: "Branco",
  diaVencimentoDemaisParcelas: "15",
  desejaReceberPropostaPorEmail: "Não",
} as const;

const porto = {
  rendaMensal: "De R$ 2.501,00 a R$ 5.000,00",
  ramoAtividade: "Advogados",
  pessoaPoliticamenteExposta: "Não",
} as const;

describe("dados complementares — Porto", () => {
  it("o schema geral NÃO exige renda/ramo/PEP (outras seguradoras)", () => {
    expect(dadosComplementaresTransmissaoSchema.safeParse(base).success).toBe(true);
  });

  it("o schema da Porto aceita com as três declarações", () => {
    const r = dadosComplementaresTransmissaoPortoSchema.safeParse({ ...base, ...porto });
    expect(r.success).toBe(true);
  });

  it.each([
    ["rendaMensal", undefined],
    ["pessoaPoliticamenteExposta", undefined],
    ["ramoAtividade", undefined],
  ])("a Porto exige %s", (campo, valor) => {
    const r = dadosComplementaresTransmissaoPortoSchema.safeParse({
      ...base,
      ...porto,
      [campo]: valor,
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === campo)).toBe(true);
  });

  it("não há valor padrão: sem responder, falha (o robô não assume declaração do cliente)", () => {
    const r = dadosComplementaresTransmissaoPortoSchema.safeParse(base);
    expect(r.success).toBe(false);
    if (!r.success) {
      const campos = r.error.issues.map((i) => i.path[0]);
      expect(campos).toEqual(
        expect.arrayContaining(["rendaMensal", "pessoaPoliticamenteExposta", "ramoAtividade"]),
      );
    }
  });

  it("rejeita renda e PEP fora das opções do portal", () => {
    expect(
      dadosComplementaresTransmissaoPortoSchema.safeParse({
        ...base,
        ...porto,
        rendaMensal: "Muita",
      }).success,
    ).toBe(false);
    expect(
      dadosComplementaresTransmissaoPortoSchema.safeParse({
        ...base,
        ...porto,
        pessoaPoliticamenteExposta: "Talvez",
      }).success,
    ).toBe(false);
  });

  it("o ramo precisa ser item do catálogo (texto livre não passa)", () => {
    const r = dadosComplementaresTransmissaoPortoSchema.safeParse({
      ...base,
      ...porto,
      ramoAtividade: "Advogado",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/lista/i);
  });

  it("TODOS os ramos do catálogo passam no schema (inclusive os de mais de 100 caracteres)", () => {
    const longos = RAMOS_ATIVIDADE_PORTO.filter((r) => r.length > 100);
    expect(longos.length).toBeGreaterThan(0); // regressão: um `.max(100)` os recusaria
    const recusados = RAMOS_ATIVIDADE_PORTO.filter(
      (ramoAtividade) =>
        !dadosComplementaresTransmissaoPortoSchema.safeParse({ ...base, ...porto, ramoAtividade })
          .success,
    );
    expect(recusados).toEqual([]);
  });

  it("e a validação do servidor aceita todos os ramos do catálogo", () => {
    const recusados = RAMOS_ATIVIDADE_PORTO.filter(
      (ramoAtividade) => erroDeclaracoesPorto("Porto", { ...porto, ramoAtividade }) !== null,
    );
    expect(recusados).toEqual([]);
  });
});

describe("dados complementares — Porto: telefones fixos", () => {
  it("telefones em branco são válidos", () => {
    expect(dadosComplementaresTransmissaoPortoSchema.safeParse({ ...base, ...porto }).success).toBe(
      true,
    );
  });

  it("fixo válido passa; celular no fixo é recusado no campo certo", () => {
    expect(
      dadosComplementaresTransmissaoPortoSchema.safeParse({
        ...base,
        ...porto,
        dddTelefoneResidencial: "11",
        telefoneResidencial: "3333-4444",
      }).success,
    ).toBe(true);

    const r = dadosComplementaresTransmissaoPortoSchema.safeParse({
      ...base,
      ...porto,
      dddTelefoneComercial: "11",
      telefoneComercial: "967922075",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "telefoneComercial");
      expect(issue?.message).toMatch(/celular não é aceito/);
    }
  });

  it("outras seguradoras não validam os telefones (campos ignorados)", () => {
    expect(
      dadosComplementaresTransmissaoSchema.safeParse({
        ...base,
        dddTelefoneResidencial: "1",
        telefoneResidencial: "967922075",
      }).success,
    ).toBe(true);
  });
});
