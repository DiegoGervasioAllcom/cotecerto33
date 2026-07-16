import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database.types";

// Pré-requisito: `bun run db:start` (Supabase local). As mesmas vars do .env do app.
const URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.VITE_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY || "";
if (!ANON || !SERVICE) {
  throw new Error(
    "Defina VITE_SUPABASE_ANON_KEY e SELF_SUPABASE_SERVICE_ROLE_KEY no .env (chaves do `supabase start`).",
  );
}

export type Db = SupabaseClient<Database>;

/** SOMENTE para montar fixtures (criar usuários, config). NUNCA usar em asserts de RLS. */
export const admin: Db = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function anonClient(): Db {
  return createClient<Database>(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const MATRIZ = { email: "desenvolvimento@suppercerto.com.br", senha: "Supper@123!" };

export async function loginMatriz(): Promise<Db> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({
    email: MATRIZ.email,
    password: MATRIZ.senha,
  });
  if (error)
    throw new Error(
      `login da matriz falhou (seed aplicado? \`bun run db:reset\`): ${error.message}`,
    );
  return c;
}

/** Identificadores únicos por run — suíte roda 2x seguidas sem colidir e sem truncates. */
export function uniq(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
}
export function uniqDoc(): string {
  return String(Date.now()).slice(-11).padStart(11, "9");
}

/** Cria usuário autenticável (o trigger handle_new_user cria o profile pendente). */
export async function criarUsuario(email: string, senha = "Teste@123!") {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`admin.createUser: ${error?.message}`);
  const client = anonClient();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: senha });
  if (e2) throw new Error(`login ${email}: ${e2.message}`);
  return { client, userId: data.user.id, email };
}

type Perfil = Database["public"]["Enums"]["perfil"];

/**
 * Cria uma empresa aprovada via admin (fixture). `overrides.parent_id` monta rede
 * (franquia filha de um master/matriz).
 */
export async function criarEmpresa(overrides?: {
  nome?: string;
  tipo?: Database["public"]["Enums"]["empresa_tipo"];
  documento?: string;
  status?: Database["public"]["Enums"]["empresa_status"];
  parent_id?: string;
  uf?: string;
  cidade?: string;
}): Promise<{ id: string }> {
  const { data, error } = await admin
    .from("empresas")
    .insert({
      nome: overrides?.nome ?? uniq("Empresa"),
      tipo: overrides?.tipo ?? "pj",
      documento: overrides?.documento ?? uniqDoc(),
      status: overrides?.status ?? "aprovada",
      parent_id: overrides?.parent_id,
      uf: overrides?.uf,
      cidade: overrides?.cidade,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Generaliza o padrão manual (admin cria empresa → criarUsuario → admin seta
 * profiles.empresa_id/status='aprovada' → admin insere user_roles) usado em
 * distribuicao-lead.test.ts e user-roles-select-rede.test.ts.
 *
 * Sem `opts.empresaId`, cria uma empresa nova (use `opts.parentId` para pendurá-la
 * como filha de uma empresa existente — monta rede master→franquia).
 *
 * `opts.superiorId` religa `profiles.superior_id` (hierarquia de pessoas usada por
 * `empresas_visiveis()` desde a G1.2 — visibilidade multinível não depende mais só
 * de `empresas.parent_id`).
 */
export async function criarPersonaComEmpresa(
  role: Perfil,
  opts?: { empresaId?: string; parentId?: string; emailPrefix?: string; superiorId?: string },
): Promise<{ client: Db; userId: string; empresaId: string; email: string }> {
  const empresaId = opts?.empresaId ?? (await criarEmpresa({ parent_id: opts?.parentId })).id;
  const { client, userId, email } = await criarUsuario(
    `${uniq(opts?.emailPrefix ?? role)}@teste.local`,
  );
  await admin
    .from("profiles")
    .update({
      empresa_id: empresaId,
      status: "aprovada",
      ...(opts?.superiorId ? { superior_id: opts.superiorId } : {}),
    })
    .eq("id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role });
  return { client, userId, empresaId, email };
}
