import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes. " +
      "Verifique o arquivo .env.",
  );
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY ?? "",
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
