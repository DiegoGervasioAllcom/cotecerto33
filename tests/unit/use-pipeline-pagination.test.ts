/**
 * `cursorDoUltimo`/`LIMITE_INICIAL`/`LIMITE_CARREGAR_MAIS`
 * (`@/lib/use-pipeline-pagination`) — Pipeline V12, T5.
 *
 * Ajuste pós-deploy V12 (item 3): a paginação do Kanban deixou de ter um
 * motor próprio (`criarMotorPaginacao`, com `useState`/epoch manual) e passou
 * a usar `useInfiniteQuery` do react-query — o encadeamento de páginas em si
 * (cursor keyset, "carregar mais", proteção contra corrida) agora é
 * responsabilidade do react-query e é coberto pelos E2E de
 * `tests/e2e/pipeline-paginacao.spec.ts` (não dá pra montar
 * `usePipelinePagination` de verdade aqui: o projeto não tem
 * `@testing-library/react`/jsdom, e `vitest.config.ts` roda `tests/unit/**`
 * com `environment: "node"`).
 *
 * O que sobra testável sem DOM/react-query é o núcleo puro que
 * `usePipelinePagination` usa por baixo: `cursorDoUltimo` (cursor keyset a
 * partir do último lead de uma página) e as constantes de tamanho de página.
 */
import { describe, expect, it } from "vitest";
import {
  cursorDoUltimo,
  LIMITE_CARREGAR_MAIS,
  LIMITE_INICIAL,
  TODAS_ETAPAS,
} from "@/lib/use-pipeline-pagination";
import type { PipelineLeadEtapaRow } from "@/lib/pipeline-query";

function criarLead(
  overrides: Partial<PipelineLeadEtapaRow> & { lead_id: string; atualizado_em: string | null },
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
    loja: null,
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

describe("constantes de tamanho de página", () => {
  it("carga inicial é 5, carregar mais é 4", () => {
    expect(LIMITE_INICIAL).toBe(5);
    expect(LIMITE_CARREGAR_MAIS).toBe(4);
  });
});

describe("TODAS_ETAPAS", () => {
  it("cobre as 5 colunas ativas do Kanban + o bucket perdido", () => {
    expect(TODAS_ETAPAS).toEqual([
      "novo",
      "cotacao",
      "negociacao",
      "finalizacao",
      "fechamento",
      "perdido",
    ]);
  });
});

describe("cursorDoUltimo", () => {
  it("página vazia -> undefined (sem próxima página pra pedir)", () => {
    expect(cursorDoUltimo([])).toBeUndefined();
  });

  it("último lead sem atualizado_em -> undefined (guarda de tipo da view)", () => {
    const pagina = [criarLead({ lead_id: "a", atualizado_em: null })];
    expect(cursorDoUltimo(pagina)).toBeUndefined();
  });

  it("usa atualizado_em/lead_id do ÚLTIMO item da página (não do primeiro)", () => {
    const pagina = [
      criarLead({ lead_id: "a", atualizado_em: "2026-09-24T12:00:00.000Z" }),
      criarLead({ lead_id: "b", atualizado_em: "2026-09-24T11:00:00.000Z" }),
    ];
    expect(cursorDoUltimo(pagina)).toEqual({
      atualizadoEm: "2026-09-24T11:00:00.000Z",
      leadId: "b",
    });
  });
});
