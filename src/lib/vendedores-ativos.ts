import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

export type ProfileAtivo = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "nome" | "status" | "desligado_em"
>;
export type UserRole = Pick<Database["public"]["Tables"]["user_roles"]["Row"], "user_id" | "role">;

const GESTOR_ROLES: readonly UserRole["role"][] = [
  "franqueado",
  "master",
  "supervisor",
  "coordenador",
  "matriz",
  "interno",
];
const ROLE_QUERY_CHUNK_SIZE = 100;
const ROLE_QUERY_PAGE_SIZE = 1_000;
const PROFILE_QUERY_PAGE_SIZE = 1_000;

/**
 * Carrega todos os perfis que a RLS tornou visíveis para a sessão atual.
 * A paginação é necessária porque o PostgREST limita respostas grandes mesmo
 * quando a rede tem mais de mil pessoas.
 */
export async function carregarPerfisVisiveis(): Promise<ProfileAtivo[]> {
  const profiles: ProfileAtivo[] = [];
  let pageStart = 0;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nome,status,desligado_em")
      .order("nome")
      .order("id")
      .range(pageStart, pageStart + PROFILE_QUERY_PAGE_SIZE - 1);

    if (error) throw new Error(`Falha ao carregar perfis: ${error.message}`);

    const page = (data ?? []) as ProfileAtivo[];
    profiles.push(...page);

    if (page.length < PROFILE_QUERY_PAGE_SIZE) return profiles;
    pageStart += PROFILE_QUERY_PAGE_SIZE;
  }
}

/**
 * Carrega somente os cargos dos perfis que a RLS já tornou visíveis na tela.
 * Os lotes e páginas evitam que o limite padrão da API oculte cargos em redes
 * grandes, sem fazer uma leitura independente de toda a tabela user_roles.
 */
export async function carregarRolesDosPerfis(profileIds: string[]): Promise<UserRole[]> {
  const uniqueProfileIds = [...new Set(profileIds)];
  const roles: UserRole[] = [];

  for (let start = 0; start < uniqueProfileIds.length; start += ROLE_QUERY_CHUNK_SIZE) {
    const profileIdsChunk = uniqueProfileIds.slice(start, start + ROLE_QUERY_CHUNK_SIZE);
    let pageStart = 0;

    while (true) {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id,role")
        .in("user_id", profileIdsChunk)
        .range(pageStart, pageStart + ROLE_QUERY_PAGE_SIZE - 1);
      if (error) throw new Error(`Falha ao carregar cargos dos perfis: ${error.message}`);

      const page = (data ?? []) as UserRole[];
      roles.push(...page);

      if (page.length < ROLE_QUERY_PAGE_SIZE) break;
      pageStart += ROLE_QUERY_PAGE_SIZE;
    }
  }

  return roles;
}

/**
 * A RLS já limita os perfis retornados à rede visível. Este recorte define as
 * opções de filtros de vendedor e evita expor perfis de gestão como vendedores.
 */
export function vendedoresAtivosDaRede<Profile extends ProfileAtivo>(
  profiles: Profile[],
  userRoles: UserRole[],
): Profile[] {
  const rolesByUserId = new Map<string, Set<UserRole["role"]>>();

  for (const userRole of userRoles) {
    const roles = rolesByUserId.get(userRole.user_id) ?? new Set<UserRole["role"]>();
    roles.add(userRole.role);
    rolesByUserId.set(userRole.user_id, roles);
  }

  return profiles.filter((profile) => {
    const roles = rolesByUserId.get(profile.id);
    return (
      Boolean(profile.nome) &&
      profile.status === "aprovada" &&
      !profile.desligado_em &&
      roles?.has("vendedor") &&
      !GESTOR_ROLES.some((role) => roles.has(role))
    );
  });
}
