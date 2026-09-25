import { beforeEach, describe, expect, it, vi } from "vitest";

type Operation = [string, ...unknown[]];

const mock = vi.hoisted(() => ({
  operations: [] as Operation[],
  result: { data: [] as unknown[], error: null as Error | null, count: null as number | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      mock.operations.push(["from", table]);
      const resolved = () => Promise.resolve(mock.result);
      const builder = {
        select: vi.fn((...args: unknown[]) => {
          mock.operations.push(["select", ...args]);
          return builder;
        }),
        eq: vi.fn((...args: unknown[]) => {
          mock.operations.push(["eq", ...args]);
          return builder;
        }),
        is: vi.fn((...args: unknown[]) => {
          mock.operations.push(["is", ...args]);
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
          return resolved();
        }),
        then: (...args: Parameters<Promise<typeof mock.result>["then"]>) =>
          resolved().then(...args),
      };
      return builder;
    }),
  },
}));

import {
  countEmCotacaoPendente,
  countEmFinalizacaoPendente,
  countEmNegociacaoPendente,
  fetchAtenderAgoraLeads,
} from "@/lib/nav-badges";

describe("fila do badge Atender agora", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null, count: null };
  });

  it("consulta somente leads novos do responsável, não arquivados e ainda não atendidos", async () => {
    mock.result.data = [
      {
        id: "lead-1",
        nome: "Cliente",
        contato: null,
        origem: "quiver",
        valor: null,
        criado_em: "2026-08-13T12:00:00.000Z",
        distribuido_em: "2026-08-13T12:01:00.000Z",
        dados: { veiculo: "Uno" },
        bloqueado: false,
      },
    ];

    await expect(fetchAtenderAgoraLeads("vendedor-1")).resolves.toHaveLength(1);
    expect(mock.operations).toContainEqual(["from", "leads"]);
    expect(mock.operations).toContainEqual(["eq", "responsavel_id", "vendedor-1"]);
    expect(mock.operations).toContainEqual(["eq", "status_pipeline", "novo"]);
    expect(mock.operations).toContainEqual(["eq", "arquivado", false]);
    expect(mock.operations).toContainEqual(["is", "ultimo_atendimento_em", null]);
    expect(mock.operations).toContainEqual([
      "order",
      "distribuido_em",
      { ascending: true, nullsFirst: true },
    ]);
  });

  it("propaga erro de leitura para o cache manter o último dado bem-sucedido", async () => {
    mock.result = { data: [], error: new Error("consulta indisponível"), count: null };

    await expect(fetchAtenderAgoraLeads("vendedor-1")).rejects.toThrow("consulta indisponível");
  });
});

describe("badges de venda contam só as cotações do vendedor logado", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null, count: 3 };
  });

  it("Em cotação filtra por responsavel_id e pelo status rascunho", async () => {
    await expect(countEmCotacaoPendente("vendedor-1")).resolves.toBe(3);
    expect(mock.operations).toContainEqual(["from", "cotacoes"]);
    expect(mock.operations).toContainEqual(["eq", "responsavel_id", "vendedor-1"]);
    expect(mock.operations).toContainEqual(["in", "status", ["rascunho"]]);
  });

  it("Em negociação soma as duas listas da tela (finalizada + aguardando cotação) do vendedor", async () => {
    await expect(countEmNegociacaoPendente("vendedor-1")).resolves.toBe(3);
    expect(mock.operations).toContainEqual(["from", "cotacoes"]);
    expect(mock.operations).toContainEqual(["eq", "responsavel_id", "vendedor-1"]);
    expect(mock.operations).toContainEqual([
      "in",
      "status",
      ["calculada", "proposta", "enviada_quiver", "erro_quiver"],
    ]);
  });

  it("Em finalização filtra as tentativas pelo responsável da cotação ligada", async () => {
    mock.result = { data: [], error: null, count: null };
    await expect(countEmFinalizacaoPendente("vendedor-1")).resolves.toBe(0);
    expect(mock.operations).toContainEqual(["from", "cotacao_transmissoes"]);
    expect(mock.operations).toContainEqual(["eq", "cotacoes.responsavel_id", "vendedor-1"]);
    expect(mock.operations).toContainEqual(["in", "status", ["enviada", "falha"]]);
  });

  it("Em finalização deduplica tentativas repetidas da mesma cotação do vendedor", async () => {
    mock.result = {
      data: [
        { cotacao_id: "cot-1", cotacoes: { responsavel_id: "vendedor-1" } },
        { cotacao_id: "cot-1", cotacoes: { responsavel_id: "vendedor-1" } },
        { cotacao_id: "cot-2", cotacoes: { responsavel_id: "vendedor-1" } },
      ],
      error: null,
      count: null,
    };
    await expect(countEmFinalizacaoPendente("vendedor-1")).resolves.toBe(2);
  });
});
