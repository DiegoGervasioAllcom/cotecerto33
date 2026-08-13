import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TutorialDestination, TutorialStep } from "@/components/tutorial/tutorial-types";

type DestinationRow = Record<string, unknown>;
type DestinationRows = DestinationRow | DestinationRow[] | null;
type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  abortSignal: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

const mock = vi.hoisted(() => ({
  rows: new Map<string, DestinationRows>(),
  calls: [] as string[],
  from: vi.fn((table: string) => {
    mock.calls.push(`from:${table}`);
    const builder = {} as QueryBuilder;
    builder.select = vi.fn((columns: string) => {
      mock.calls.push(`select:${columns}`);
      return builder;
    });
    builder.order = vi.fn((column: string) => {
      mock.calls.push(`order:${column}`);
      return builder;
    });
    builder.limit = vi.fn((limit: number) => {
      mock.calls.push(`limit:${limit}`);
      return builder;
    });
    builder.abortSignal = vi.fn(() => {
      if (table !== "cotacoes") return builder;
      const stored = mock.rows.get(table);
      return Promise.resolve({
        data: Array.isArray(stored) ? stored : stored ? [stored] : [],
        error: null,
      });
    });
    builder.maybeSingle = vi.fn(async () => ({
      data: mock.rows.get(table) ?? null,
      error: null,
    }));
    return builder;
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mock.from },
}));

import { resolveTutorialDestination } from "@/components/tutorial/tutorial-destination";

const CASES = [
  {
    destination: "cotacao-comparativo",
    table: "cotacoes",
    row: {
      id: "cotacao-1",
      quiver_resultado_raw: { cards: [{ seguradora: "Porto Seguro" }] },
      cotacao_premios: [{ id: "premio-1" }],
    },
    resolved: { kind: "cotacao", id: "cotacao-1", target: "[data-tour=alvo]" },
    fallback: {
      kind: "static",
      route: "/venda/cotacoes",
      target: '[data-tour="cotacoes-lista"]',
    },
  },
  {
    destination: "proposta-selecionada",
    table: "propostas",
    row: { id: "proposta-1" },
    resolved: { kind: "proposta", id: "proposta-1", target: "[data-tour=alvo]" },
    fallback: {
      kind: "static",
      route: "/venda/propostas",
      target: '[data-tour="propostas-lista"]',
    },
  },
  {
    destination: "franquia-detalhe",
    table: "v_franquia_kpis",
    row: { empresa_id: "franquia-1" },
    resolved: { kind: "franquia", id: "franquia-1", target: "[data-tour=alvo]" },
    fallback: {
      kind: "static",
      route: "/operacao/franquias",
      target: '[data-tour="franquias-lista"]',
    },
  },
  {
    destination: "vendedor-detalhe",
    table: "v_vendedor_kpis",
    row: { user_id: "vendedor-1" },
    resolved: { kind: "vendedor", id: "vendedor-1", target: "[data-tour=alvo]" },
    fallback: {
      kind: "static",
      route: "/operacao/vendedores",
      target: '[data-tour="vendedores-lista"]',
    },
  },
] as const;

function step(destination: TutorialDestination): TutorialStep {
  return {
    destination,
    route: "/fallback-original",
    target: "[data-tour=alvo]",
    title: "Destino",
    body: "<p>Destino dinâmico</p>",
  };
}

describe("destinos dinâmicos somente leitura do tutorial", () => {
  const options = { userId: "user-1" };

  beforeEach(() => {
    mock.rows.clear();
    mock.calls.length = 0;
    mock.from.mockClear();
  });

  it.each(CASES)(
    "$destination abre o primeiro registro visível sem mutação",
    async ({ destination, table, row, resolved }) => {
      mock.rows.set(table, row);
      const queryClient = new QueryClient();

      await expect(
        resolveTutorialDestination(step(destination), queryClient, options),
      ).resolves.toEqual(resolved);
      expect(mock.calls).toContain(`from:${table}`);
      expect(mock.calls.some((call) => /insert|update|upsert|delete|rpc/i.test(call))).toBe(false);
    },
  );

  it.each(CASES)(
    "$destination usa fallback explícito quando não há registro",
    async ({ destination, fallback }) => {
      const queryClient = new QueryClient();

      await expect(
        resolveTutorialDestination(step(destination), queryClient, options),
      ).resolves.toEqual(fallback);
    },
  );

  it("mantém destino estático sem consultar o Supabase", async () => {
    const queryClient = new QueryClient();

    await expect(
      resolveTutorialDestination(
        { route: "/inicio", target: ".hero", title: "Início", body: "<p>Início</p>" },
        queryClient,
        options,
      ),
    ).resolves.toEqual({ kind: "static", route: "/inicio", target: ".hero" });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("exige prêmio visível para escolher a cotação e isola o cache por usuário", async () => {
    const renderizavel = (id: string) => ({
      id,
      quiver_resultado_raw: { cards: [{ seguradora: "Porto Seguro" }] },
      cotacao_premios: [{ id: `premio-${id}` }],
    });
    mock.rows.set("cotacoes", [
      { id: "vazia", quiver_resultado_raw: { cards: [] }, cotacao_premios: [{ id: "p-0" }] },
      renderizavel("cotacao-1"),
    ]);
    const queryClient = new QueryClient();
    const controller = new AbortController();

    await expect(
      resolveTutorialDestination(step("cotacao-comparativo"), queryClient, {
        ...options,
        signal: controller.signal,
      }),
    ).resolves.toMatchObject({ kind: "cotacao", id: "cotacao-1" });

    mock.rows.set("cotacoes", renderizavel("cotacao-2"));
    await expect(
      resolveTutorialDestination(step("cotacao-comparativo"), queryClient, {
        userId: "user-2",
      }),
    ).resolves.toMatchObject({ kind: "cotacao", id: "cotacao-2" });

    await expect(
      resolveTutorialDestination(step("cotacao-comparativo"), queryClient, options),
    ).resolves.toMatchObject({ kind: "cotacao", id: "cotacao-1" });

    const builder = mock.from.mock.results[0]?.value;
    expect(builder.select).toHaveBeenCalledWith(
      "id,quiver_resultado_raw,cotacao_premios!inner(id)",
    );
    expect(builder.limit).toHaveBeenCalledWith(20);
    expect(builder.abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(mock.from).toHaveBeenCalledTimes(2);
  });
});
