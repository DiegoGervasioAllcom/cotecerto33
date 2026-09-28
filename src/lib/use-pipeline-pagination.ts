/**
 * Estado de paginação por coluna do Kanban do Pipeline — Pipeline V12, T5.
 * Extraído para cá (regra 9 do AGENTS.md) em vez de crescer
 * `pipeline.tsx`/`pipeline-data.ts`: cada coluna (`LeadEtapaBucket`) tem sua
 * própria página de `pipeline_leads_etapa` (`@/lib/pipeline-query`), com
 * carga inicial de 5 leads e "carregar mais" de 4 em 4.
 *
 * Pipeline V12, T14: o gatilho de "carregar mais" deixou de ser scroll da
 * página inteira (`IntersectionObserver`/sentinela) ou um botão "Mostrar
 * mais" — cada coluna agora rola por dentro (`.kcol-fila`,
 * `useKcolFilaScroll`) e o rodapé "mais N" (`PipelineColuna`) chama
 * `carregarMais` diretamente. Esse hook ficou só com o estado/paginação em
 * si; a UI de scroll mora em `use-kcol-fila-scroll.ts`.
 *
 * Ajuste pós-deploy V12 (item 3): a paginação deixou de ser um motor próprio
 * (`criarMotorPaginacao`, com `useState`/`useEffect`/epoch manual pra
 * proteção contra corrida) e passou a usar `useInfiniteQuery` do react-query
 * — a fonte de estado de servidor do projeto (regra "Estado de servidor via
 * react-query"). O react-query já resolve:
 * - a "proteção contra corrida" (troca de `queryKey` invalida/descarta em
 *   voo automaticamente, sem precisar de um contador de epoch à mão);
 * - `retry` padrão do `QueryClient` do app (`src/router.tsx`);
 * - cache/dedupe entre navegações pra dentro/fora da tela.
 *
 * Cada `LeadEtapaBucket` possível (`TODAS_ETAPAS`) tem sua própria
 * `useInfiniteQuery`, sempre chamada (nunca dentro de laço/condicional —
 * regra dos hooks): a coluna só "existe" (aparece em `colunas`) quando o
 * chamador pediu aquela etapa (`etapas`) E há uma sessão (`uid`); do
 * contrário a query fica com `enabled: false` e a entrada correspondente
 * nem é incluída no mapa devolvido — mesmo formato de antes
 * (`Partial<Record<LeadEtapaBucket, EstadoColuna>>`), pra não exigir
 * mudança em `pipeline.tsx`/`PipelineColuna`.
 *
 * O núcleo puro (cálculo de `limit`/cursor da próxima página,
 * `cursorDoUltimo`) continua testável sem DOM em
 * `tests/unit/use-pipeline-pagination.test.ts`; o encadeamento das páginas
 * em si (react-query + rede) é coberto pelos E2E de
 * `tests/e2e/pipeline-paginacao.spec.ts`.
 */
import { useInfiniteQuery, type UseInfiniteQueryResult } from "@tanstack/react-query";
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

/** Todos os buckets que podem virar coluna do Kanban ou o filtro "Perdidos". */
export const TODAS_ETAPAS: readonly LeadEtapaBucket[] = [
  "novo",
  "cotacao",
  "negociacao",
  "finalizacao",
  "fechamento",
  "perdido",
];

export const LIMITE_INICIAL = 5;
export const LIMITE_CARREGAR_MAIS = 4;

/** Cursor keyset a partir do último lead de uma página — `undefined` se a página veio vazia ou sem `atualizado_em`. */
export function cursorDoUltimo(
  pagina: readonly PipelineLeadEtapaRow[],
): PipelineCursor | undefined {
  const ultimo = pagina[pagina.length - 1];
  if (!ultimo?.atualizado_em) return undefined;
  return { atualizadoEm: ultimo.atualizado_em, leadId: ultimo.lead_id };
}

/** Uma página já buscada, com o cursor pronto pra pedir a próxima (`undefined` = acabou). */
type PaginaColuna = {
  leads: PipelineLeadEtapaRow[];
  cursorProximo: PipelineCursor | undefined;
};

/** Limit de cada página: a primeira (pageParam null) busca `LIMITE_INICIAL`; as seguintes, `LIMITE_CARREGAR_MAIS`. */
function limitDaPagina(pageParam: PipelineCursor): number {
  return pageParam === null ? LIMITE_INICIAL : LIMITE_CARREGAR_MAIS;
}

function useColunaInfinita(
  etapa: LeadEtapaBucket,
  habilitada: boolean,
  filtrosComuns: PipelineFiltrosComuns,
  uid: string | null,
) {
  return useInfiniteQuery({
    queryKey: ["pipeline-pagina", uid, etapa, filtrosComuns],
    enabled: habilitada && !!uid,
    initialPageParam: null as PipelineCursor,
    queryFn: async ({ pageParam }): Promise<PaginaColuna> => {
      const limit = limitDaPagina(pageParam);
      const { leads, error } = await fetchPipelinePagina(
        { etapa, ...filtrosComuns },
        pageParam,
        limit,
      );
      if (error) throw new Error(error);
      const paginaCheia = leads.length >= limit;
      return { leads, cursorProximo: paginaCheia ? cursorDoUltimo(leads) : undefined };
    },
    getNextPageParam: (ultimaPagina) => ultimaPagina.cursorProximo ?? undefined,
  });
}

/** Achata as páginas já carregadas de uma coluna no formato `EstadoColuna` que `pipeline.tsx`/`PipelineColuna` esperam. */
function paraEstadoColuna(
  query: UseInfiniteQueryResult<{ pages: PaginaColuna[] }, Error>,
): EstadoColuna {
  const paginas = query.data?.pages ?? [];
  const leads = paginas.flatMap((p) => p.leads);
  const ultimaPagina = paginas[paginas.length - 1];
  return {
    leads,
    cursor: ultimaPagina?.cursorProximo ?? null,
    hasMore: query.hasNextPage,
    // `isFetchNextPageError` não existe — erro de "carregar mais" também vira `query.error`.
    loading: query.isPending || query.isFetchingNextPage,
    error: query.error?.message ?? null,
  };
}

/**
 * Hook do Kanban: uma `EstadoColuna` por etapa pedida em `etapas`. Chama
 * `useInfiniteQuery` uma vez para CADA etapa possível (`TODAS_ETAPAS`,
 * comprimento fixo — respeita a regra dos hooks) e só inclui no mapa
 * devolvido as que estão em `etapas` (mesmo comportamento de antes: uma
 * etapa fora do filtro Estágio/Status simplesmente não aparece).
 */
export function usePipelinePagination(
  etapas: readonly LeadEtapaBucket[],
  filtrosComuns: PipelineFiltrosComuns,
  uid: string | null,
): {
  colunas: Partial<Record<LeadEtapaBucket, EstadoColuna>>;
  carregarMais: (etapa: LeadEtapaBucket) => void;
} {
  const queries = {
    novo: useColunaInfinita("novo", etapas.includes("novo"), filtrosComuns, uid),
    cotacao: useColunaInfinita("cotacao", etapas.includes("cotacao"), filtrosComuns, uid),
    negociacao: useColunaInfinita("negociacao", etapas.includes("negociacao"), filtrosComuns, uid),
    finalizacao: useColunaInfinita(
      "finalizacao",
      etapas.includes("finalizacao"),
      filtrosComuns,
      uid,
    ),
    fechamento: useColunaInfinita("fechamento", etapas.includes("fechamento"), filtrosComuns, uid),
    perdido: useColunaInfinita("perdido", etapas.includes("perdido"), filtrosComuns, uid),
  } as const;

  const colunas: Partial<Record<LeadEtapaBucket, EstadoColuna>> = {};
  for (const etapa of TODAS_ETAPAS) {
    if (etapas.includes(etapa)) colunas[etapa] = paraEstadoColuna(queries[etapa]);
  }

  function carregarMais(etapa: LeadEtapaBucket) {
    const query = queries[etapa];
    if (query.isFetchingNextPage || !query.hasNextPage) return;
    void query.fetchNextPage();
  }

  return { colunas, carregarMais };
}
