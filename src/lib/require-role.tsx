import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useGroupScope } from "@/lib/group-scope";
import type { Perfil } from "@/integrations/supabase/client";
import { podeAcessarCentral, podeAcessarGestaoGeral } from "@/lib/route-access";

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

/**
 * Guard para as telas que a Matriz, a Franquia Full e o time interno
 * (Marketing) compartilham desde V11.5.2b/V11.I (Central da Franquia:
 * `/comando/leads`, `/comando/distribuicao`).
 *
 * Não dá pra expressar isto com `useRequireRole("matriz", "franqueado")`
 * porque "Full" não é um valor do enum `perfil` — franqueado Full e
 * Individual têm o mesmo `role`; quem distingue é `useGroupScope().isFranqFull`
 * (lê `modelos_franquia.modalidade` via `empresa.modelo_id`). Franquia
 * Individual continua batendo em `/inicio`, igual a qualquer outro perfil não
 * autorizado.
 *
 * `interno` (Marketing/Assistente Comercial) entra aqui por role, não por
 * área — o RLS (V11.I.2) já escopa o dado pra "operação própria da Matriz"
 * independente do cargo; quem decide se a tela aparece no MENU é
 * `cargo_areas` (Marketing tem `mleads`/`mdist`, Assistente Comercial não).
 * Um Assistente Comercial que navegue pra cá manualmente só vê o mesmo dado
 * escopado à Matriz — sem furo de segurança, só uma tela fora do menu dele.
 */
export function useRequireMatrizOuFranquiaFull(): ReactNode | null {
  const { loading: authLoading, role } = useAuth();
  const { loading: scopeLoading, isFranqFull } = useGroupScope();

  if (authLoading || scopeLoading) return null;
  if (podeAcessarCentral(role, isFranqFull)) return null;

  return <Navigate to="/inicio" replace />;
}

/**
 * Telas das 17 areas que o Coordenador Comercial enxerga junto da Matriz.
 * As operacoes continuam submetidas as policies existentes; este guard nao
 * concede permissao de escrita.
 */
export function useRequireMatrizOuCoordenador(): ReactNode | null {
  const { loading, role } = useAuth();

  if (loading) return null;
  if (podeAcessarGestaoGeral(role)) return null;

  return <Navigate to="/inicio" replace />;
}
