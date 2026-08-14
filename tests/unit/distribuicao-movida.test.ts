import { describe, expect, it } from "vitest";
import {
  aliasMovidaSchema,
  lojaMovidaSchema,
  membroPoolMovidaSchema,
  normalizarChaveLojaMovida,
  somarPendenciasAliasesMovida,
} from "@/lib/distribuicao-movida";

describe("configuração da distribuição Movida", () => {
  it("normaliza a chave da loja como o banco", () => {
    expect(normalizarChaveLojaMovida("  São José / Centro  ")).toBe("sao-jose-centro");
  });

  it("valida aliases adicionais com as constraints do banco", () => {
    expect(aliasMovidaSchema.parse("  Loja Aeroporto  ")).toBe("Loja Aeroporto");
    expect(aliasMovidaSchema.safeParse("x".repeat(161)).success).toBe(false);
  });

  it("soma pendências de todos os aliases vinculados à rota", () => {
    const pendencias = new Map([
      ["loja-centro", 2],
      ["centro-curitiba", 3],
      ["outra-loja", 7],
    ]);

    expect(somarPendenciasAliasesMovida(["loja-centro", "centro-curitiba"], pendencias)).toBe(5);
  });

  it("aceita um pool com um único vendedor e peso padrão", () => {
    const membro = membroPoolMovidaSchema.parse({
      vendedorId: "00000000-0000-4000-8000-000000000001",
      peso: "1",
      limiteDiario: null,
      ativo: true,
    });
    expect(membro).toMatchObject({ peso: 1, limiteDiario: null });
  });

  it("recusa peso fracionário e nome acima da constraint", () => {
    expect(
      membroPoolMovidaSchema.safeParse({
        vendedorId: "00000000-0000-4000-8000-000000000001",
        peso: "1.5",
        limiteDiario: "10",
        ativo: true,
      }).success,
    ).toBe(false);
    expect(
      lojaMovidaSchema.safeParse({
        nome: "x".repeat(121),
        alias: "loja-a",
        empresaId: "00000000-0000-4000-8000-000000000001",
        ativa: true,
        exigirOnline: false,
      }).success,
    ).toBe(false);
  });
});
