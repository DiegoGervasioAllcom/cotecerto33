import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste de caracterização das queries de `/venda/em-negociacao` (T5, Pipeline
 * V12; V12.3.4 divide a tela em duas listas — decisão do usuário: filtra por
 * `responsavel_id` como `emissao.tsx`/`agenda.tsx`, "Em negociação" é "minhas
 * cotações", não a empresa inteira).
 *
 * Captura a query ATUAL de `fetchCotacaoFinalizadaRows`/
 * `fetchAguardandoCotacaoRows` (`src/components/venda/em-negociacao/
 * queries.ts`) — o projeto não tem jsdom/testing-library configurado, então
 * não dá pra montar o componente.
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

import {
  fetchAguardandoCotacaoRows,
  fetchCotacaoFinalizadaRows,
} from "@/routes/_authenticated/venda/em-negociacao";
import { AGUARDANDO_CALCULO_STATUSES, EM_NEGOCIACAO_STATUSES } from "@/lib/lead-etapa";

describe("query de cotação finalizada (/venda/em-negociacao)", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
  });

  it("filtra por responsavel_id (uid) e por EM_NEGOCIACAO_STATUSES, ordenadas por atualizado_em desc, limitadas a 200", async () => {
    await fetchCotacaoFinalizadaRows("uid-vendedor-e2e");

    expect(mock.operations).toContainEqual(["from", "cotacoes"]);
    expect(mock.operations).toContainEqual(["eq", "responsavel_id", "uid-vendedor-e2e"]);
    expect(mock.operations).toContainEqual(["order", "atualizado_em", { ascending: false }]);
    expect(mock.operations).toContainEqual(["limit", 200]);

    expect(EM_NEGOCIACAO_STATUSES).toEqual(["calculada", "proposta"]);
    const inStatus = mock.operations.find((op) => op[0] === "in" && op[1] === "status");
    expect(inStatus).toBeDefined();
    expect(inStatus?.[2]).toEqual([...EM_NEGOCIACAO_STATUSES]);
  });

  it("propaga o resultado (data/error) do Supabase sem transformação", async () => {
    mock.result = { data: [{ id: "cot-1" }], error: null };

    await expect(fetchCotacaoFinalizadaRows("uid-vendedor-e2e")).resolves.toEqual(mock.result);
  });
});

describe("query de cotação aguardando cálculo (/venda/em-negociacao)", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
  });

  it("filtra por responsavel_id (uid) e por AGUARDANDO_CALCULO_STATUSES, ordenadas por atualizado_em desc, limitadas a 200", async () => {
    await fetchAguardandoCotacaoRows("uid-vendedor-e2e");

    expect(mock.operations).toContainEqual(["from", "cotacoes"]);
    expect(mock.operations).toContainEqual(["eq", "responsavel_id", "uid-vendedor-e2e"]);
    expect(mock.operations).toContainEqual(["order", "atualizado_em", { ascending: false }]);
    expect(mock.operations).toContainEqual(["limit", 200]);

    expect(AGUARDANDO_CALCULO_STATUSES).toEqual(["enviada_quiver", "erro_quiver"]);
    const inStatus = mock.operations.find((op) => op[0] === "in" && op[1] === "status");
    expect(inStatus).toBeDefined();
    expect(inStatus?.[2]).toEqual([...AGUARDANDO_CALCULO_STATUSES]);
  });

  it("propaga o resultado (data/error) do Supabase sem transformação", async () => {
    mock.result = { data: [{ id: "cot-2" }], error: null };

    await expect(fetchAguardandoCotacaoRows("uid-vendedor-e2e")).resolves.toEqual(mock.result);
  });
});
