import { describe, it, expect } from "vitest";
import { veiculoSchema } from "@/lib/schemas/cotacaoVeiculo.schema";
import { perfilSchema } from "@/lib/schemas/cotacaoPerfil.schema";
import { coberturasSchema } from "@/lib/schemas/cotacaoCoberturas.schema";

describe("veiculoSchema", () => {
  it("aceita objeto vazio (nenhum campo é obrigatório)", () => {
    expect(veiculoSchema.safeParse({}).success).toBe(true);
  });

  it("aceita todos os campos opcionais preenchidos com strings vazias", () => {
    expect(
      veiculoSchema.safeParse({
        placa: "",
        chassi: "",
        renavam: "",
        marcaCodigo: "",
        modeloCodigo: "",
        marcaNome: "",
        modeloNome: "",
        anoModelo: "",
        anoFab: "",
        combustivel: "",
        cor: "",
        banco: "",
        usoComercial: "",
        kmMensal: "",
        fipeValor: "",
      }).success,
    ).toBe(true);
  });

  it("aceita dados completos válidos", () => {
    expect(
      veiculoSchema.safeParse({
        placa: "ABC1D23",
        chassi: "9BWZZZ377VT004251",
        renavam: "12345678901",
        marcaNome: "Volkswagen",
        modeloNome: "Gol",
        anoModelo: "2024",
        anoFab: "2023",
        combustivel: "Flex",
        cor: "Prata",
      }).success,
    ).toBe(true);
  });

  it("rejeita placa maior que 8", () => {
    expect(veiculoSchema.safeParse({ placa: "a".repeat(9) }).success).toBe(false);
  });

  it("rejeita chassi maior que 17", () => {
    expect(veiculoSchema.safeParse({ chassi: "a".repeat(18) }).success).toBe(false);
  });

  it("rejeita renavam maior que 11", () => {
    expect(veiculoSchema.safeParse({ renavam: "1".repeat(12) }).success).toBe(false);
  });

  it("rejeita marcaNome maior que 150", () => {
    expect(veiculoSchema.safeParse({ marcaNome: "a".repeat(151) }).success).toBe(false);
  });

  it("rejeita anoModelo maior que 4", () => {
    expect(veiculoSchema.safeParse({ anoModelo: "20244" }).success).toBe(false);
  });
});

describe("perfilSchema", () => {
  it("aceita objeto vazio (nenhum campo é obrigatório)", () => {
    expect(perfilSchema.safeParse({}).success).toBe(true);
  });

  it("aceita todos os campos opcionais preenchidos com strings vazias", () => {
    expect(
      perfilSchema.safeParse({
        condCpf: "",
        condNome: "",
        condSexo: "",
        condEstadoCivil: "",
        profissao: "",
        cepPernoite: "",
      }).success,
    ).toBe(true);
  });

  it("aceita dados completos válidos", () => {
    expect(
      perfilSchema.safeParse({
        condCpf: "123.456.789-00",
        condNome: "Fulano de Tal",
        condSexo: "Masculino",
        condEstadoCivil: "Solteiro(a)",
        profissao: "Engenheiro",
        cepPernoite: "01310-100",
      }).success,
    ).toBe(true);
  });

  it("rejeita cond_cpf com 10 dígitos", () => {
    expect(perfilSchema.safeParse({ condCpf: "1234567890" }).success).toBe(false);
  });

  it("aceita cond_cpf com 14 dígitos (CNPJ)", () => {
    expect(perfilSchema.safeParse({ condCpf: "12345678000190" }).success).toBe(true);
  });

  it("rejeita cep_pernoite com 7 dígitos", () => {
    expect(perfilSchema.safeParse({ cepPernoite: "1234567" }).success).toBe(false);
  });

  it("aceita cep_pernoite com 8 dígitos", () => {
    expect(perfilSchema.safeParse({ cepPernoite: "01310100" }).success).toBe(true);
  });

  it("rejeita condNome maior que 150", () => {
    expect(perfilSchema.safeParse({ condNome: "a".repeat(151) }).success).toBe(false);
  });

  it("rejeita profissao maior que 150", () => {
    expect(perfilSchema.safeParse({ profissao: "a".repeat(151) }).success).toBe(false);
  });
});

describe("coberturasSchema", () => {
  it("aceita objeto vazio (nenhum campo é obrigatório)", () => {
    expect(coberturasSchema.safeParse({}).success).toBe(true);
  });

  it("aceita todos os campos opcionais preenchidos com strings vazias", () => {
    expect(
      coberturasSchema.safeParse({
        tipoCobertura: "",
        casco: "",
        cascoValor: "",
        franquia: "",
        appMorte: "",
        appInvalidez: "",
        dmh: "",
        rcfDm: "",
        rcfDc: "",
        carroReserva: "",
        assist24: "",
      }).success,
    ).toBe(true);
  });

  it("aceita dados completos válidos", () => {
    expect(
      coberturasSchema.safeParse({
        tipoCobertura: "Compreensiva",
        casco: "100% Tabela FIPE",
        franquia: "Normal",
        appMorte: "R$ 10.000,00",
        rcfDm: "R$ 100.000,00",
        carroReserva: "7 dias",
        assist24: "Básica",
      }).success,
    ).toBe(true);
  });

  it("rejeita tipoCobertura maior que 50", () => {
    expect(coberturasSchema.safeParse({ tipoCobertura: "a".repeat(51) }).success).toBe(false);
  });

  it("rejeita rcfDm maior que 100", () => {
    expect(coberturasSchema.safeParse({ rcfDm: "a".repeat(101) }).success).toBe(false);
  });

  it("rejeita carroReserva maior que 30", () => {
    expect(coberturasSchema.safeParse({ carroReserva: "a".repeat(31) }).success).toBe(false);
  });
});
