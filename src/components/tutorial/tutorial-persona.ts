import type { Perfil } from "@/integrations/supabase/client";
import type { TutorialKind } from "./tutorial-types";

type TutorialPersonaInput = {
  role: Perfil | null;
  isGroupView: boolean;
  isFranqIndividual: boolean;
  scopeLoading: boolean;
};

/** Espelha as seis experiências do mapa de perfis; o carregamento da franquia não exibe roteiro. */
export function resolveTutorialKind({
  role,
  isGroupView,
  isFranqIndividual,
  scopeLoading,
}: TutorialPersonaInput): TutorialKind | null {
  if (role === "matriz") return "matriz";
  if (role === "franqueado" && scopeLoading) return null;
  if (role === "vendedor" || (role === "franqueado" && isFranqIndividual)) return "sales";
  return isGroupView ? "group" : null;
}
