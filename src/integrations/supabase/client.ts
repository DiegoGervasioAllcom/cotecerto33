import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://missing-supabase-url.invalid";
const FALLBACK_SUPABASE_KEY = "missing-supabase-anon-key";

// Self-hosted Supabase — anon key é publishable, ok no bundle do cliente.
const DEFAULT_SUPABASE_URL = "https://supabase-cotecerto.sandboxall.com";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzc2NzE2MjYyLCJleHAiOjE5MzQzOTYyNjJ9.6DLaG_KS4JoehbSWS4NcLBJqd7UiAD3IE2oyHqhv5rQ";

const SUPABASE_URL = String(
  import.meta.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL,
).trim();
const SUPABASE_ANON_KEY = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    DEFAULT_SUPABASE_ANON_KEY,
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

export const supabase: SupabaseClient = createClient(
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

export type Perfil = "matriz" | "master" | "vendedor";
export type EmpresaStatus = "pendente" | "aprovada" | "recusada" | "suspensa";

export interface Profile {
  id: string;
  empresa_id: string | null;
  nome: string;
  email: string;
  avatar_url: string | null;
  status: EmpresaStatus;
}

export interface Empresa {
  id: string;
  nome: string;
  tipo: "pj" | "pf";
  documento: string;
  status: EmpresaStatus;
  parent_id: string | null;
}
