import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const FALLBACK_SUPABASE_URL = "https://missing-supabase-url.invalid";
const FALLBACK_SUPABASE_KEY = "missing-supabase-anon-key";

// Configuração SOMENTE via variáveis de ambiente (.env — ver .env.example).
// Sem defaults hardcoded: ambiente não configurado entra em modo seguro,
// em vez de apontar silenciosamente para a produção.
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_ANON_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    "",
).trim();

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && isHttpUrl(SUPABASE_URL),
);

export const supabaseConfigError = !SUPABASE_URL
  ? "VITE_SUPABASE_URL não está configurada."
  : !isHttpUrl(SUPABASE_URL)
    ? "VITE_SUPABASE_URL precisa ser uma URL http(s) válida."
    : !SUPABASE_ANON_KEY
      ? "Configure VITE_SUPABASE_ANON_KEY ou VITE_SUPABASE_PUBLISHABLE_KEY."
      : null;

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    `[Supabase] ${supabaseConfigError} O cliente foi iniciado em modo seguro sem conexão.`,
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  isSupabaseConfigured ? SUPABASE_URL : FALLBACK_SUPABASE_URL,
  isSupabaseConfigured ? SUPABASE_ANON_KEY : FALLBACK_SUPABASE_KEY,
  {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

// Aliases derivados do schema gerado (bun run db:types) — mesmos nomes
// exportados de antes, para não mudar nenhum import nos consumidores.
export type Perfil = Database["public"]["Enums"]["perfil"];
export type EmpresaStatus = Database["public"]["Enums"]["empresa_status"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Empresa = Database["public"]["Tables"]["empresas"]["Row"];
