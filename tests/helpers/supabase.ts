import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/database.types";

// Pré-requisito: `bun run db:start` (Supabase local). As mesmas vars do .env do app.
const URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.VITE_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SELF_SUPABASE_SERVICE_ROLE_KEY || "";
if (!ANON || !SERVICE) {
  throw new Error("Defina VITE_SUPABASE_ANON_KEY e SELF_SUPABASE_SERVICE_ROLE_KEY no .env (chaves do `supabase start`).");
}

export type Db = SupabaseClient<Database>;

/** SOMENTE para montar fixtures (criar usuários, config). NUNCA usar em asserts de RLS. */
export const admin: Db = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function anonClient(): Db {
  return createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const MATRIZ = { email: "desenvolvimento@suppercerto.com.br", senha: "Supper@123!" };

export async function loginMatriz(): Promise<Db> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email: MATRIZ.email, password: MATRIZ.senha });
  if (error) throw new Error(`login da matriz falhou (seed aplicado? \`bun run db:reset\`): ${error.message}`);
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
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error || !data.user) throw new Error(`admin.createUser: ${error?.message}`);
  const client = anonClient();
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: senha });
  if (e2) throw new Error(`login ${email}: ${e2.message}`);
  return { client, userId: data.user.id, email };
}
