import type { CalculoProgressoView } from "@/lib/calculo-progresso";

export type EstadoCalculoMobile = "calculando" | "erro" | "pronta" | "aguardando";

/**
 * Estado do cálculo para o mobile. Prioriza o progresso real do robô; sem linha de
 * progresso (ou canal Realtime caído) cai no `cotacoes.status` como fallback.
 */
export function estadoCalculoMobile(
  progresso: Pick<CalculoProgressoView, "etapa" | "final"> | undefined,
  status: string,
  temResultados: boolean,
): EstadoCalculoMobile {
  if (progresso?.final === "erro" || status === "erro_quiver") return "erro";
  if (progresso?.final === "concluido") return "pronta";
  if (progresso?.etapa) return "calculando";
  // Enviada ao robô e ainda sem progresso nem prêmios: está aguardando, não "pronta sem prêmios".
  if (status === "enviada_quiver" && !temResultados) return "aguardando";
  if (temResultados || status !== "rascunho") return "pronta";
  return "aguardando";
}
