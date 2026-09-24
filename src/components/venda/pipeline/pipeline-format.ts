// Helpers de apresentação do Pipeline (Kanban + Tabela) — Pipeline V12, T9.
// Funções puras extraídas de pipeline.tsx (regra 9 do AGENTS.md — não deixar
// o arquivo da rota crescer) e fáceis de testar isoladamente.
import { classificarUrgencia } from "@/lib/agenda";
import type { LeadEtapaBucket } from "@/lib/lead-etapa";
import type { PipelineLeadRow, PipelineRetornoPendente } from "@/lib/pipeline-data";
import type { PipelineResumoEtapa } from "@/lib/pipeline-query";
import { STEPS } from "@/components/venda/novo-lead/types";

export function money(v: number | null): string {
  return v
    ? Number(v).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      })
    : "—";
}

/**
 * `iso` é `string | null` porque `pipeline_leads_etapa` (view) declara toda
 * coluna nullable no schema gerado — `leads.criado_em` é `not null` na
 * tabela de origem, então `null` não deveria acontecer na prática; o
 * fallback pra 0 é só uma guarda de tipo.
 */
export function ageDays(iso: string | null): number {
  if (!iso) return 0;
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Texto + tooltip de `.kcard-dias` — espelha `leadPonto`/o trecho do card do
 * protótipo V12 (`cotecerto_prototipo_v12 - cópia.html`, por volta da linha
 * 3364): `${l.age===0?'hoje':'há '+l.age+'d'}` com
 * `title="Parado há ${l.age===0?'menos de um dia':l.age+' dia(s)'}"`.
 */
export function diasLabel(dias: number): { texto: string; titulo: string } {
  if (dias === 0) return { texto: "hoje", titulo: "Parado há menos de um dia" };
  return { texto: `há ${dias}d`, titulo: `Parado há ${dias} dia(s)` };
}

/**
 * Resumo "marca modelo ano" do veículo da cotação mais recente do lead —
 * mesmo padrão de exibição já usado em em-cotacao.tsx/em-negociacao.tsx/
 * em-finalizacao.tsx. `null` quando a cotação ainda não tem veículo (ou o
 * lead ainda não tem cotação).
 *
 * Pipeline V12, T8: `pipeline_leads_etapa` traz `marca_nome`/`modelo_nome`/
 * `ano_modelo` soltos na própria linha do lead (não mais um objeto
 * `cotacao.veiculo` aninhado) — os chamadores passam o lead inteiro (ou um
 * recorte dele), que já satisfaz este `Pick`.
 */
export function veiculoResumo(
  veiculo: Pick<PipelineLeadRow, "marca_nome" | "modelo_nome" | "ano_modelo"> | null | undefined,
): string | null {
  if (!veiculo) return null;
  const texto = [veiculo.marca_nome, veiculo.modelo_nome, veiculo.ano_modelo]
    .filter(Boolean)
    .join(" ");
  return texto || null;
}

/** Buckets do funil que aparecem como coluna do Kanban (perdido fica de fora — vira filtro). */
export type EtapaAtivaInfo = {
  key: Exclude<LeadEtapaBucket, "perdido">;
  label: string;
  cor: string;
};

export const ETAPAS_ATIVAS: readonly EtapaAtivaInfo[] = [
  { key: "novo", label: "Lead novo", cor: "#425563" },
  { key: "cotacao", label: "Em cotação", cor: "#5C6F80" },
  { key: "negociacao", label: "Em negociação", cor: "#FFB600" },
  { key: "finalizacao", label: "Em finalização", cor: "#F0A800" },
  { key: "fechamento", label: "Fechamento", cor: "#2E8B57" },
];

export const ETAPA_LABEL: Record<LeadEtapaBucket, string> = {
  novo: "Lead novo",
  cotacao: "Em cotação",
  negociacao: "Em negociação",
  finalizacao: "Em finalização",
  fechamento: "Fechamento",
  perdido: "Perdido",
};

/** Descrição curta de cada coluna do Kanban — espelha `ETAPAS[].d` do protótipo V12. */
export const ETAPA_DESCRICAO: Record<LeadEtapaBucket, string> = {
  novo: "chegaram para atendimento e ninguém abriu ainda",
  cotacao: "preenchendo segurado, seguro, veículo, perfil e coberturas",
  negociacao: "já calcularam — ajustando coberturas e preço com o cliente",
  finalizacao: "na transmissão: dados, confirmação, pagamento",
  fechamento: "transmitida — aguardando vistoria, pagamento ou emissão",
  perdido: "devolvidos ou descartados, com o motivo",
};

/** Campos do lead necessários pra `pontoExato` (T6/T8). */
export type PontoExatoLead = Pick<
  PipelineLeadRow,
  | "etapa"
  | "cotacao_status"
  | "step_atual"
  | "transmissao_fase"
  | "transmissao_aberta_status"
  | "proposta_numero"
  | "proposta_transmissao_status"
>;

/**
 * Rótulo legível de `propostas.transmissao_status`. Hoje só existe
 * `PROPOSTA_TRANSMITIDA_STATUS` ("transmitida") — a coluna é `string | null`
 * livre no banco, então tratamos genericamente (fallback pro próprio valor).
 */
function transmissaoStatusLabel(status: string | null): string {
  if (status === "transmitida") return "transmitida";
  return status ?? "transmitida";
}

/**
 * "Ponto exato" onde o lead está — espelha `leadPonto()` do protótipo V12
 * (`cotecerto_prototipo_v12.html`, por volta da linha 2917), com a
 * granularidade real por bucket (T6, antes um texto fixo por bucket — T9).
 * Desde T8, os campos vêm soltos na própria linha da view
 * `pipeline_leads_etapa` (`@/lib/pipeline-query`), não mais aninhados em
 * `cotacao`/`propostaTransmitida`:
 * - `cotacao`: o passo do wizard (`step_atual` → `STEPS`,
 *   `@/components/venda/novo-lead/types`).
 * - `finalizacao`: o sub-passo pré-envio da Etapa 7 (`transmissao_fase`,
 *   gravado por `StepTransmissao.tsx` via T5) e, quando não há sub-passo
 *   pré-envio, o status real da tentativa em aberto
 *   (`transmissao_aberta_status`, T6b) — "enviada" (transmitindo) vs "falha".
 * - `fechamento`: número e status da proposta (`proposta_numero`/
 *   `proposta_transmissao_status`).
 *
 * `transmissao_fase` nunca é limpo depois que a transmissão de verdade é
 * disparada (só é gravado enquanto o vendedor navega pelos sub-passos
 * "dados"/"confirmação"/"pagamento" — `StepTransmissao.tsx`/`novo-lead.tsx`),
 * então continua tendo prioridade quando presente; `transmissao_aberta_status`
 * (T6b) só entra no fallback genérico (fase ausente/desconhecida), pra
 * diferenciar "enviada" de "falha" onde antes o texto era fixo.
 *
 * Não cobre `'perdido'`: nesse bucket o card já mostra o chip de motivo de
 * perda, que cumpre o mesmo papel.
 */
export function pontoExato(lead: PontoExatoLead): string | null {
  switch (lead.etapa) {
    case "novo":
      return "aguardando o primeiro contato";
    case "cotacao": {
      const passo = lead.step_atual != null ? STEPS[lead.step_atual] : undefined;
      return passo ? `parou em ${passo}` : "preenchendo a cotação";
    }
    case "negociacao":
      return "no cálculo — comparando seguradoras";
    case "finalizacao": {
      const fase = lead.transmissao_fase ?? null;
      if (fase === "dados") return "transmissão · dados complementares";
      if (fase === "confirmacao") return "transmissão · confirmação";
      if (fase === "pagamento") return "transmissão · pagamento";
      if (lead.cotacao_status == null) return "transmissão em andamento";
      if (lead.transmissao_aberta_status === "falha") return "transmissão · falhou";
      return "transmissão · transmitindo";
    }
    case "fechamento": {
      if (!lead.proposta_numero) return "aguardando a seguradora";
      return `proposta ${lead.proposta_numero} · ${transmissaoStatusLabel(lead.proposta_transmissao_status)}`;
    }
    case "perdido":
      return null;
  }
}

/** Campos do lead necessários pra `proximaAcao` (T6/T8). */
export type ProximaAcaoLead = Pick<
  PipelineLeadRow,
  "etapa" | "step_atual" | "transmissao_fase" | "transmissao_aberta_status" | "motivo_perda"
>;

/**
 * Próxima ação recomendada pro vendedor — textos aprovados (T6). Dentro de
 * `cotacao`, segue os 3 grupos de passos do wizard (`STEPS`): Segurado/Seguro
 * → Veículo/Perfil → Coberturas (e além, ainda em rascunho, ex. voltou pro
 * Cálculo sem ter recalculado).
 *
 * Dentro de `finalizacao`, o sub-passo pré-envio (`transmissao_fase`) segue
 * tendo prioridade; só quando ele não está presente (T6b) é que
 * `transmissao_aberta_status` distingue "enviada" (ainda transmitindo,
 * aguarda o robô) de "falha" (a tentativa não foi pra frente, precisa revisar
 * e reenviar).
 */
export function proximaAcao(lead: ProximaAcaoLead): string | null {
  switch (lead.etapa) {
    case "novo":
      return "Fazer o primeiro contato";
    case "cotacao": {
      const passo = lead.step_atual ?? 0;
      if (passo <= 1) return "Completar os dados do segurado";
      if (passo <= 3) return "Completar os dados do veículo";
      return "Ajustar coberturas e rodar o cálculo";
    }
    case "negociacao":
      return "Comparar seguradoras e enviar a proposta";
    case "finalizacao": {
      const fase = lead.transmissao_fase ?? null;
      if (fase === "dados" || fase === "confirmacao" || fase === "pagamento") {
        return "Completar os dados que a seguradora pede";
      }
      if (lead.transmissao_aberta_status === "falha") return "Revisar e reenviar a transmissão";
      return "Aguardar o retorno do robô da seguradora";
    }
    case "fechamento":
      return "Acompanhar a emissão da apólice";
    case "perdido":
      return lead.motivo_perda;
  }
}

/** Texto do chip amarelo "Retorno agendado" — mesma classificação de urgência de `@/lib/agenda`. */
export function retornoLabel(retorno: PipelineRetornoPendente): string {
  const urgencia = classificarUrgencia(retorno.data);
  return `Retorno ${urgencia.label}${retorno.hora ? ` · ${retorno.hora.slice(0, 5)}` : ""}`;
}

/**
 * Texto do cabeçalho — espelha o header de `render_pipeline()` do protótipo
 * V12: "X de Y leads em andamento · Z em negociação · W em fechamento".
 *
 * Pipeline V12, T8: com a paginação por coluna, a tela não tem mais a lista
 * completa de leads em memória para contar — `resumo` vem de
 * `fetchPipelineResumoEtapas(filtrosComuns)` (`@/lib/pipeline-query`), que já
 * agrega `etapa → total` no banco respeitando os filtros "granulares"
 * (ramo/origem/parado/motivo — os únicos que fazem parte de
 * `PipelineFiltrosResumo`). `Y` (denominador) e os totais de
 * negociação/fechamento vêm direto desse agregado; `X` (numerador) aplica
 * por cima, em memória, os dois filtros que não fazem parte da query
 * agregada — Estágio (`etapaFiltro`) e Status (`statusFiltro`), que na tela
 * decidem quais colunas são buscadas, não uma cláusula WHERE própria.
 */
export function pipelineHeaderResumo(
  resumo: readonly PipelineResumoEtapa[],
  etapaFiltro: LeadEtapaBucket | "todas",
  statusFiltro: "todos" | "ativos" | "perdidos",
): string {
  const porEtapa = new Map(resumo.map((r) => [r.etapa, r.total]));
  const ativos = resumo.filter((r) => r.etapa !== "perdido").reduce((acc, r) => acc + r.total, 0);
  const negociacao = porEtapa.get("negociacao") ?? 0;
  const fechamento = porEtapa.get("fechamento") ?? 0;

  const filtradosAtivos =
    statusFiltro === "perdidos" || etapaFiltro === "perdido"
      ? 0
      : etapaFiltro === "todas"
        ? ativos
        : (porEtapa.get(etapaFiltro) ?? 0);

  return `${filtradosAtivos} de ${ativos} leads em andamento · ${negociacao} em negociação · ${fechamento} em fechamento`;
}
