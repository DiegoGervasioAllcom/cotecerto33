// Helpers de apresentação do Pipeline (Kanban + Tabela) — Pipeline V12, T9.
// Funções puras extraídas de pipeline.tsx (regra 9 do AGENTS.md — não deixar
// o arquivo da rota crescer) e fáceis de testar isoladamente.
import { classificarUrgencia } from "@/lib/agenda";
import type { LeadEtapaBucket } from "@/lib/lead-etapa";
import type {
  PipelineCotacao,
  PipelineLeadRow,
  PipelineRetornoPendente,
} from "@/lib/pipeline-data";

export function money(v: number | null): string {
  return v
    ? Number(v).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      })
    : "—";
}

export function ageDays(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Resumo "marca modelo ano" do veículo da cotação mais recente do lead —
 * mesmo padrão de exibição já usado em em-cotacao.tsx/em-negociacao.tsx/
 * em-finalizacao.tsx. `null` quando a cotação ainda não tem veículo (ou o
 * lead ainda não tem cotação).
 */
export function veiculoResumo(
  veiculo: PipelineCotacao["veiculo"] | null | undefined,
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

/**
 * "Ponto exato" onde o lead está — espelha `leadPonto()` do protótipo V12
 * (`cotecerto_prototipo_v12.html`, por volta da linha 2917), simplificado:
 * o protótipo detalha o passo exato do wizard (ex. "parou em Coberturas") e
 * o sub-status da transmissão porque guarda esse progresso em memória; o
 * nosso `PipelineCotacao` (pipeline-data.ts) não expõe esse nível de detalhe
 * — não tem `step_atual` nem o sub-passo da transmissão —, então aqui é um
 * texto fixo por bucket. Simplificação documentada e aceita pela task (T9).
 * Não cobre `'perdido'`: nesse bucket o card já mostra o chip de motivo de
 * perda, que cumpre o mesmo papel.
 */
export function pontoExato(etapa: LeadEtapaBucket): string | null {
  switch (etapa) {
    case "novo":
      return "aguardando o primeiro contato";
    case "cotacao":
      return "preenchendo a cotação";
    case "negociacao":
      return "no cálculo — comparando seguradoras";
    case "finalizacao":
      return "transmissão em andamento";
    case "fechamento":
      return "aguardando a seguradora";
    case "perdido":
      return null;
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
 * `todos` é a base completa (sem filtro) usada para os totais de negociação/
 * fechamento e para o denominador; `filtrados` já passou pelos filtros da
 * tela e é o numerador ("X de Y").
 */
export function pipelineHeaderResumo(
  todos: readonly Pick<PipelineLeadRow, "etapa">[],
  filtrados: readonly Pick<PipelineLeadRow, "etapa">[],
): string {
  const ativos = todos.filter((l) => l.etapa !== "perdido").length;
  const filtradosAtivos = filtrados.filter((l) => l.etapa !== "perdido").length;
  const negociacao = todos.filter((l) => l.etapa === "negociacao").length;
  const fechamento = todos.filter((l) => l.etapa === "fechamento").length;
  return `${filtradosAtivos} de ${ativos} leads em andamento · ${negociacao} em negociação · ${fechamento} em fechamento`;
}
