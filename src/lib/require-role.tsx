import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import type { Perfil } from "@/integrations/supabase/client";

/**
 * Guard client-side de defesa em profundidade para telas exclusivas de uma
 * (ou mais) role(s). O RLS já protege o dado; isto só evita que a TELA
 * renderize para quem não deveria nem acessá-la (ex.: Franqueado navegando
 * manualmente para uma rota exclusiva da Matriz).
 *
 * Segue o mesmo padrão de `_authenticated/route.tsx` e `routes/index.tsx`:
 * redirect client-side via `<Navigate />`, sem `beforeLoad` (o projeto não
 * usa esse mecanismo em nenhuma rota hoje).
 *
 * Uso: no componente da rota, antes do conteúdo:
 * ```tsx
 * const denied = useRequireRole("matriz");
 * if (denied) return denied;
 * ```
 */
export function useRequireRole(...allowed: Perfil[]): ReactNode | null {
  const { loading, role } = useAuth();

  if (loading) return null;
  if (role && allowed.includes(role)) return null;

  return <Navigate to="/inicio" replace />;
}
