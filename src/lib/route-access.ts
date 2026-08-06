import type { Perfil } from "@/integrations/supabase/client";

const PERFIS_INTERNOS = new Set<Perfil>(["matriz", "coordenador", "supervisor", "interno"]);

/**
 * Compatibilidade de cargo com a Central de Leads/Distribuicao.
 *
 * O cargo/override decide se o link aparece no menu. Este predicado resolve
 * apenas a familia de perfis que pode abrir a experiencia; a RLS continua
 * responsável pelo escopo dos dados e das mutacoes.
 */
export function podeAcessarCentral(role: Perfil | null | undefined, isFranqFull: boolean): boolean {
  if (!role) return false;
  if (PERFIS_INTERNOS.has(role)) return true;
  return role === "franqueado" && isFranqFull;
}

/** Telas que Coordenador visualiza com o mesmo alcance da Matriz. */
export function podeAcessarGestaoGeral(role: Perfil | null | undefined): boolean {
  return role === "matriz" || role === "coordenador";
}

/**
 * Escrita na tela de Configuracoes permanece exclusiva da Matriz.
 * Coordenador compartilha a visualizacao, nunca a capacidade de alterar.
 */
export function podeEditarConfiguracoes(role: Perfil | null | undefined): boolean {
  return role === "matriz";
}
