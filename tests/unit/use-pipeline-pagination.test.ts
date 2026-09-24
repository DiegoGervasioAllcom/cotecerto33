/**
 * `criarMotorPaginacao` (`@/lib/use-pipeline-pagination`) — Pipeline V12, T5.
 *
 * O projeto não tem `@testing-library/react` nem `@testing-library/react-hooks`
 * instalados, e `vitest.config.ts` roda os testes de `tests/unit/**` com
 * `environment: "node"` (sem DOM/jsdom) — não dá pra `renderHook`/montar o
 * hook `usePipelinePagination` de verdade. Por isso estes testes exercitam
 * diretamente `criarMotorPaginacao`, o núcleo sem React de onde o hook só
 * deriva `useState`/`useEffect` (e o `IntersectionObserver`, que depende de
 * DOM e fica fora do escopo testável aqui) — é exatamente a mesma lógica de
 * carga inicial, "carregar mais" e proteção contra corrida que o hook expõe.
 */
import { describe, expect, it, vi } from "vitest";
import { criarMotorPaginacao } from "@/lib/use-pipeline-pagination";
import type { PipelineCursor, PipelineFiltros, PipelineLeadEtapaRow } from "@/lib/pipeline-query";

function criarLead(
  overrides: Partial<PipelineLeadEtapaRow> & { lead_id: string; atualizado_em: string },
): PipelineLeadEtapaRow {
  return {
    ano_modelo: null,
    bloqueado: null,
    contato: null,
    cotacao_id: null,
    cotacao_status: null,
    criado_em: null,
    em_avaliacao_matriz: null,
    empresa_id: null,
    etapa: "novo",
    marca_nome: null,
    modelo_nome: null,
    motivo_perda: null,
    nome: null,
    origem: null,
    proposta_numero: null,
    proposta_transmissao_status: null,
    ramo: null,
    responsavel_id: null,
    status_pipeline: null,
    step_atual: null,
    transmissao_aberta_status: null,
    transmissao_fase: null,
    valor: null,
    ...overrides,
  };
}

/** N leads distintos, mais recente primeiro (mesma ordenação de `fetchPipelinePagina`), com `atualizado_em` decrescente. */
function criarPagina(
  prefixo: string,
  quantidade: number,
  baseMs = Date.parse("2026-09-24T12:00:00Z"),
): PipelineLeadEtapaRow[] {
  return Array.from({ length: quantidade }, (_, i) =>
    criarLead({
      lead_id: `${prefixo}-${i}`,
      atualizado_em: new Date(baseMs - i * 1000).toISOString(),
    }),
  );
}

type Resolver = (result: { leads: PipelineLeadEtapaRow[]; error: string | null }) => void;
type Chamada = {
  filtros: PipelineFiltros;
  cursor: PipelineCursor;
  limit: number;
  resolver: Resolver;
};

/** Mock de `fetchPipelinePagina` com resolução manual — permite controlar a ordem em que as respostas chegam. */
function criarFetchControlavel() {
  const chamadas: Chamada[] = [];
  const fetchPagina = vi.fn((filtros: PipelineFiltros, cursor: PipelineCursor, limit: number) => {
    return new Promise<{ leads: PipelineLeadEtapaRow[]; error: string | null }>((resolve) => {
      chamadas.push({ filtros, cursor, limit, resolver: resolve });
    });
  });
  return { fetchPagina, chamadas };
}

/** Deixa os microtasks de dentro de `buscar()` (o `.then` depois do `await fetchPagina(...)`) rodarem. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("criarMotorPaginacao", () => {
  it("carga inicial busca 5 leads por coluna", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo", "cotacao"], {});

    expect(chamadas).toHaveLength(2);
    expect(chamadas[0].limit).toBe(5);
    expect(chamadas[0].cursor).toBeNull();
    expect(chamadas[1].limit).toBe(5);

    // Estado imediato do reset: já limpo e em loading, antes de qualquer resposta chegar.
    expect(motor.obterEstado().novo).toMatchObject({ leads: [], loading: true, hasMore: true });

    chamadas[0].resolver({ leads: criarPagina("novo", 5), error: null });
    chamadas[1].resolver({ leads: criarPagina("cotacao", 5), error: null });
    await flush();

    const estado = motor.obterEstado();
    expect(estado.novo?.leads).toHaveLength(5);
    expect(estado.novo?.loading).toBe(false);
    expect(estado.novo?.hasMore).toBe(true);
    expect(estado.novo?.cursor).toEqual({
      atualizadoEm: estado.novo?.leads[4].atualizado_em,
      leadId: "novo-4",
    });
    expect(estado.cotacao?.leads).toHaveLength(5);
  });

  it("hasMore fica false quando a página vem incompleta", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo"], {});
    chamadas[0].resolver({ leads: criarPagina("novo", 3), error: null });
    await flush();

    expect(motor.obterEstado().novo).toMatchObject({ hasMore: false, loading: false });
    expect(motor.obterEstado().novo?.leads).toHaveLength(3);
  });

  it("carregarMais busca +4 e concatena ao final, mantendo hasMore quando a página vem cheia", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo"], {});
    chamadas[0].resolver({ leads: criarPagina("novo", 5), error: null });
    await flush();
    const cursorAposInicial = motor.obterEstado().novo?.cursor;

    motor.carregarMais("novo");
    expect(chamadas).toHaveLength(2);
    expect(chamadas[1].limit).toBe(4);
    expect(chamadas[1].cursor).toEqual(cursorAposInicial);
    // Enquanto a segunda página está em voo, a coluna já reflete loading.
    expect(motor.obterEstado().novo?.loading).toBe(true);

    chamadas[1].resolver({ leads: criarPagina("mais", 4), error: null });
    await flush();

    const estado = motor.obterEstado().novo;
    expect(estado?.leads).toHaveLength(9);
    expect(estado?.leads.slice(0, 5).map((l) => l.lead_id)).toEqual([
      "novo-0",
      "novo-1",
      "novo-2",
      "novo-3",
      "novo-4",
    ]);
    expect(estado?.leads.slice(5).map((l) => l.lead_id)).toEqual([
      "mais-0",
      "mais-1",
      "mais-2",
      "mais-3",
    ]);
    expect(estado?.hasMore).toBe(true);
    expect(estado?.loading).toBe(false);
  });

  it("carregarMais com página incompleta zera hasMore", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo"], {});
    chamadas[0].resolver({ leads: criarPagina("novo", 5), error: null });
    await flush();

    motor.carregarMais("novo");
    chamadas[1].resolver({ leads: criarPagina("mais", 2), error: null });
    await flush();

    const estado = motor.obterEstado().novo;
    expect(estado?.leads).toHaveLength(7);
    expect(estado?.hasMore).toBe(false);
  });

  it("carregarMais é no-op enquanto já está carregando (guarda contra disparo duplicado)", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo"], {});
    chamadas[0].resolver({ leads: criarPagina("novo", 5), error: null });
    await flush();

    // Duas chamadas de "entrou na viewport" em sequência, antes da resposta da primeira chegar.
    motor.carregarMais("novo");
    motor.carregarMais("novo");
    motor.carregarMais("novo");

    expect(chamadas).toHaveLength(2); // 1 da carga inicial + só 1 do "carregar mais"
  });

  it("carregarMais é no-op quando não há mais páginas (hasMore=false)", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo"], {});
    chamadas[0].resolver({ leads: criarPagina("novo", 2), error: null }); // < 5 → hasMore false
    await flush();

    motor.carregarMais("novo");
    expect(chamadas).toHaveLength(1);
  });

  it("resetar troca os filtros e recarrega TODAS as colunas do zero", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo", "cotacao"], {});
    chamadas[0].resolver({ leads: criarPagina("a", 5), error: null });
    chamadas[1].resolver({ leads: criarPagina("a", 5), error: null });
    await flush();
    expect(motor.obterEstado().novo?.leads).toHaveLength(5);

    motor.resetar(["novo", "cotacao"], { ramo: "auto" });

    // Reset imediato: leads zerados e loading, mesmo antes da nova resposta chegar.
    expect(motor.obterEstado().novo).toMatchObject({ leads: [], loading: true });
    expect(motor.obterEstado().cotacao).toMatchObject({ leads: [], loading: true });
    expect(chamadas).toHaveLength(4);
    expect(chamadas[2].filtros).toMatchObject({ etapa: "novo", ramo: "auto" });
    expect(chamadas[3].filtros).toMatchObject({ etapa: "cotacao", ramo: "auto" });
  });

  it("proteção contra corrida: resposta atrasada de um filtro antigo não sobrescreve o estado do filtro mais novo", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo"], {}); // chamada 0 — filtro A, fica pendurada
    motor.resetar(["novo"], { ramo: "auto" }); // chamada 1 — filtro B, muda o epoch

    expect(chamadas).toHaveLength(2);

    // Resolve a mais nova primeiro (ordem realista: a antiga pode demorar mais no servidor).
    chamadas[1].resolver({ leads: criarPagina("b", 5), error: null });
    await flush();
    expect(motor.obterEstado().novo?.leads.map((l) => l.lead_id)).toEqual([
      "b-0",
      "b-1",
      "b-2",
      "b-3",
      "b-4",
    ]);

    // Resposta tardia da chamada antiga (filtro A) chega depois — deve ser descartada.
    chamadas[0].resolver({ leads: criarPagina("a", 5), error: null });
    await flush();
    expect(motor.obterEstado().novo?.leads.map((l) => l.lead_id)).toEqual([
      "b-0",
      "b-1",
      "b-2",
      "b-3",
      "b-4",
    ]);
    expect(motor.obterEstado().novo?.loading).toBe(false);
  });

  it("proteção contra corrida também vale para carregarMais em voo quando o filtro muda", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo"], {});
    chamadas[0].resolver({ leads: criarPagina("novo", 5), error: null });
    await flush();

    motor.carregarMais("novo"); // chamada 1 — filtro antigo, fica pendurada
    motor.resetar(["novo"], { origem: "site" }); // chamada 2 — reset com filtro novo

    chamadas[2].resolver({ leads: criarPagina("novo2", 5), error: null });
    await flush();
    expect(motor.obterEstado().novo?.leads).toHaveLength(5);
    expect(motor.obterEstado().novo?.leads[0].lead_id).toBe("novo2-0");

    // A resposta tardia do "carregar mais" de antes do reset chega — não pode concatenar em cima do novo estado.
    chamadas[1].resolver({ leads: criarPagina("mais-antigo", 4), error: null });
    await flush();
    expect(motor.obterEstado().novo?.leads).toHaveLength(5);
    expect(motor.obterEstado().novo?.leads.map((l) => l.lead_id)).not.toContain("mais-antigo-0");
  });

  it("propaga o erro de fetchPipelinePagina na coluna, sem quebrar as outras", async () => {
    const { fetchPagina, chamadas } = criarFetchControlavel();
    const motor = criarMotorPaginacao(fetchPagina);

    motor.resetar(["novo", "cotacao"], {});
    chamadas[0].resolver({ leads: [], error: "falha ao buscar" });
    chamadas[1].resolver({ leads: criarPagina("cotacao", 5), error: null });
    await flush();

    expect(motor.obterEstado().novo).toMatchObject({
      leads: [],
      loading: false,
      error: "falha ao buscar",
    });
    expect(motor.obterEstado().cotacao?.error).toBeNull();
    expect(motor.obterEstado().cotacao?.leads).toHaveLength(5);
  });
});
