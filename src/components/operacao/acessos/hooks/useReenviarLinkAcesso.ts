import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { dispatchAccessEmail } from "@/lib/email.functions";

async function enviarOutbox(outboxId: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");
  await dispatchAccessEmail({ data: { outbox_id: outboxId, caller_token: token } });
}

/** Reemissão contextual: cria uma nova versão e nunca tenta a outbox anterior. */
export function useReenviarLinkAcesso(onConcluido?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (empresaId: string) => {
      const { data: outboxId, error } = await supabase.rpc("reenviar_link_acesso", {
        p_empresa_id: empresaId,
      });
      if (error || !outboxId) {
        throw new Error(error?.message ?? "Não foi possível emitir um novo link de acesso.");
      }
      await enviarOutbox(outboxId);
    },
    onSuccess: async () => {
      // Só confirmamos a UI após buscar a nova emissão que o dispatcher confirmou.
      await queryClient.refetchQueries({ queryKey: ["acesso-emissoes"] });
      onConcluido?.();
    },
  });
}
