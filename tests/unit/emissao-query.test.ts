import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste de caracterização da query de `/venda/emissao` (T7, Pipeline V12;
 * V12.3.2 acrescenta as propostas com `transmissao_status='falha'`;
 * Frente 3 passa a filtrar por `responsavel_id` — decisão do usuário:
 * "Emissão & histórico" é "minhas propostas", não a empresa inteira).
 *
 * Captura a query ATUAL de `fetchEmissaoRows`
 * (`src/components/venda/emissao/queries.ts`) — o projeto não tem
 * jsdom/testing-library configurado, então não dá pra montar o componente.
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
import { PROPOSTA_SITUACAO_STATUSES } from "@/lib/proposta-situacao";

describe("query de propostas transmitidas (/venda/emissao)", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
  });

  it("filtra por responsavel_id (uid) e por todos os status conhecidos, ordenadas por transmitida_em desc, limitadas a 200", async () => {
    await fetchEmissaoRows("uid-vendedor-e2e");

    expect(mock.operations).toContainEqual(["from", "propostas"]);
    expect(mock.operations).toContainEqual(["eq", "responsavel_id", "uid-vendedor-e2e"]);
    expect(mock.operations).toContainEqual(["order", "transmitida_em", { ascending: false }]);
    expect(mock.operations).toContainEqual(["limit", 200]);

    // Filtro efetivo de status: `.in("transmissao_status", PROPOSTA_SITUACAO_STATUSES)`
    // — hoje só transmitida/falha existem de verdade, mas a query já fica
    // pronta para os status que a integração futura vai devolver
    // (bloqueada/analise/emitida/recusada — V12.1.25).
    expect(PROPOSTA_TRANSMITIDA_STATUS).toBe("transmitida");
    const inStatus = mock.operations.find((op) => op[0] === "in" && op[1] === "transmissao_status");
    expect(inStatus).toBeDefined();
    expect(inStatus?.[2]).toEqual(PROPOSTA_SITUACAO_STATUSES);
    expect(inStatus?.[2]).toContain("transmitida");
    expect(inStatus?.[2]).toContain("falha");
  });

  it("propaga o resultado (data/error) do Supabase sem transformação", async () => {
    mock.result = { data: [{ id: "prop-1" }], error: null };

    await expect(fetchEmissaoRows("uid-vendedor-e2e")).resolves.toEqual(mock.result);
  });
});
