import { beforeEach, describe, expect, it, vi } from "vitest";

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
        is: vi.fn((...args: unknown[]) => {
          mock.operations.push(["is", ...args]);
          return builder;
        }),
        order: vi.fn((...args: unknown[]) => {
          mock.operations.push(["order", ...args]);
          return Promise.resolve(mock.result);
        }),
      };
      return builder;
    }),
  },
}));

import { fetchAtenderAgoraLeads } from "@/lib/nav-badges";

describe("fila do badge Atender agora", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
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
    mock.result = { data: [], error: new Error("consulta indisponível") };

    await expect(fetchAtenderAgoraLeads("vendedor-1")).rejects.toThrow("consulta indisponível");
  });
});
