import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Teste de caracterização da query e do dedupe de `/venda/em-finalizacao` (T6, Pipeline V12).
 *
 * Captura o comportamento ATUAL de `fetchEmFinalizacaoRows` e `dedupTentativas`
 * (extraídas do `load()` de `em-finalizacao.tsx` só para viabilizar este teste
 * — o projeto não tem jsdom/testing-library configurado, então não dá pra
 * montar o componente). A ideia é rodar este teste antes e depois de trocar:
 *   - o filtro de status hardcoded (`["enviada", "falha"]`) por
 *     `TRANSMISSAO_EM_ABERTO_STATUSES` (de `@/lib/lead-etapa`);
 *   - o dedupe manual (`Set` + loop) por `primeiraOcorrenciaPorChave`;
 * e confirmar que o comportamento efetivo não mudou em nenhum dos dois casos.
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
  dedupTentativas,
  fetchEmFinalizacaoRows,
  type TentativaRow,
} from "@/routes/_authenticated/venda/em-finalizacao";
import { TRANSMISSAO_EM_ABERTO_STATUSES } from "@/lib/lead-etapa";

describe("query de tentativas de transmissão em aberto (/venda/em-finalizacao)", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.result = { data: [], error: null };
  });

  it("filtra cotacao_transmissoes pelos status de TRANSMISSAO_EM_ABERTO_STATUSES, ordenadas por criado_em desc, limitadas a 500", async () => {
    await fetchEmFinalizacaoRows();

    expect(mock.operations).toContainEqual(["from", "cotacao_transmissoes"]);
    expect(mock.operations).toContainEqual(["order", "criado_em", { ascending: false }]);
    expect(mock.operations).toContainEqual(["limit", 500]);

    // Filtro efetivo de status: hoje é `.in("status", ["enviada", "falha"])`
    // — mesmo valor que `TRANSMISSAO_EM_ABERTO_STATUSES` carrega hoje.
    expect(TRANSMISSAO_EM_ABERTO_STATUSES).toEqual(["enviada", "falha"]);
    const eqStatus = mock.operations.find((op) => op[0] === "eq" && op[1] === "status");
    const inStatus = mock.operations.find((op) => op[0] === "in" && op[1] === "status");
    expect(eqStatus ?? inStatus).toBeDefined();
    const statusFiltrado = (eqStatus ?? inStatus)?.[2];
    if (Array.isArray(statusFiltrado)) {
      expect(statusFiltrado).toEqual([...TRANSMISSAO_EM_ABERTO_STATUSES]);
    } else {
      expect(statusFiltrado).toBe(TRANSMISSAO_EM_ABERTO_STATUSES[0]);
    }
  });

  it("propaga o resultado (data/error) do Supabase sem transformação", async () => {
    mock.result = { data: [{ id: "tent-1" }], error: null };

    await expect(fetchEmFinalizacaoRows()).resolves.toEqual(mock.result);
  });
});

function tentativa(overrides: Partial<TentativaRow> & { cotacao_id: string }): TentativaRow {
  return {
    id: `tent-${overrides.cotacao_id}-${overrides.criado_em ?? "0"}`,
    status: "enviada",
    motivo: null,
    mensagem: null,
    seguradora: "Porto Seguro",
    premio: 1000,
    forma_pagamento: "boleto",
    criado_em: "2026-01-01T00:00:00.000Z",
    proposta_id: null,
    cotacoes: { numero: 1, segurado: [{ nome: "Fulano" }], veiculo: [] },
    ...overrides,
  };
}

describe("dedupTentativas", () => {
  it("com múltiplas tentativas para a mesma cotacao_id, mantém só a primeira da lista (mais recente, já que a query ordena por criado_em desc)", () => {
    const rows: TentativaRow[] = [
      tentativa({
        cotacao_id: "cot-1",
        criado_em: "2026-02-01T00:00:00.000Z",
        status: "falha",
        motivo: "recusa-portal",
      }),
      tentativa({
        cotacao_id: "cot-1",
        criado_em: "2026-01-01T00:00:00.000Z",
        status: "enviada",
      }),
    ];

    const resultado = dedupTentativas(rows);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].criadoEm).toBe("2026-02-01T00:00:00.000Z");
    expect(resultado[0].status).toBe("falha");
    expect(resultado[0].motivo).toBe("recusa-portal");
  });

  it("preserva a ordem de entrada e não depende de reordenar por criado_em internamente (se a lista chegar fora de ordem, a 'mais recente' escolhida é a primeira da lista, não a de maior data)", () => {
    const rows: TentativaRow[] = [
      tentativa({ cotacao_id: "cot-1", criado_em: "2026-01-01T00:00:00.000Z" }), // mais antiga, mas primeira da lista
      tentativa({ cotacao_id: "cot-1", criado_em: "2026-03-01T00:00:00.000Z" }), // mais recente, mas segunda
    ];

    const resultado = dedupTentativas(rows);

    expect(resultado).toHaveLength(1);
    expect(resultado[0].criadoEm).toBe("2026-01-01T00:00:00.000Z");
  });

  it("com tentativas para cotacoes distintas, mantém uma linha por cotacao_id", () => {
    const rows: TentativaRow[] = [
      tentativa({ cotacao_id: "cot-1", criado_em: "2026-02-01T00:00:00.000Z" }),
      tentativa({ cotacao_id: "cot-2", criado_em: "2026-02-02T00:00:00.000Z" }),
      tentativa({ cotacao_id: "cot-1", criado_em: "2026-01-01T00:00:00.000Z" }),
    ];

    const resultado = dedupTentativas(rows);

    expect(resultado.map((r) => r.cotacaoId)).toEqual(["cot-1", "cot-2"]);
  });

  it("data null retorna array vazio", () => {
    expect(dedupTentativas(null)).toEqual([]);
  });

  it("mapeia os campos de TentativaRow (snake_case) para Row (camelCase) corretamente", () => {
    const rows: TentativaRow[] = [
      tentativa({
        cotacao_id: "cot-1",
        proposta_id: "prop-1",
        forma_pagamento: "cartao",
        cotacoes: {
          numero: 42,
          segurado: [{ nome: "Ciclano" }],
          veiculo: [
            { marca_nome: "Fiat", modelo_nome: "Uno", ano_modelo: "2020", placa: "ABC1D23" },
          ],
        },
      }),
    ];

    const resultado = dedupTentativas(rows);

    expect(resultado[0]).toMatchObject({
      cotacaoId: "cot-1",
      propostaId: "prop-1",
      formaPagamento: "cartao",
      numero: 42,
      segurado: "Ciclano",
      veiculo: "Fiat Uno 2020 · ABC1D23",
    });
  });
});
