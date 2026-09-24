import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `fetchPipeline{Ramos,Origens,Motivos}Disponiveis` (`@/lib/pipeline-query`)
 * — Pipeline V12, T10b.
 *
 * Ressalva do revisor na T7/T10: as contagens dos 3 selects de filtro eram
 * globais (buscadas uma vez, sem considerar os outros filtros já ativos).
 * Este teste cobre a correção: cada fetcher aceita os OUTROS filtros ativos
 * (nunca o próprio campo) e aplica `.eq()/.in()/.lte()` equivalentes aos de
 * `fetchPipelinePagina`, incluindo a lista de `etapas` (Estágio/Status).
 */

type Operation = [string, ...unknown[]];

const mock = vi.hoisted(() => ({
  operations: [] as Operation[],
  result: { data: [] as unknown[], error: null as Error | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      mock.operations.push(["from", table]);
      const builder = {
        select: vi.fn((...args: unknown[]) => {
          mock.operations.push(["select", ...args]);
          return builder;
        }),
        not: vi.fn((...args: unknown[]) => {
          mock.operations.push(["not", ...args]);
          return builder;
        }),
        eq: vi.fn((...args: unknown[]) => {
          mock.operations.push(["eq", ...args]);
          return builder;
        }),
        in: vi.fn((...args: unknown[]) => {
          mock.operations.push(["in", ...args]);
          return builder;
        }),
        lte: vi.fn((...args: unknown[]) => {
          mock.operations.push(["lte", ...args]);
          return builder;
        }),
        then: (resolve: (result: typeof mock.result) => unknown) => resolve(mock.result),
      };
      return builder;
    }),
  },
}));

import {
  fetchPipelineMotivosDisponiveis,
  fetchPipelineOrigensDisponiveis,
  fetchPipelineRamosDisponiveis,
} from "@/lib/pipeline-query";

describe("fetchPipeline*Disponiveis — contagem condicionada aos outros filtros", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
  });

  it("fetchPipelineOrigensDisponiveis aplica o filtro de ramo (mas não o de origem)", async () => {
    mock.result = {
      data: [{ origem: "site" }, { origem: "site" }, { origem: "indicacao" }],
      error: null,
    };

    const { opcoes, error } = await fetchPipelineOrigensDisponiveis({ ramo: "auto" });

    expect(error).toBeNull();
    expect(mock.operations).toContainEqual(["eq", "ramo", "auto"]);
    expect(mock.operations.find((op) => op[0] === "eq" && op[1] === "origem")).toBeUndefined();
    expect(opcoes).toEqual([
      { valor: "indicacao", total: 1 },
      { valor: "site", total: 2 },
    ]);
  });

  it("fetchPipelineRamosDisponiveis nunca se autofiltra por ramo", async () => {
    await fetchPipelineRamosDisponiveis({ origem: "site", motivoPerda: "preco", paradoHaDias: 7 });

    expect(mock.operations.find((op) => op[0] === "eq" && op[1] === "ramo")).toBeUndefined();
    expect(mock.operations).toContainEqual(["eq", "origem", "site"]);
    expect(mock.operations).toContainEqual(["eq", "motivo_perda", "preco"]);
    expect(mock.operations.some((op) => op[0] === "lte" && op[1] === "atualizado_em")).toBe(true);
  });

  it("fetchPipelineMotivosDisponiveis nunca se autofiltra por motivo_perda", async () => {
    await fetchPipelineMotivosDisponiveis({ ramo: "auto", origem: "site" });

    expect(
      mock.operations.find((op) => op[0] === "eq" && op[1] === "motivo_perda"),
    ).toBeUndefined();
    expect(mock.operations).toContainEqual(["eq", "ramo", "auto"]);
    expect(mock.operations).toContainEqual(["eq", "origem", "site"]);
  });

  it('aplica a lista de etapas (Estágio/Status) via .in("etapa", ...)', async () => {
    await fetchPipelineOrigensDisponiveis({ etapas: ["negociacao", "perdido"] });

    expect(mock.operations).toContainEqual(["in", "etapa", ["negociacao", "perdido"]]);
  });

  it("sem filtros ativos, não aplica nenhum .eq/.in/.lte além do .not do próprio campo", async () => {
    await fetchPipelineRamosDisponiveis();

    expect(mock.operations.filter((op) => op[0] === "eq")).toHaveLength(0);
    expect(mock.operations.filter((op) => op[0] === "in")).toHaveLength(0);
    expect(mock.operations.filter((op) => op[0] === "lte")).toHaveLength(0);
    expect(mock.operations).toContainEqual(["not", "ramo", "is", null]);
  });
});
