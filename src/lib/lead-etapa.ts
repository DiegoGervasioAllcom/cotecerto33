/**
 * Etapa "automática" de um lead no funil (Pipeline V12).
 *
 * Espelha `leadEtapa()` do protótipo V12 (`cotecerto_prototipo_v12.html`,
 * por volta da linha 2900): o estágio de um lead no Kanban não é um campo
 * editável — é derivado do progresso real (cotação em rascunho, proposta em
 * negociação, tentativa de transmissão em aberto, proposta transmitida...).
 *
 * Divergência intencional do protótipo: aqui `'perdido'` continua existindo
 * como bucket do funil. O protótipo remove leads perdidos do Kanban por
 * completo, assumindo uma tela de "Carteira de Recuperação" que não existe
 * no nosso produto ainda — decisão já aprovada: manter a visibilidade via
 * filtro, por ora.
 *
 * Este módulo também concentra a lógica de status que hoje está duplicada
 * em `em-cotacao.tsx`, `em-negociacao.tsx`, `em-finalizacao.tsx`,
 * `emissao.tsx` e `nav-badges.ts` (`countEmFinalizacaoPendente`) — as
 * próximas tasks da frente migram essas páginas para importar daqui.
 */
import type { Database } from "@/integrations/supabase/database.types";

type CotacaoStatus = Database["public"]["Enums"]["cotacao_status"];
type LeadStatusPipeline = Database["public"]["Enums"]["lead_status"];

/** Status de `cotacoes.status` que hoje `em-cotacao.tsx` trata como "em cotação". */
export const EM_COTACAO_STATUSES = ["rascunho"] as const satisfies readonly CotacaoStatus[];
export type EmCotacaoStatus = (typeof EM_COTACAO_STATUSES)[number];

/** Status de `cotacoes.status` que hoje `em-negociacao.tsx` trata como "em negociação". */
export const EM_NEGOCIACAO_STATUSES = [
  "calculada",
  "proposta",
] as const satisfies readonly CotacaoStatus[];
export type EmNegociacaoStatus = (typeof EM_NEGOCIACAO_STATUSES)[number];

/**
 * Status de `cotacao_transmissoes.status` que hoje `em-finalizacao.tsx` (e
 * `nav-badges.ts`) tratam como tentativa de transmissão "em aberto" (ainda
 * sem confirmação do portal da seguradora). A coluna não tem enum no banco
 * — é `string` livre, gravada pelo robô/webhook Quiver.
 */
export const TRANSMISSAO_EM_ABERTO_STATUSES = ["enviada", "falha"] as const;
export type TransmissaoEmAbertoStatus = (typeof TRANSMISSAO_EM_ABERTO_STATUSES)[number];

/**
 * Status de `propostas.transmissao_status` que hoje `emissao.tsx` trata
 * como proposta já transmitida com sucesso ao portal da seguradora. A
 * coluna não tem enum no banco — é `string | null` livre.
 */
export const PROPOSTA_TRANSMITIDA_STATUS = "transmitida" as const;

/**
 * Status de `leads.status_pipeline` que, sem nenhuma cotação associada
 * ainda, caem no bucket "Lead novo" do funil. Decisão já aprovada: não
 * existe bucket "Qualificando" separado no Pipeline V12.
 */
export const NOVO_SEM_COTACAO_STATUSES = [
  "novo",
  "contato",
  "qualificado",
] as const satisfies readonly LeadStatusPipeline[];
export type NovoSemCotacaoStatus = (typeof NOVO_SEM_COTACAO_STATUSES)[number];

/**
 * Mantém só a primeira ocorrência de cada chave em `rows`, preservando a
 * ordem original do array de entrada. Uso típico: uma lista já ordenada por
 * `criado_em desc` (mais recente primeiro) da qual só interessa a linha
 * mais recente por `cotacao_id` — quem quiser só contar, faz `.length` do
 * resultado (substitui o `Set` duplicado em `nav-badges.ts` e o dedupe
 * manual de `em-finalizacao.tsx`).
 */
export function primeiraOcorrenciaPorChave<T>(rows: readonly T[], chave: (row: T) => string): T[] {
  const vistos = new Set<string>();
  const resultado: T[] = [];
  for (const row of rows) {
    const k = chave(row);
    if (vistos.has(k)) continue;
    vistos.add(k);
    resultado.push(row);
  }
  return resultado;
}

/**
 * Dado um array de linhas que podem ter múltiplas por `lead_id` (ex.:
 * cotações), retorna um Map de `lead_id` → a linha com `atualizado_em`
 * mais recente. Usado pelo Pipeline (T8) para achar a cotação/proposta
 * "atual" de cada lead no Kanban.
 */
export function pickMaisRecentePorLead<T extends { lead_id: string | null; atualizado_em: string }>(
  rows: readonly T[],
): Map<string, T> {
  const porLead = new Map<string, T>();
  for (const row of rows) {
    if (row.lead_id === null) continue;
    const atual = porLead.get(row.lead_id);
    if (!atual || new Date(row.atualizado_em).getTime() > new Date(atual.atualizado_em).getTime()) {
      porLead.set(row.lead_id, row);
    }
  }
  return porLead;
}

/** Bucket do funil automático do Pipeline V12. */
export type LeadEtapaBucket =
  | "novo"
  | "cotacao"
  | "negociacao"
  | "finalizacao"
  | "fechamento"
  | "perdido";

/**
 * Insumos para `leadEtapaBucket`, já resolvidos pelo chamador a partir do
 * schema real (o chamador é responsável por escolher a cotação/proposta
 * "atual" do lead, ex. via `pickMaisRecentePorLead`):
 * - `statusPipeline`: `leads.status_pipeline`.
 * - `cotacaoStatus`: `cotacoes.status` da cotação mais recente do lead, ou
 *   `null` se o lead ainda não tem nenhuma cotação.
 * - `transmissaoEmAberto`: `true` se existe uma tentativa em
 *   `cotacao_transmissoes.status` dentro de `TRANSMISSAO_EM_ABERTO_STATUSES`
 *   para a cotação do lead (sem sucesso ainda).
 * - `propostaTransmitida`: `true` se existe uma `propostas.transmissao_status
 *   === PROPOSTA_TRANSMITIDA_STATUS` para o lead.
 */
export type LeadEtapaInput = {
  statusPipeline: LeadStatusPipeline | string;
  cotacaoStatus: CotacaoStatus | string | null;
  transmissaoEmAberto: boolean;
  propostaTransmitida: boolean;
};

/**
 * Deriva o bucket do funil a partir do progresso real do lead — espelha
 * `leadEtapa()` do protótipo V12. Ordem de decisão (da mais definitiva
 * para o fallback):
 *   perdido > fechamento (proposta transmitida) > finalização (transmissão
 *   em aberto) > negociação > cotação > novo.
 */
export function leadEtapaBucket(input: LeadEtapaInput): LeadEtapaBucket {
  if (input.statusPipeline === "perdido") return "perdido";
  if (input.propostaTransmitida) return "fechamento";
  if (input.transmissaoEmAberto) return "finalizacao";
  if (
    input.cotacaoStatus !== null &&
    (EM_NEGOCIACAO_STATUSES as readonly string[]).includes(input.cotacaoStatus)
  )
    return "negociacao";
  if (
    input.cotacaoStatus !== null &&
    (EM_COTACAO_STATUSES as readonly string[]).includes(input.cotacaoStatus)
  )
    return "cotacao";
  return "novo";
}
