import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useGroupScope } from "@/lib/group-scope";
import type { Perfil } from "@/integrations/supabase/client";
import { podeAcessarAreaInterna, podeAcessarCentral } from "@/lib/route-access";

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
 * Guard de `/operacao/xacessos` (Acessos da equipe — visão de grupo).
 *
 * QA manual (10/08/2026): a rota não tinha guard nenhum, então uma Franquia
 * Individual (mesmo `role` da Full, sem menu para esta tela) conseguia abrir
 * por URL direta e via "Convidar vendedor" — plenamente funcional — apesar de
 * o protótipo/docs deixarem claro que a Individual "opera como um vendedor,
 * sem cadastro de vendedores". Master e Supervisor não passam por aqui: o
 * Supervisor migrou para `/operacao/acessos` (somente leitura, via
 * `podeAdministrarAcessos`/área `macessos`).
 */
export function useRequireGrupoAcessos(): ReactNode | null {
  const { loading: authLoading, role } = useAuth();
  const { loading: scopeLoading, isFranqFull } = useGroupScope();

  if (authLoading || scopeLoading) return null;
  if (role === "master" || (role === "franqueado" && isFranqFull)) return null;

  return <Navigate to="/inicio" replace />;
}

/**
 * Barreira de família para telas internas. A autorização visual específica é
 * decidida por AreaChave no layout autenticado; este guard só impede que a
 * rede externa entre em uma rota interna por URL direta.
 */
export function useRequirePerfilInterno(): ReactNode | null {
  const { loading, role } = useAuth();

  if (loading) return null;
  if (podeAcessarAreaInterna(role)) return null;

  return <Navigate to="/inicio" replace />;
}
