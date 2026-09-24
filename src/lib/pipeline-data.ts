/**
 * Dados do Pipeline (Kanban/Tabela) usados fora da paginação por coluna.
 *
 * Pipeline V12, T6: este arquivo deixou de fazer as 4 queries antigas
 * (`leads` + `cotacoes` + `cotacao_transmissoes` + `propostas`) reduzidas em
 * memória com `leadEtapaBucket()`/`pickMaisRecentePorLead()` — isso virou a
 * view `pipeline_leads_etapa` (migration
 * `20260924162114_v12_pipeline_kanban_paginado.sql`), que já calcula a etapa
 * e traz os dados de produto/veículo/transmissão/proposta numa linha só. A
 * busca por coluna do Kanban (cursor, "carregar mais") é feita direto por
 * `fetchPipelinePagina`/`fetchPipelineResumoEtapas`/`fetchPipeline*Disponiveis`
 * em `@/lib/pipeline-query` (T4), orquestrada por `usePipelinePagination`
 * (`@/lib/use-pipeline-pagination`, T5) — não há mais um "buscar todos os
 * leads de uma vez" aqui.
 *
 * `PipelineLeadRow` é reexportado como alias direto de `PipelineLeadEtapaRow`
 * (nenhum mapeamento) — decisão de shape (T6): a view devolve os campos de
 * veículo/transmissão/proposta soltos (`marca_nome`, `modelo_nome`,
 * `ano_modelo`, `cotacao_status`, `step_atual`, `transmissao_fase`,
 * `transmissao_aberta_status`, `proposta_numero`,
 * `proposta_transmissao_status`) em vez dos objetos aninhados
 * `cotacao: {...}`/`propostaTransmitida: {...}` que existiam quando esses
 * dados vinham de queries separadas casadas em memória. Reconstruir aqui um
 * objeto aninhado só para imitar o shape antigo seria uma camada de mapeamento
 * sem necessidade — os consumidores (`pipeline-card.tsx`, `pipeline-format.ts`,
 * ajustados em T7/T8) passam a ler os campos soltos direto da linha da view.
 *
 * `fetchRetornosPendentesPorLead` não muda: é sobre `lead_agendamentos`, não
 * depende da view nova.
 */
import { supabase } from "@/integrations/supabase/client";

export type { PipelineLeadEtapaRow as PipelineLeadRow } from "@/lib/pipeline-query";

// ---------------------------------------------------------------------------
// Retorno agendado por lead (T9 — card do Kanban/Tabela)
// ---------------------------------------------------------------------------

export type PipelineRetornoPendente = { leadId: string; data: string; hora: string | null };

/**
 * Retorno agendado (`lead_agendamentos`, `done=false`) mais próximo por lead,
 * entre os leads em `leadIds`. Mesmo padrão de query/ordenação de
 * `fetchRetornosAgenda` (`@/lib/agenda`, Frente 9 · "Minha agenda"), mas sem o
 * filtro `criado_por` — aqui interessa qualquer retorno pendente do lead,
 * não só os agendados pelo usuário logado.
 */
export async function fetchRetornosPendentesPorLead(
  leadIds: string[],
): Promise<Map<string, PipelineRetornoPendente>> {
  if (leadIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("lead_agendamentos")
    .select("lead_id,data,hora")
    .in("lead_id", leadIds)
    .eq("done", false)
    .order("data", { ascending: true })
    .order("hora", { ascending: true, nullsFirst: false });
  if (error) throw error;

  const porLead = new Map<string, PipelineRetornoPendente>();
  for (const row of (data ?? []) as { lead_id: string; data: string; hora: string | null }[]) {
    if (porLead.has(row.lead_id)) continue;
    porLead.set(row.lead_id, { leadId: row.lead_id, data: row.data, hora: row.hora });
  }
  return porLead;
}
