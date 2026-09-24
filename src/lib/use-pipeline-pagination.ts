/**
 * Estado de paginação por coluna do Kanban do Pipeline — Pipeline V12, T5.
 * Extraído para cá (regra 9 do AGENTS.md) em vez de crescer
 * `pipeline.tsx`/`pipeline-data.ts`: cada coluna (`LeadEtapaBucket`) tem sua
 * própria página de `pipeline_leads_etapa` (`@/lib/pipeline-query`), com
 * carga inicial de 5 leads e "carregar mais" de 4 em 4 via scroll
 * (`IntersectionObserver`).
 *
 * `criarMotorPaginacao` é o núcleo sem React — só estado + funções puras/
 * assíncronas, testável direto em `tests/unit/use-pipeline-pagination.test.ts`
 * sem precisar de DOM/`renderHook` (o projeto não tem `@testing-library/react`
 * nem ambiente jsdom no Vitest — `vitest.config.ts` roda `environment: "node"`
 * e só inclui `tests/unit/**\/*.test.ts`). `usePipelinePagination` é só o
 * wrapper fino que liga esse motor a `useState`/`useEffect` e ao
 * `IntersectionObserver` por coluna.
 *
 * Proteção contra corrida: mesmo padrão "epoch"/`isCurrent()` já usado em
 * `use-team-data.ts` (`@/components/operacao/acessos/full/use-team-data.ts`)
 * — cada `resetar()` (troca de `filtrosComuns`) incrementa um contador
 * módulo-local; toda resposta em voo confere esse contador antes de aplicar
 * o resultado e descarta se ele mudou (resposta de um filtro antigo não
 * sobrescreve o estado de um filtro mais novo).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadEtapaBucket } from "@/lib/lead-etapa";
import {
  fetchPipelinePagina,
  type PipelineCursor,
  type PipelineFiltros,
  type PipelineLeadEtapaRow,
} from "@/lib/pipeline-query";

/** `PipelineFiltros` sem `etapa` — cada coluna do Kanban fixa a sua própria. */
export type PipelineFiltrosComuns = Omit<PipelineFiltros, "etapa">;

export type EstadoColuna = {
  leads: PipelineLeadEtapaRow[];
  cursor: PipelineCursor;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

/** Assinatura de `fetchPipelinePagina` — injetável no motor para os testes. */
type FetchPagina = typeof fetchPipelinePagina;

const LIMITE_INICIAL = 5;
const LIMITE_CARREGAR_MAIS = 4;

function estadoInicial(): EstadoColuna {
  return { leads: [], cursor: null, hasMore: true, loading: true, error: null };
}

/** Cursor keyset a partir do último lead de uma página — `undefined` se a página veio vazia ou sem `atualizado_em`. */
function cursorDoUltimo(pagina: readonly PipelineLeadEtapaRow[]): PipelineCursor | undefined {
  const ultimo = pagina[pagina.length - 1];
  if (!ultimo?.atualizado_em) return undefined;
  return { atualizadoEm: ultimo.atualizado_em, leadId: ultimo.lead_id };
}

/**
 * Motor de paginação do Kanban, sem React. Ver comentário do módulo para o
 * desenho geral e a proteção contra corrida.
 */
export function criarMotorPaginacao(fetchPagina: FetchPagina = fetchPipelinePagina) {
  let colunas: Partial<Record<LeadEtapaBucket, EstadoColuna>> = {};
  let filtrosAtuais: PipelineFiltrosComuns = {};
  let epoch = 0;
  const listeners = new Set<() => void>();

  function emitir() {
    for (const listener of listeners) listener();
  }

  function inscrever(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function obterEstado(): Partial<Record<LeadEtapaBucket, EstadoColuna>> {
    return colunas;
  }

  async function buscar(
    etapa: LeadEtapaBucket,
    epocaDaChamada: number,
    cursor: PipelineCursor,
    limit: number,
  ) {
    const { leads, error } = await fetchPagina({ etapa, ...filtrosAtuais }, cursor, limit);
    // Filtro mudou (ou a coluna nem existe mais) enquanto a busca estava em
    // voo — descarta em vez de sobrescrever um estado mais novo.
    if (epocaDaChamada !== epoch) return;
    const anterior = colunas[etapa];
    if (!anterior) return;

    const acumulado = cursor === null ? leads : [...anterior.leads, ...leads];
    colunas = {
      ...colunas,
      [etapa]: {
        leads: acumulado,
        cursor: cursorDoUltimo(leads) ?? anterior.cursor,
        hasMore: leads.length >= limit,
        loading: false,
        error,
      },
    };
    emitir();
  }

  /** Reseta TODAS as colunas (`etapas`) e recarrega a primeira página de cada — chamado quando `filtrosComuns` muda. */
  function resetar(etapas: readonly LeadEtapaBucket[], filtrosComuns: PipelineFiltrosComuns) {
    epoch += 1;
    const epocaAtual = epoch;
    filtrosAtuais = filtrosComuns;
    const novasColunas: Partial<Record<LeadEtapaBucket, EstadoColuna>> = {};
    for (const etapa of etapas) novasColunas[etapa] = estadoInicial();
    colunas = novasColunas;
    emitir();
    for (const etapa of etapas) void buscar(etapa, epocaAtual, null, LIMITE_INICIAL);
  }

  /** Busca mais 4 leads da coluna `etapa`, a partir do cursor atual dela. No-op se já está carregando ou não há mais páginas. */
  function carregarMais(etapa: LeadEtapaBucket) {
    const atual = colunas[etapa];
    if (!atual || atual.loading || !atual.hasMore) return;
    colunas = { ...colunas, [etapa]: { ...atual, loading: true } };
    emitir();
    void buscar(etapa, epoch, atual.cursor, LIMITE_CARREGAR_MAIS);
  }

  return { inscrever, obterEstado, resetar, carregarMais };
}

export type PipelinePaginationEngine = ReturnType<typeof criarMotorPaginacao>;

/**
 * Hook do Kanban: uma `EstadoColuna` por etapa, com scroll infinito
 * (`sentinelaRef`) por coluna. `filtrosComuns` deve ser um objeto estável
 * entre renders com o mesmo conteúdo (é serializado via `JSON.stringify`
 * para a dependência do `useEffect` de reset — evita depender de identidade
 * de referência, que mudaria a cada render em `pipeline.tsx`).
 */
export function usePipelinePagination(
  etapas: readonly LeadEtapaBucket[],
  filtrosComuns: PipelineFiltrosComuns,
): {
  colunas: Partial<Record<LeadEtapaBucket, EstadoColuna>>;
  carregarMais: (etapa: LeadEtapaBucket) => void;
  sentinelaRef: (etapa: LeadEtapaBucket) => (node: HTMLElement | null) => void;
} {
  const motorRef = useRef<PipelinePaginationEngine | null>(null);
  if (!motorRef.current) motorRef.current = criarMotorPaginacao();
  const motor = motorRef.current;

  const [colunas, setColunas] = useState(() => motor.obterEstado());
  useEffect(() => motor.inscrever(() => setColunas(motor.obterEstado())), [motor]);

  const etapasKey = etapas.join(",");
  const filtrosKey = JSON.stringify(filtrosComuns);
  useEffect(() => {
    motor.resetar(etapas, filtrosComuns);
    // etapasKey/filtrosKey já capturam tudo que `etapas`/`filtrosComuns` têm
    // de relevante — evita reset a cada render por identidade de referência.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, etapasKey, filtrosKey]);

  const carregarMais = useCallback((etapa: LeadEtapaBucket) => motor.carregarMais(etapa), [motor]);

  const observadoresRef = useRef<Partial<Record<LeadEtapaBucket, IntersectionObserver>>>({});
  useEffect(
    () => () => {
      for (const observer of Object.values(observadoresRef.current)) observer?.disconnect();
      observadoresRef.current = {};
    },
    [],
  );

  const sentinelaRef = useCallback(
    (etapa: LeadEtapaBucket) => (node: HTMLElement | null) => {
      observadoresRef.current[etapa]?.disconnect();
      delete observadoresRef.current[etapa];
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          // `carregarMais` já é no-op enquanto `loading`/`!hasMore` — não
          // precisa de guarda extra aqui, mesmo se o sentinela disparar de
          // novo antes da página anterior terminar de chegar.
          if (entries.some((entry) => entry.isIntersecting)) carregarMais(etapa);
        },
        { rootMargin: "200px" },
      );
      observer.observe(node);
      observadoresRef.current[etapa] = observer;
    },
    [carregarMais],
  );

  return { colunas, carregarMais, sentinelaRef };
}
