import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

type EmissaoRow = Database["public"]["Tables"]["acesso_emissoes"]["Row"];

export type AccessLinkEmission = Pick<
  EmissaoRow,
  "empresa_id" | "profile_id" | "numero" | "status" | "envio_confirmado_em"
>;

/** Última emissão de cada perfil no escopo que a RLS autoriza ver. */
export async function fetchAccessLinkEmissions(profileIds: string[]) {
  if (profileIds.length === 0) return [] as AccessLinkEmission[];
  const { data, error } = await supabase
    .from("acesso_emissoes")
    .select("empresa_id,profile_id,numero,status,envio_confirmado_em")
    .in("profile_id", profileIds)
    .order("numero", { ascending: false });
  if (error) throw error;
  const maisRecente = new Map<string, AccessLinkEmission>();
  for (const emissao of data ?? []) {
    if (!maisRecente.has(emissao.profile_id)) maisRecente.set(emissao.profile_id, emissao);
  }
  return [...maisRecente.values()];
}
