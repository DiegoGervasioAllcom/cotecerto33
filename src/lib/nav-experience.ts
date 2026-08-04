import type { Perfil } from "@/integrations/supabase/client";
import type { AreaChave } from "@/lib/use-areas";

/**
 * As 3 experiências de navegação da rede externa (fora do recorte por
 * cargo/área do time interno — ver docstring de `use-areas.ts`):
 * - `venLike`: vendedor e Franquia Individual (nav de venda, 9 itens).
 * - `fullLike`: Franquia Full — espelho da Matriz, 15 áreas (V11.5.2a).
 * - `grpLike`: Master e Supervisor (nav de grupo, 12 itens). Full saiu daqui
 *   nesta task; Supervisor já tinha saído no H7 (é time interno agora).
 *
 * Extraído do `AppShell` pra poder testar a decisão sem montar o componente
 * (mesmo padrão de `tutorial-persona.ts`).
 */
export type NavExperiencia = {
  venLike: boolean;
  fullLike: boolean;
  grpLike: boolean;
};

export function resolveNavExperiencia(input: {
  role: Perfil | null | undefined;
  /** `franqueado` com modelo Individual (não Full). */
  isFranqIndividual: boolean;
  /** `franqueado` com modelo Full — a "matrizinha" (Frente 5). */
  isFranqFull: boolean;
  /** true para master, supervisor e franquia Full (ver `useGroupScope`). */
  isGroupView: boolean;
  /**
   * true enquanto a query de modalidade do franqueado (Individual/Full)
   * ainda não chegou — nenhuma das 3 experiências fica true nesse meio-tempo,
   * pra não "piscar" a nav errada antes do dado certo.
   */
  franqPend: boolean;
}): NavExperiencia {
  const { role, isFranqIndividual, isFranqFull, isGroupView, franqPend } = input;
  if (franqPend) return { venLike: false, fullLike: false, grpLike: false };

  const venLike = role === "vendedor" || (role === "franqueado" && isFranqIndividual);
  const fullLike = role === "franqueado" && isFranqFull;
  const grpLike = isGroupView && role !== "supervisor" && !fullLike;

  return { venLike, fullLike, grpLike };
}

/**
 * Áreas de fora do menu espelho da Franquia Full — regra 8 das Regras
 * Decididas (Lis, 26/07/2026): "o menu vira um espelho da Matriz... de fora
 * apenas Franquias e as Configurações globais". A Lis registrou "16 áreas";
 * as 17 do time interno menos estas 2 dá 15 — divergência conhecida entre a
 * contagem da Lis e a exclusão nomeada, não forçada aqui (ver relatório da
 * task V11.5.2a). `mconf` é só a tela GLOBAL de Configurações da Matriz — uma
 * eventual tela de configuração da própria franquia não entra nesta lista.
 */
const AREAS_FORA_DA_FULL = new Set<AreaChave>(["mfranq", "mconf"]);

export function ehAreaDaFull(area: AreaChave): boolean {
  return !AREAS_FORA_DA_FULL.has(area);
}
