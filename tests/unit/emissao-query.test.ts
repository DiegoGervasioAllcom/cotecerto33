import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste de caracterização da query de `/venda/emissao` (T7, Pipeline V12;
 * V12.3.2 acrescenta as propostas com `transmissao_status='falha'`).
 *
 * Captura a query ATUAL de `fetchEmissaoRows` (extraída do `loadRows` de
 * `emissao.tsx` só para viabilizar este teste — o projeto não tem
 * jsdom/testing-library configurado, então não dá pra montar o componente).
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

import { fetchEmissaoRows } from "@/routes/_authenticated/venda/emissao";
import { PROPOSTA_TRANSMITIDA_STATUS } from "@/lib/lead-etapa";

describe("query de propostas transmitidas (/venda/emissao)", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
  });

  it("filtra propostas transmitidas OU com pendência da seguradora, ordenadas por transmitida_em desc, limitadas a 200", async () => {
    await fetchEmissaoRows();

    expect(mock.operations).toContainEqual(["from", "propostas"]);
    expect(mock.operations).toContainEqual(["order", "transmitida_em", { ascending: false }]);
    expect(mock.operations).toContainEqual(["limit", 200]);

    // Filtro efetivo de status: `.in("transmissao_status", ["transmitida", "falha"])`
    // — inclui a pendência da seguradora (V12.3.2) junto do sucesso.
    expect(PROPOSTA_TRANSMITIDA_STATUS).toBe("transmitida");
    const inStatus = mock.operations.find((op) => op[0] === "in" && op[1] === "transmissao_status");
    expect(inStatus).toBeDefined();
    expect(inStatus?.[2]).toEqual([PROPOSTA_TRANSMITIDA_STATUS, "falha"]);
  });

  it("propaga o resultado (data/error) do Supabase sem transformação", async () => {
    mock.result = { data: [{ id: "prop-1" }], error: null };

    await expect(fetchEmissaoRows()).resolves.toEqual(mock.result);
  });
});
