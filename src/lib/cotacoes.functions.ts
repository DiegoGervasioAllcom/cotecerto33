import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const salvarCotacaoRascunho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cotacaoId: string | null; payload: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: data.cotacaoId,
      p_payload: data.payload as never,
    });
    if (error) throw new Error(error.message);
    return { cotacaoId: id as string };
  });
