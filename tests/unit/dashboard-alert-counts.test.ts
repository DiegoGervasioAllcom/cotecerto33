import { beforeEach, describe, expect, it, vi } from "vitest";

type Result = { count: number | null; error: Error | null };
type RpcResult = { data: number | null; error: Error | null };
type Operation = [string, ...unknown[]];

const mock = vi.hoisted(() => ({
  queryOptions: undefined as
    | { enabled: boolean; queryFn: () => Promise<Record<string, number>> }
    | undefined,
  results: [] as Result[],
  queries: [] as { table: string; operations: Operation[] }[],
  rpcResults: [] as RpcResult[],
  rpcCalls: [] as { fn: string; args: unknown }[],
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options) => {
    mock.queryOptions = options;
    return options;
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const query = { table, operations: [] as Operation[] };
      mock.queries.push(query);
      const resultIndex = mock.queries.length - 1;
      const builder = {
        select: vi.fn((...args: unknown[]) => {
          query.operations.push(["select", ...args]);
          return builder;
        }),
        eq: vi.fn((...args: unknown[]) => {
          query.operations.push(["eq", ...args]);
          return builder;
        }),
        is: vi.fn((...args: unknown[]) => {
          query.operations.push(["is", ...args]);
          return builder;
        }),
        or: vi.fn((...args: unknown[]) => {
          query.operations.push(["or", ...args]);
          return builder;
        }),
        not: vi.fn((...args: unknown[]) => {
          query.operations.push(["not", ...args]);
          return builder;
        }),
        in: vi.fn((...args: unknown[]) => {
          query.operations.push(["in", ...args]);
          return builder;
        }),
        gte: vi.fn((...args: unknown[]) => {
          query.operations.push(["gte", ...args]);
          return builder;
        }),
        lt: vi.fn((...args: unknown[]) => {
          query.operations.push(["lt", ...args]);
          return builder;
        }),
        then: (resolve: (result: Result) => unknown) =>
          Promise.resolve(mock.results[resultIndex]).then(resolve),
      };
      return builder;
    }),
    rpc: vi.fn((fn: string, args: unknown) => {
      mock.rpcCalls.push({ fn, args });
      const resultIndex = mock.rpcCalls.length - 1;
      return {
        then: (resolve: (result: RpcResult) => unknown) =>
          Promise.resolve(mock.rpcResults[resultIndex]).then(resolve),
      };
    }),
  },
}));

import { useDashboardAlertCounts } from "@/components/comando/use-dashboard-alert-counts";

const period = {
  inicio: "2026-07-01T00:00:00.000Z",
  fim: "2026-08-01T00:00:00.000Z",
};

describe("consultas dos alertas reais da Visão geral", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T12:00:00.000Z"));
    mock.queryOptions = undefined;
    // 6 consultas via .from(): sem-atendimento, sla-estourado, vendas-não-pagas,
    // estornos, renovações e vendedores em atenção/travado (profiles).
    mock.results = Array.from({ length: 6 }, (_, index) => ({
      count: index + 1,
      error: null,
    }));
    // 2 RPCs: franquias abaixo da meta e pendentes da seguradora.
    mock.rpcResults = [
      { data: 10, error: null },
      { data: 20, error: null },
    ];
    mock.queries.length = 0;
    mock.rpcCalls.length = 0;
  });

  it("faz seis contagens exact/head e duas RPCs, preservando a RLS do client autenticado", async () => {
    useDashboardAlertCounts(period, Date.now(), 180);
    const result = await mock.queryOptions?.queryFn();

    expect(result).toEqual({
      semAtendimento: 1,
      slaEstourado: 2,
      vendasNaoPagas: 3,
      estornos: 4,
      renovacoes: 5,
      franquiasAbaixoMeta: 10,
      vendedoresAtencao: 6,
      pendentesSeguradora: 20,
    });
    expect(mock.queries).toHaveLength(6);
    for (const query of mock.queries) {
      expect(query.operations[0]).toEqual(["select", "id", { count: "exact", head: true }]);
    }
    expect(mock.queries[0]?.operations.some(([operation]) => operation === "gte")).toBe(false);
    expect(mock.queries[0]?.operations.some(([operation]) => operation === "lt")).toBe(false);
    expect(mock.queries[1]?.operations).toContainEqual([
      "lt",
      "criado_em",
      "2026-07-29T11:57:00.000Z",
    ]);
    expect(mock.queries[2]?.operations).toContainEqual(["gte", "emitida_em", period.inicio]);
    expect(mock.queries[2]?.operations).toContainEqual(["lt", "emitida_em", period.fim]);
    expect(mock.queries[4]?.operations).toContainEqual(["gte", "vencimento", "2026-07-01"]);
    expect(mock.queries[4]?.operations).toContainEqual(["lt", "vencimento", "2026-08-01"]);
    expect(mock.queries[5]?.operations).toContainEqual([
      "in",
      "performance_status",
      ["atencao", "travado"],
    ]);
    expect(mock.queries[5]?.operations).toContainEqual(["is", "desligado_em", null]);

    expect(mock.rpcCalls).toHaveLength(2);
    expect(mock.rpcCalls[0]).toEqual({
      fn: "franquias_abaixo_meta_visao_geral",
      args: { p_inicio: period.inicio, p_fim: period.fim },
    });
    expect(mock.rpcCalls[1]).toEqual({
      fn: "contar_pendentes_seguradora_visao_geral",
      args: { p_inicio: period.inicio, p_fim: period.fim },
    });
  });

  it("não transforma falha de leitura em contagem zero (consulta .from())", async () => {
    mock.results[2] = { count: null, error: new Error("RLS/consulta indisponível") };
    useDashboardAlertCounts(period, Date.now(), 180);

    await expect(mock.queryOptions?.queryFn()).rejects.toThrow("RLS/consulta indisponível");
  });

  it("não transforma falha de leitura em contagem zero (RPC)", async () => {
    mock.rpcResults[1] = { data: null, error: new Error("RPC indisponível") };
    useDashboardAlertCounts(period, Date.now(), 180);

    await expect(mock.queryOptions?.queryFn()).rejects.toThrow("RPC indisponível");
  });

  it("não consulta antes de o período ser normalizado", () => {
    useDashboardAlertCounts(undefined, Date.now(), 180);

    expect(mock.queryOptions?.enabled).toBe(false);
    expect(mock.queries).toHaveLength(0);
  });
});
