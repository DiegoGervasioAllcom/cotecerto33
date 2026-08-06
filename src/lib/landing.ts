import type { Perfil } from "@/integrations/supabase/client";
import { ehPerfilInterno } from "@/lib/use-areas";

export type LandingPath = "/inicio" | "/comando/visao-geral";

/** Decisão única de landing usada na raiz, no login e na defesa de `/inicio`. */
export function resolverLanding(input: {
  role: Perfil | null | undefined;
  isGroupView: boolean;
  groupLoading: boolean;
}): LandingPath | null {
  // A sessão do Supabase chega antes do contexto de perfil. `role=null` não é
  // vendedor: aguarde a resolução para não criar /inicio -> comando durante o
  // mesmo login (duas transições concorrentes no TanStack Router).
  if (!input.role) return null;
  if (input.role === "franqueado" && input.groupLoading) return null;
  if (ehPerfilInterno(input.role) || input.role === "master" || input.isGroupView) {
    return "/comando/visao-geral";
  }
  return "/inicio";
}
