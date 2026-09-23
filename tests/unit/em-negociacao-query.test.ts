import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste de caracterização da query de `/venda/em-negociacao` (T5, Pipeline V12).
 *
 * Captura a query ATUAL de `fetchEmNegociacaoRows` (extraída do `loadRows` de
 * `em-negociacao.tsx` só para viabilizar este teste — o projeto não tem
 * jsdom/testing-library configurado, então não dá pra montar o componente).
 * A ideia é rodar este teste antes e depois de trocar o filtro de status
 * hardcoded (`["calculada", "proposta"]`) por `EM_NEGOCIACAO_STATUSES` (de
 * `@/lib/lead-etapa`) e confirmar que o filtro efetivo não mudou.
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
        eq: vi.fn((...args: unknown[]) => {
          mock.operations.push(["eq", ...args]);
          return builder;
        }),
        in: vi.fn((...args: unknown[]) => {
          mock.operations.push(["in", ...args]);
          return builder;
        }),
        order: vi.fn((...args: unknown[]) => {
          mock.operations.push(["order", ...args]);
          return builder;
        }),
        limit: vi.fn((...args: unknown[]) => {
          mock.operations.push(["limit", ...args]);
          return Promise.resolve(mock.result);
        }),
      };
      return builder;
    }),
  },
}));

import { fetchEmNegociacaoRows } from "@/routes/_authenticated/venda/em-negociacao";
import { EM_NEGOCIACAO_STATUSES } from "@/lib/lead-etapa";

describe("query de cotações em negociação (/venda/em-negociacao)", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
  });

  it("filtra cotacoes pelos status de EM_NEGOCIACAO_STATUSES, ordenadas por atualizado_em desc, limitadas a 200", async () => {
    await fetchEmNegociacaoRows();

    expect(mock.operations).toContainEqual(["from", "cotacoes"]);
    expect(mock.operations).toContainEqual(["order", "atualizado_em", { ascending: false }]);
    expect(mock.operations).toContainEqual(["limit", 200]);

    // Filtro efetivo de status: hoje é `.in("status", ["calculada", "proposta"])`
    // — mesmo valor que `EM_NEGOCIACAO_STATUSES` carrega hoje.
    expect(EM_NEGOCIACAO_STATUSES).toEqual(["calculada", "proposta"]);
    const eqStatus = mock.operations.find((op) => op[0] === "eq" && op[1] === "status");
    const inStatus = mock.operations.find((op) => op[0] === "in" && op[1] === "status");
    expect(eqStatus ?? inStatus).toBeDefined();
    const statusFiltrado = (eqStatus ?? inStatus)?.[2];
    if (Array.isArray(statusFiltrado)) {
      expect(statusFiltrado).toEqual([...EM_NEGOCIACAO_STATUSES]);
    } else {
      expect(statusFiltrado).toBe(EM_NEGOCIACAO_STATUSES[0]);
    }
  });

  it("propaga o resultado (data/error) do Supabase sem transformação", async () => {
    mock.result = { data: [{ id: "cot-1" }], error: null };

    await expect(fetchEmNegociacaoRows()).resolves.toEqual(mock.result);
  });
});
