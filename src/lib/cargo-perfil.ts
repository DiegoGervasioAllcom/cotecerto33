import type { Perfil } from "@/integrations/supabase/client";

/**
 * De qual perfil (RLS) um cargo do time interno deriva (V11 · F7).
 *
 * Espelha a decisão da Frente 0 (H1/H3): só `coordenador` entrou como valor
 * próprio no enum porque é nível estrutural da cadeia (aparece no escalonamento
 * de desconto). Os demais cargos vivem em `cargo_id`, e o perfil de RLS que
 * cada um usa é:
 *
 *   matriz_total                        -> matriz
 *   coord_com                           -> coordenador
 *   sup_vendas/sup_operacional/backoffice -> supervisor (o cargo distingue quem
 *                                            tem alçada de desconto — H6)
 *   assist_com/marketing (e qualquer     -> interno (motivo: royalties do
 *   cargo custom futuro)                    fechamento de comissão são pagos a
 *                                            quem tem role 'supervisor' — um
 *                                            Assistente marcado assim entraria
 *                                            nesse laço por engano)
 *   sem cargo (Vendedor Matriz)          -> vendedor
 *
 * Uma função só, para as duas telas (aprovação e futura reclassificação) nunca
 * divergirem sobre qual perfil um cargo implica.
 */
export function perfilDoCargo(cargoId: string | null): Perfil {
  if (cargoId === null) return "vendedor";
  if (cargoId === "matriz_total") return "matriz";
  if (cargoId === "coord_com") return "coordenador";
  if (["sup_vendas", "sup_operacional", "sup_backoffice"].includes(cargoId)) return "supervisor";
  return "interno";
}

/** Os 3 cargos com alçada potencial de desconto (só sup_vendas tem, hoje — H6). */
export const CARGOS_SUPERVISAO = ["sup_vendas", "sup_operacional", "sup_backoffice"] as const;
