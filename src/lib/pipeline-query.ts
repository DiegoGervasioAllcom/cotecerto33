/**
 * Query central da paginação server-side do Pipeline (Kanban) — Pipeline
 * V12, T4. Cada coluna do Kanban é uma etapa (`LeadEtapaBucket`) e busca sua
 * própria página chamando `fetchPipelinePagina({ etapa, ... }, cursor,
 * limit)`; não existe mais um único fetch que traz tudo e bucketiza em
 * memória (isso era `fetchPipelineLeads` de `@/lib/pipeline-data`, T6
 * reescreve esse arquivo para consumir esta query nova).
 *
 * A view `pipeline_leads_etapa` (migration
 * `20260924162114_v12_pipeline_kanban_paginado.sql`) já calcula `etapa` no
 * banco — a mesma regra de `leadEtapaBucket()` — então dá pra paginar de
 * verdade com cursor (`atualizado_em desc, lead_id desc`), sem OFFSET.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";
import type { LeadEtapaBucket } from "@/lib/lead-etapa";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Etapas na ordem do funil — usada para ordenar o resumo por coluna. */
const LEAD_ETAPAS: readonly LeadEtapaBucket[] = [
  "novo",
  "cotacao",
  "negociacao",
  "finalizacao",
  "fechamento",
  "perdido",
];

type PipelineLeadEtapaViewRow = Database["public"]["Views"]["pipeline_leads_etapa"]["Row"];

/**
 * Linha de `pipeline_leads_etapa` com `lead_id`/`etapa` estreitados: os dois
 * sempre vêm preenchidos (vêm de `leads.id`, não-nulo, e do `case` da view,
 * que sempre cai em algum ramo) — a view só os declara nullable porque
 * `information_schema` não sabe disso.
 */
export type PipelineLeadEtapaRow = Omit<PipelineLeadEtapaViewRow, "lead_id" | "etapa"> & {
  lead_id: string;
  etapa: LeadEtapaBucket;
};

/** Cursor keyset (mesmo par usado no `.order()`/`.or()` abaixo): página seguinte = depois desta linha. */
export type PipelineCursor = { atualizadoEm: string; leadId: string } | null;

export type PipelineFiltros = {
  /** Dimensão obrigatória — cada coluna do Kanban é uma chamada com uma etapa. */
  etapa: LeadEtapaBucket;
  ramo?: string;
  origem?: string;
  /** "Parado há N dias": `atualizado_em <= agora - N dias`. */
  paradoHaDias?: number;
  motivoPerda?: string;
  /**
   * Espelha o filtro Status (ativos/perdidos/todos) de `pipeline.tsx`
   * hoje. Como cada chamada já fixa UMA etapa, isto não adiciona nenhuma
   * cláusula própria à query — é só uma guarda contra uso incoerente (ex.
   * pedir a coluna "perdido" com Status = "ativos"). Quem decide QUAIS
   * etapas pedir com base nesse filtro é o chamador (T5).
   */
  statusFiltro?: "ativos" | "perdidos" | "todos";
};

/** `filtros` sem a dimensão `etapa` — usado pelo resumo, que devolve todas as etapas de uma vez. */
export type PipelineFiltrosResumo = Omit<PipelineFiltros, "etapa" | "statusFiltro">;

function temFiltroGranular(filtros: PipelineFiltrosResumo): boolean {
  return (
    !!filtros.ramo || !!filtros.origem || !!filtros.motivoPerda || filtros.paradoHaDias != null
  );
}

function cutoffParado(paradoHaDias: number): string {
  return new Date(Date.now() - paradoHaDias * DIA_MS).toISOString();
}

/**
 * Busca uma página de `pipeline_leads_etapa` para UMA coluna do Kanban
 * (`filtros.etapa`), a partir de `cursor` (`null` = primeira página).
 *
 * Cursor keyset por `(atualizado_em desc, lead_id desc)`: a página seguinte
 * é "tudo que vem depois desta linha nessa ordenação", expresso como um
 * `.or()` — mesmo padrão de combinador OR/AND já usado no projeto em
 * `aprovacoes.tsx` (`query.or('col.is.null,col.eq.valor')`), aqui com um
 * `and()` aninhado (sintaxe padrão do PostgREST para combinar operadores:
 * `or=(a,and(b,c))`):
 *   `atualizado_em.lt.<cursor>,and(atualizado_em.eq.<cursor>,lead_id.lt.<cursor>)`
 * — ou seja: "atualizado_em estritamente menor" OU ("igual" E "lead_id
 * estritamente menor"), que é exatamente "vem depois" na ordenação desc.
 */
export async function fetchPipelinePagina(
  filtros: PipelineFiltros,
  cursor: PipelineCursor,
  limit: number,
): Promise<{ leads: PipelineLeadEtapaRow[]; error: string | null }> {
  if (filtros.statusFiltro === "ativos" && filtros.etapa === "perdido") {
    return { leads: [], error: null };
  }
  if (filtros.statusFiltro === "perdidos" && filtros.etapa !== "perdido") {
    return { leads: [], error: null };
  }

  let query = supabase.from("pipeline_leads_etapa").select("*").eq("etapa", filtros.etapa);

  if (filtros.ramo) query = query.eq("ramo", filtros.ramo);
  if (filtros.origem) query = query.eq("origem", filtros.origem);
  if (filtros.motivoPerda) query = query.eq("motivo_perda", filtros.motivoPerda);
  if (filtros.paradoHaDias != null) {
    query = query.lte("atualizado_em", cutoffParado(filtros.paradoHaDias));
  }

  if (cursor) {
    query = query.or(
      `atualizado_em.lt.${cursor.atualizadoEm},and(atualizado_em.eq.${cursor.atualizadoEm},lead_id.lt.${cursor.leadId})`,
    );
  }

  const { data, error } = await query
    .order("atualizado_em", { ascending: false })
    .order("lead_id", { ascending: false })
    .limit(limit);

  if (error) return { leads: [], error: error.message };
  return { leads: (data ?? []) as PipelineLeadEtapaRow[], error: null };
}

export type PipelineResumoEtapa = { etapa: LeadEtapaBucket; total: number; valorTotal: number };

/**
 * Resumo (total + valor somado) por etapa, para os headers/contadores de
 * cada coluna — precisa valer mesmo com poucas linhas carregadas na
 * página.
 *
 * `pipeline_resumo_etapas` (a view) só agrega `etapa → total/valor_total`
 * sobre TODAS as linhas: ela não expõe `ramo`/`origem`/`motivo_perda`, então
 * não tem como filtrá-la por esses campos (ver comentário da migration
 * `20260924162114`, que já antecipa isso: "sem view própria pra resumo por
 * ramo"). Por isso:
 *   - sem filtro granular (ramo/origem/motivo/parado) → usa a view direto,
 *     que já vem agregada pelo banco (caminho rápido, sem trazer leads).
 *   - com filtro granular → busca `etapa,valor` de `pipeline_leads_etapa`
 *     já filtrada e agrega em memória. Aceitável para o volume de hoje; se
 *     o número de leads crescer muito, isso deve virar um RPC agregando no
 *     banco em vez de trazer as linhas.
 */
export async function fetchPipelineResumoEtapas(
  filtros: PipelineFiltrosResumo = {},
): Promise<{ resumo: PipelineResumoEtapa[]; error: string | null }> {
  if (!temFiltroGranular(filtros)) {
    const { data, error } = await supabase.from("pipeline_resumo_etapas").select("*");
    if (error) return { resumo: [], error: error.message };
    const porEtapa = new Map(
      (data ?? [])
        .filter(
          (r): r is { etapa: string; total: number | null; valor_total: number | null } =>
            r.etapa != null,
        )
        .map((r) => [r.etapa, { total: r.total ?? 0, valorTotal: r.valor_total ?? 0 }] as const),
    );
    return {
      resumo: LEAD_ETAPAS.filter((etapa) => porEtapa.has(etapa)).map((etapa) => ({
        etapa,
        ...porEtapa.get(etapa)!,
      })),
      error: null,
    };
  }

  let query = supabase.from("pipeline_leads_etapa").select("etapa,valor");
  if (filtros.ramo) query = query.eq("ramo", filtros.ramo);
  if (filtros.origem) query = query.eq("origem", filtros.origem);
  if (filtros.motivoPerda) query = query.eq("motivo_perda", filtros.motivoPerda);
  if (filtros.paradoHaDias != null) {
    query = query.lte("atualizado_em", cutoffParado(filtros.paradoHaDias));
  }

  const { data, error } = await query;
  if (error) return { resumo: [], error: error.message };

  const porEtapa = new Map<string, { total: number; valorTotal: number }>();
  for (const row of data ?? []) {
    if (!row.etapa) continue;
    const acc = porEtapa.get(row.etapa) ?? { total: 0, valorTotal: 0 };
    acc.total += 1;
    acc.valorTotal += Number(row.valor ?? 0);
    porEtapa.set(row.etapa, acc);
  }
  return {
    resumo: LEAD_ETAPAS.filter((etapa) => porEtapa.has(etapa)).map((etapa) => ({
      etapa,
      ...porEtapa.get(etapa)!,
    })),
    error: null,
  };
}

export type PipelineOpcaoComContagem = { valor: string; total: number };

/**
 * Filtros que um fetcher de opções (`fetchPipeline*Disponiveis`) aceita dos
 * OUTROS campos já ativos — nunca o próprio (cada função abaixo usa
 * `Omit<PipelineFiltrosOpcoes, "campoProprio">"). `etapas` é a lista de
 * `LeadEtapaBucket` a considerar (mesma lista que `etapasParaBuscar` monta
 * em `pipeline.tsx` a partir de Estágio+Status): decisão desta rodada
 * (T10b) é que Estágio/Status TAMBÉM entram no recálculo, pela mesma razão
 * dos outros filtros — se o vendedor já restringiu a tela a uma etapa, os
 * selects de Tipo de seguro/Origem/Motivo devem refletir só o que existe
 * ali, não o pipeline inteiro.
 */
export type PipelineFiltrosOpcoes = {
  ramo?: string;
  origem?: string;
  motivoPerda?: string;
  paradoHaDias?: number;
  etapas?: readonly LeadEtapaBucket[];
};

/** Conta ocorrências não-nulas e ordena alfabeticamente — usado pelos 3 fetchers de opções abaixo. */
function contarValores(valores: readonly (string | null)[]): PipelineOpcaoComContagem[] {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([valor, total]) => ({ valor, total }))
    .sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR"));
}

/**
 * Opções distintas (+ contagem) de `ramo`/`origem`/`motivo_perda` para
 * popular os filtros do Kanban. Sem `distinct` nativo no supabase-js: busca
 * a coluna (sem paginar — volume pequeno, é só pra popular um `<select>`) e
 * dedupe/conta em JS.
 *
 * Cada fetcher recebe os OUTROS filtros já ativos (nunca o próprio campo —
 * ver `PipelineFiltrosOpcoes`), pra responder "quantos leads bateriam SE eu
 * escolhesse esta opção, dado o resto dos filtros já ativos", em vez de uma
 * contagem global fixa.
 */
export async function fetchPipelineRamosDisponiveis(
  filtros: Omit<PipelineFiltrosOpcoes, "ramo"> = {},
): Promise<{
  opcoes: PipelineOpcaoComContagem[];
  error: string | null;
}> {
  let query = supabase.from("pipeline_leads_etapa").select("ramo").not("ramo", "is", null);
  if (filtros.origem) query = query.eq("origem", filtros.origem);
  if (filtros.motivoPerda) query = query.eq("motivo_perda", filtros.motivoPerda);
  if (filtros.paradoHaDias != null) {
    query = query.lte("atualizado_em", cutoffParado(filtros.paradoHaDias));
  }
  if (filtros.etapas && filtros.etapas.length > 0) query = query.in("etapa", filtros.etapas);
  const { data, error } = await query;
  if (error) return { opcoes: [], error: error.message };
  return { opcoes: contarValores((data ?? []).map((r) => r.ramo)), error: null };
}

export async function fetchPipelineOrigensDisponiveis(
  filtros: Omit<PipelineFiltrosOpcoes, "origem"> = {},
): Promise<{
  opcoes: PipelineOpcaoComContagem[];
  error: string | null;
}> {
  let query = supabase.from("pipeline_leads_etapa").select("origem").not("origem", "is", null);
  if (filtros.ramo) query = query.eq("ramo", filtros.ramo);
  if (filtros.motivoPerda) query = query.eq("motivo_perda", filtros.motivoPerda);
  if (filtros.paradoHaDias != null) {
    query = query.lte("atualizado_em", cutoffParado(filtros.paradoHaDias));
  }
  if (filtros.etapas && filtros.etapas.length > 0) query = query.in("etapa", filtros.etapas);
  const { data, error } = await query;
  if (error) return { opcoes: [], error: error.message };
  return { opcoes: contarValores((data ?? []).map((r) => r.origem)), error: null };
}

export async function fetchPipelineMotivosDisponiveis(
  filtros: Omit<PipelineFiltrosOpcoes, "motivoPerda"> = {},
): Promise<{
  opcoes: PipelineOpcaoComContagem[];
  error: string | null;
}> {
  let query = supabase
    .from("pipeline_leads_etapa")
    .select("motivo_perda")
    .not("motivo_perda", "is", null);
  if (filtros.ramo) query = query.eq("ramo", filtros.ramo);
  if (filtros.origem) query = query.eq("origem", filtros.origem);
  if (filtros.paradoHaDias != null) {
    query = query.lte("atualizado_em", cutoffParado(filtros.paradoHaDias));
  }
  if (filtros.etapas && filtros.etapas.length > 0) query = query.in("etapa", filtros.etapas);
  const { data, error } = await query;
  if (error) return { opcoes: [], error: error.message };
  return { opcoes: contarValores((data ?? []).map((r) => r.motivo_perda)), error: null };
}
