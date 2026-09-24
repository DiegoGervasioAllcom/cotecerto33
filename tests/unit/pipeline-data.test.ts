import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Testa `fetchPipelineLeads` (Pipeline V12, T8): a busca dos leads do Kanban
 * com a etapa (`LeadEtapaBucket`) calculada a partir do progresso real —
 * nunca de `leads.status_pipeline` sozinho.
 *
 * O mock do Supabase aqui é "thenable" (como o query builder real do
 * supabase-js): qualquer chamada em cadeia (`select().in().order()` etc.)
 * pode ser `await`ada diretamente, resolvendo com o resultado configurado
 * para a tabela — porque as 4 queries deste módulo terminam em métodos
 * diferentes (`limit`, `order`, `eq`), diferente do padrão fixo em
 * `em-finalizacao-query.test.ts` (que sempre termina em `.limit()`).
 */

type Operation = [string, string, ...unknown[]];
type QueryResult = { data: unknown[]; error: Error | null };

const mock = vi.hoisted(() => ({
  operations: [] as Operation[],
  resultsByTable: {} as Record<string, QueryResult>,
}));

function emptyResult(): QueryResult {
  return { data: [], error: null };
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      mock.operations.push(["from", table]);
      const builder = {
        select: vi.fn((...args: unknown[]) => {
          mock.operations.push(["select", table, ...args]);
          return builder;
        }),
        in: vi.fn((...args: unknown[]) => {
          mock.operations.push(["in", table, ...args]);
          return builder;
        }),
        eq: vi.fn((...args: unknown[]) => {
          mock.operations.push(["eq", table, ...args]);
          return builder;
        }),
        order: vi.fn((...args: unknown[]) => {
          mock.operations.push(["order", table, ...args]);
          return builder;
        }),
        limit: vi.fn((...args: unknown[]) => {
          mock.operations.push(["limit", table, ...args]);
          return builder;
        }),
        then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => {
          const result = mock.resultsByTable[table] ?? emptyResult();
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    }),
  },
}));

import { fetchPipelineLeads, type PipelineLead } from "@/lib/pipeline-data";
import { PROPOSTA_TRANSMITIDA_STATUS, TRANSMISSAO_EM_ABERTO_STATUSES } from "@/lib/lead-etapa";

function lead(overrides: Partial<PipelineLead> & { id: string }): PipelineLead {
  return {
    nome: "Fulano",
    contato: "11999999999",
    status_pipeline: "contato",
    valor: 1000,
    criado_em: "2026-01-01T00:00:00.000Z",
    origem: "site",
    motivo_perda: null,
    bloqueado: false,
    em_avaliacao_matriz: false,
    ...overrides,
  };
}

describe("fetchPipelineLeads", () => {
  beforeEach(() => {
    mock.operations.length = 0;
    mock.resultsByTable = {};
  });

  it("lead sem nenhuma cotação cai no bucket 'novo'", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-novo" })], error: null };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: "lead-novo",
      etapa: "novo",
      cotacao: null,
      transmissaoAbertaStatus: null,
    });
  });

  it("lead com cotação em rascunho cai no bucket 'cotacao'", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-cotacao" })], error: null };
    mock.resultsByTable.cotacoes = {
      data: [
        {
          id: "cot-1",
          lead_id: "lead-cotacao",
          status: "rascunho",
          ramo: "auto",
          atualizado_em: "2026-01-02T00:00:00.000Z",
          segurado: { nome: "Fulano" },
          veiculo: null,
        },
      ],
      error: null,
    };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads[0].etapa).toBe("cotacao");
    expect(leads[0].cotacao?.id).toBe("cot-1");
  });

  it("lead com tentativa de transmissão em aberto cai no bucket 'finalizacao' e expõe transmissaoAbertaStatus='enviada'", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-final" })], error: null };
    mock.resultsByTable.cotacoes = {
      data: [
        {
          id: "cot-2",
          lead_id: "lead-final",
          status: "calculada",
          ramo: "auto",
          atualizado_em: "2026-01-02T00:00:00.000Z",
          step_atual: 5,
          transmissao_fase: null,
          segurado: { nome: "Fulano" },
          veiculo: null,
        },
      ],
      error: null,
    };
    mock.resultsByTable.cotacao_transmissoes = {
      data: [
        {
          id: "tent-1",
          cotacao_id: "cot-2",
          status: "enviada",
          criado_em: "2026-01-03T00:00:00.000Z",
        },
      ],
      error: null,
    };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads[0].etapa).toBe("finalizacao");
    expect(leads[0].transmissaoAbertaStatus).toBe("enviada");
  });

  it("lead com tentativa de transmissão com falha cai no bucket 'finalizacao' e expõe transmissaoAbertaStatus='falha'", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-falha" })], error: null };
    mock.resultsByTable.cotacoes = {
      data: [
        {
          id: "cot-falha",
          lead_id: "lead-falha",
          status: "calculada",
          ramo: "auto",
          atualizado_em: "2026-01-02T00:00:00.000Z",
          step_atual: 5,
          transmissao_fase: null,
          segurado: { nome: "Fulano" },
          veiculo: null,
        },
      ],
      error: null,
    };
    mock.resultsByTable.cotacao_transmissoes = {
      data: [
        {
          id: "tent-2",
          cotacao_id: "cot-falha",
          status: "falha",
          criado_em: "2026-01-03T00:00:00.000Z",
        },
      ],
      error: null,
    };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads[0].etapa).toBe("finalizacao");
    expect(leads[0].transmissaoAbertaStatus).toBe("falha");
  });

  it("lead cuja cotação está no passo de Transmissão (step_atual=6) cai no bucket 'finalizacao', mesmo sem tentativa/proposta ainda", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-step6" })], error: null };
    mock.resultsByTable.cotacoes = {
      data: [
        {
          id: "cot-step6",
          lead_id: "lead-step6",
          status: "calculada",
          ramo: "auto",
          atualizado_em: "2026-01-02T00:00:00.000Z",
          step_atual: 6,
          transmissao_fase: null,
          segurado: { nome: "Fulano" },
          veiculo: null,
        },
      ],
      error: null,
    };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads[0].etapa).toBe("finalizacao");
    expect(leads[0].cotacao?.step_atual).toBe(6);
  });

  it("lead com proposta transmitida cai no bucket 'fechamento', mesmo com cotação em negociação, e expõe numero/transmissao_status", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-fecha" })], error: null };
    mock.resultsByTable.cotacoes = {
      data: [
        {
          id: "cot-3",
          lead_id: "lead-fecha",
          status: "proposta",
          ramo: "auto",
          atualizado_em: "2026-01-02T00:00:00.000Z",
          step_atual: 6,
          transmissao_fase: null,
          segurado: { nome: "Fulano" },
          veiculo: null,
        },
      ],
      error: null,
    };
    mock.resultsByTable.propostas = {
      data: [{ lead_id: "lead-fecha", numero: "PR-123", transmissao_status: "transmitida" }],
      error: null,
    };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads[0].etapa).toBe("fechamento");
    expect(leads[0].propostaTransmitida).toEqual({
      numero: "PR-123",
      transmissao_status: "transmitida",
    });
  });

  it("lead perdido cai no bucket 'perdido', mesmo com proposta transmitida (perdido vence tudo)", async () => {
    mock.resultsByTable.leads = {
      data: [lead({ id: "lead-perdido", status_pipeline: "perdido", motivo_perda: "preco" })],
      error: null,
    };
    mock.resultsByTable.propostas = {
      data: [{ lead_id: "lead-perdido", numero: "PR-999", transmissao_status: "transmitida" }],
      error: null,
    };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads[0].etapa).toBe("perdido");
  });

  it("lista vazia de leads não dispara as demais queries", async () => {
    mock.resultsByTable.leads = { data: [], error: null };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBeNull();
    expect(leads).toEqual([]);
    expect(mock.operations.some((op) => op[0] === "from" && op[1] === "cotacoes")).toBe(false);
    expect(mock.operations.some((op) => op[0] === "from" && op[1] === "propostas")).toBe(false);
  });

  it("sem nenhuma cotação entre os leads buscados, não dispara a query de transmissões", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-sem-cotacao" })], error: null };
    mock.resultsByTable.cotacoes = { data: [], error: null };

    await fetchPipelineLeads();

    expect(mock.operations.some((op) => op[0] === "from" && op[1] === "cotacao_transmissoes")).toBe(
      false,
    );
  });

  it("propaga erro da query de leads sem chamar as demais", async () => {
    mock.resultsByTable.leads = { data: [], error: new Error("boom") };

    const { leads, error } = await fetchPipelineLeads();

    expect(error).toBe("boom");
    expect(leads).toEqual([]);
    expect(mock.operations.some((op) => op[0] === "from" && op[1] === "cotacoes")).toBe(false);
  });

  it("filtra cotacao_transmissoes por TRANSMISSAO_EM_ABERTO_STATUSES e propostas por PROPOSTA_TRANSMITIDA_STATUS", async () => {
    mock.resultsByTable.leads = { data: [lead({ id: "lead-x" })], error: null };
    mock.resultsByTable.cotacoes = {
      data: [
        {
          id: "cot-x",
          lead_id: "lead-x",
          status: "calculada",
          ramo: "auto",
          atualizado_em: "2026-01-02T00:00:00.000Z",
          segurado: null,
          veiculo: null,
        },
      ],
      error: null,
    };

    await fetchPipelineLeads();

    const inTransmissoesStatus = mock.operations.find(
      (op) => op[0] === "in" && op[1] === "cotacao_transmissoes" && op[2] === "status",
    );
    expect(inTransmissoesStatus?.[3]).toEqual([...TRANSMISSAO_EM_ABERTO_STATUSES]);

    const eqPropostasStatus = mock.operations.find(
      (op) => op[0] === "eq" && op[1] === "propostas" && op[2] === "transmissao_status",
    );
    expect(eqPropostasStatus?.[3]).toBe(PROPOSTA_TRANSMITIDA_STATUS);
  });
});
