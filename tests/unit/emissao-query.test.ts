import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste de caracterização da query de `/venda/emissao` (T7, Pipeline V12).
 *
 * Captura a query ATUAL de `fetchEmissaoRows` (extraída do `loadRows` de
 * `emissao.tsx` só para viabilizar este teste — o projeto não tem
 * jsdom/testing-library configurado, então não dá pra montar o componente).
 * A ideia é rodar este teste antes e depois de trocar o filtro de status
 * hardcoded (`"transmitida"`) por `PROPOSTA_TRANSMITIDA_STATUS` (de
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

  it("filtra propostas por PROPOSTA_TRANSMITIDA_STATUS, ordenadas por transmitida_em desc, limitadas a 200", async () => {
    await fetchEmissaoRows();

    expect(mock.operations).toContainEqual(["from", "propostas"]);
    expect(mock.operations).toContainEqual(["order", "transmitida_em", { ascending: false }]);
    expect(mock.operations).toContainEqual(["limit", 200]);

    // Filtro efetivo de status: hoje é `.eq("transmissao_status", "transmitida")`
    // — mesmo valor que `PROPOSTA_TRANSMITIDA_STATUS` carrega hoje.
    expect(PROPOSTA_TRANSMITIDA_STATUS).toBe("transmitida");
    const eqStatus = mock.operations.find((op) => op[0] === "eq" && op[1] === "transmissao_status");
    expect(eqStatus).toBeDefined();
    expect(eqStatus?.[2]).toBe(PROPOSTA_TRANSMITIDA_STATUS);
  });

  it("propaga o resultado (data/error) do Supabase sem transformação", async () => {
    mock.result = { data: [{ id: "prop-1" }], error: null };

    await expect(fetchEmissaoRows()).resolves.toEqual(mock.result);
  });
});
