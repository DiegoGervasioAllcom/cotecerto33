/**
 * Busca dos leads do Pipeline (Kanban) com a etapa calculada a partir do
 * progresso real de cada lead — Pipeline V12, T8.
 *
 * `leads.status_pipeline` continua existindo como campo gravado (drag-and-drop
 * legado, T9 decide o que fazer com ele), mas a coluna do Kanban passa a ser
 * `leadEtapaBucket()` (`@/lib/lead-etapa`), a mesma lógica que já governa
 * `em-cotacao.tsx`, `em-negociacao.tsx`, `em-finalizacao.tsx` e `emissao.tsx`
 * (cada uma olhando só para o seu próprio estágio).
 *
 * São 4 queries separadas — mesma limitação já documentada em
 * `em-finalizacao.tsx`: o PostgREST não tem como devolver, num único embed,
 * "só a linha mais recente por grupo" (aqui, por lead). Então buscamos tudo
 * relevante e reduzimos em memória com `pickMaisRecentePorLead` /
 * `primeiraOcorrenciaPorChave`:
 *   1. `leads` — a lista em si (campos hoje usados pelo card/filtros).
 *   2. `cotacoes` de todos os leads buscados, reduzida à mais recente por
 *      lead (por `atualizado_em`) — dá o `cotacaoStatus` e os dados de
 *      produto/veículo do card.
 *   3. `cotacao_transmissoes` em aberto (`TRANSMISSAO_EM_ABERTO_STATUSES`),
 *      filtrada só pelas cotações "mais recentes" resolvidas no passo 2 e
 *      reduzida a uma por `cotacao_id` — dá o `transmissaoEmAberto`.
 *   4. `propostas` transmitidas (`PROPOSTA_TRANSMITIDA_STATUS`) dos leads
 *      buscados — via `propostas.lead_id` (a trigger que gera a proposta a
 *      partir da cotação já copia `cotacoes.lead_id` para lá, então dá pra
 *      filtrar direto, sem passar por `cotacoes` de novo) — dá o
 *      `propostaTransmitida`.
 *
 * As queries 2 e 4 dependem só dos ids de leads (passo 1) e rodam em
 * paralelo; a query 3 depende dos ids de cotação resolvidos no passo 2, por
 * isso roda depois.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  leadEtapaBucket,
  pickMaisRecentePorLead,
  primeiraOcorrenciaPorChave,
  PROPOSTA_TRANSMITIDA_STATUS,
  TRANSMISSAO_EM_ABERTO_STATUSES,
  type LeadEtapaBucket,
  type TransmissaoEmAbertoStatus,
} from "@/lib/lead-etapa";

export type PipelineLead = {
  id: string;
  nome: string;
  contato: string | null;
  status_pipeline: string;
  valor: number | null;
  criado_em: string;
  origem: string | null;
  motivo_perda: string | null;
  bloqueado: boolean | null;
  em_avaliacao_matriz: boolean | null;
};

export type PipelineCotacao = {
  id: string;
  lead_id: string | null;
  status: string;
  ramo: string;
  atualizado_em: string;
  /** Passo atual do wizard (`novo-lead.tsx`) — `6` é o passo de Transmissão. */
  step_atual: number;
  transmissao_fase: string | null;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
  } | null;
};

/** Dados da proposta transmitida (`PROPOSTA_TRANSMITIDA_STATUS`) de um lead, para o card do bucket "fechamento" (T6). */
export type PipelinePropostaTransmitida = {
  numero: string | null;
  transmissao_status: string | null;
};

type TransmissaoRow = { id: string; cotacao_id: string; status: string; criado_em: string };
type PropostaTransmitidaRow = {
  lead_id: string | null;
  numero: string | null;
  transmissao_status: string | null;
};

export type PipelineLeadRow = PipelineLead & {
  /** Etapa calculada do funil automático (`leadEtapaBucket`) — não é `status_pipeline`. */
  etapa: LeadEtapaBucket;
  /** Cotação mais recente do lead (por `atualizado_em`), ou `null` se ainda não tem nenhuma. */
  cotacao: PipelineCotacao | null;
  /** Proposta transmitida do lead (`PROPOSTA_TRANSMITIDA_STATUS`), ou `null` se ainda não tem nenhuma. */
  propostaTransmitida: PipelinePropostaTransmitida | null;
  /**
   * Status (`cotacao_transmissoes.status`) da tentativa de transmissão em
   * aberto mais recente da cotação do lead (T6b) — `null` se não há nenhuma
   * tentativa em aberto (`TRANSMISSAO_EM_ABERTO_STATUSES`). Campo novo (em
   * vez de reaproveitar algum existente): antes só o booleano
   * `transmissaoEmAberto` chegava ao `leadEtapaBucket`, e o status real ficava
   * preso dentro de `fetchPipelineLeads` — expõe aqui pra `pontoExato`/
   * `proximaAcao` (`pipeline-format.ts`) diferenciarem "enviada" (aguardando
   * o robô) de "falha" (precisa reenviar) dentro do bucket "finalizacao".
   */
  transmissaoAbertaStatus: TransmissaoEmAbertoStatus | null;
};

export type PipelineLeadsResult = { leads: PipelineLeadRow[]; error: string | null };

/** Busca os leads do Pipeline (mesma seleção de campos de hoje). */
function fetchLeads() {
  return supabase
    .from("leads")
    .select(
      "id,nome,contato,status_pipeline,valor,criado_em,origem,motivo_perda,bloqueado,em_avaliacao_matriz",
    )
    .order("atualizado_em", { ascending: false })
    .limit(500);
}

/** Cotações dos leads em `leadIds`, com os dados usados pelo card (produto/veículo). */
function fetchCotacoes(leadIds: string[]) {
  return supabase
    .from("cotacoes")
    .select(
      "id,lead_id,status,ramo,atualizado_em,step_atual,transmissao_fase," +
        "segurado:cotacao_segurado(nome)," +
        "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)",
    )
    .in("lead_id", leadIds)
    .order("atualizado_em", { ascending: false });
}

/** Tentativas de transmissão em aberto (`TRANSMISSAO_EM_ABERTO_STATUSES`) das cotações em `cotacaoIds`. */
function fetchTransmissoesEmAberto(cotacaoIds: string[]) {
  return supabase
    .from("cotacao_transmissoes")
    .select("id,cotacao_id,status,criado_em")
    .in("cotacao_id", cotacaoIds)
    .in("status", TRANSMISSAO_EM_ABERTO_STATUSES)
    .order("criado_em", { ascending: false });
}

/**
 * Propostas já transmitidas (`PROPOSTA_TRANSMITIDA_STATUS`) dos leads em
 * `leadIds`. `numero`/`transmissao_status` são consumidos pela T6 (bucket
 * "fechamento" mais granular) — hoje só passam adiante em `PipelineLeadRow`.
 */
function fetchPropostasTransmitidas(leadIds: string[]) {
  return supabase
    .from("propostas")
    .select("lead_id,numero,transmissao_status")
    .in("lead_id", leadIds)
    .eq("transmissao_status", PROPOSTA_TRANSMITIDA_STATUS);
}

/**
 * Busca os leads do Pipeline com a etapa (`LeadEtapaBucket`) e a cotação mais
 * recente já resolvidas. Ver o comentário do módulo para o desenho das 4
 * queries.
 */
export async function fetchPipelineLeads(): Promise<PipelineLeadsResult> {
  const { data: leadsData, error: leadsError } = await fetchLeads();
  if (leadsError) return { leads: [], error: leadsError.message };

  const leads = (leadsData ?? []) as PipelineLead[];
  if (leads.length === 0) return { leads: [], error: null };

  const leadIds = leads.map((l) => l.id);

  const [
    { data: cotacoesData, error: cotacoesError },
    { data: propostasData, error: propostasError },
  ] = await Promise.all([fetchCotacoes(leadIds), fetchPropostasTransmitidas(leadIds)]);
  if (cotacoesError) return { leads: [], error: cotacoesError.message };
  if (propostasError) return { leads: [], error: propostasError.message };

  const cotacoes = (cotacoesData ?? []) as unknown as PipelineCotacao[];
  const cotacaoPorLead = pickMaisRecentePorLead(cotacoes);
  const cotacaoIds = [...cotacaoPorLead.values()].map((c) => c.id);

  // Guarda o status (não só a presença) da tentativa em aberto mais recente
  // por cotação — dedup por `criado_em desc` (query já ordenada assim), igual
  // ao Set antigo, mas propagando `status` pra `PipelineLeadRow` (T6b).
  let transmissaoAbertaPorCotacao = new Map<string, TransmissaoEmAbertoStatus>();
  if (cotacaoIds.length > 0) {
    const { data: transmissoesData, error: transmissoesError } =
      await fetchTransmissoesEmAberto(cotacaoIds);
    if (transmissoesError) return { leads: [], error: transmissoesError.message };
    const dedup = primeiraOcorrenciaPorChave(
      (transmissoesData ?? []) as TransmissaoRow[],
      (t) => t.cotacao_id,
    );
    transmissaoAbertaPorCotacao = new Map(
      dedup.map((t) => [t.cotacao_id, t.status as TransmissaoEmAbertoStatus]),
    );
  }

  const propostaTransmitidaPorLead = new Map<string, PipelinePropostaTransmitida>();
  for (const p of (propostasData ?? []) as PropostaTransmitidaRow[]) {
    if (p.lead_id === null) continue;
    propostaTransmitidaPorLead.set(p.lead_id, {
      numero: p.numero,
      transmissao_status: p.transmissao_status,
    });
  }

  const rows: PipelineLeadRow[] = leads.map((lead) => {
    const cotacao = cotacaoPorLead.get(lead.id) ?? null;
    const propostaTransmitida = propostaTransmitidaPorLead.get(lead.id) ?? null;
    const transmissaoAbertaStatus = cotacao
      ? (transmissaoAbertaPorCotacao.get(cotacao.id) ?? null)
      : null;
    const etapa = leadEtapaBucket({
      statusPipeline: lead.status_pipeline,
      cotacaoStatus: cotacao?.status ?? null,
      transmissaoEmAberto: transmissaoAbertaStatus !== null,
      propostaTransmitida: propostaTransmitida !== null,
      emEtapaTransmissao: cotacao !== null && cotacao.status !== null && cotacao.step_atual === 6,
    });
    return { ...lead, etapa, cotacao, propostaTransmitida, transmissaoAbertaStatus };
  });

  return { leads: rows, error: null };
}

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
