import { describe, expect, test } from "vitest";
import {
  IMPRIMIR_COTACAO_MAX_SEGURADORAS,
  imprimirCotacaoConfigSchema,
} from "@/lib/schemas/imprimirCotacao.schema";

const base = {
  modelo: "supper",
  tipo: "resumida",
  parcelas: [1],
  economia: false,
  colunado: false,
  comComissao: false,
} as const;

describe("imprimirCotacaoConfigSchema — limite de seguradoras", () => {
  test("aceita até o máximo", () => {
    const ids = Array.from({ length: IMPRIMIR_COTACAO_MAX_SEGURADORAS }, (_, i) => `s${i}`);
    expect(
      imprimirCotacaoConfigSchema.safeParse({ ...base, seguradorasSelecionadas: ids }).success,
    ).toBe(true);
  });

  test("recusa acima do máximo", () => {
    const ids = Array.from({ length: IMPRIMIR_COTACAO_MAX_SEGURADORAS + 1 }, (_, i) => `s${i}`);
    expect(
      imprimirCotacaoConfigSchema.safeParse({ ...base, seguradorasSelecionadas: ids }).success,
    ).toBe(false);
  });

  test("recusa vazio", () => {
    expect(
      imprimirCotacaoConfigSchema.safeParse({ ...base, seguradorasSelecionadas: [] }).success,
    ).toBe(false);
  });
});
