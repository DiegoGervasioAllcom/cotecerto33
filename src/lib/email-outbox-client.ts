import { supabase } from "@/integrations/supabase/client";

export async function findRetryableAccessEmail(): Promise<string | null> {
  const { data, error } = await supabase
    .from("email_outbox")
    .select("id,status,processando_em,tentativas")
    .in("status", ["pendente", "falhou"])
    .lt("tentativas", 10)
    .order("criado_em", { ascending: false })
    .limit(20);
  if (error) throw error;

  return data?.[0]?.id ?? null;
}
