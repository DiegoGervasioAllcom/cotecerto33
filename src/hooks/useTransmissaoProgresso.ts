import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularTransmissaoProgresso,
  type TransmissaoProgressoRow,
  type TransmissaoProgressoView,
} from "@/lib/transmissao-progresso";

export const TRANSMISSAO_POLL_MS = 4000;

const COLS = "tentativa_id,cotacao_id,etapa,seq,erro,atualizado_em";

/**
 * Progresso real da transmissão (`cotacao_transmissao_progresso`). Lê ao
 * montar (funciona após recarregar a página), assina Realtime e, se o canal
 * cair, faz polling de 4 s com a aba visível. Tick de 5 s para "sem
 * atualização há X s".
 */
export function useTransmissaoProgresso(
  tentativaId: string | null | undefined,
): TransmissaoProgressoView {
  const [row, setRow] = useState<TransmissaoProgressoRow | undefined>();
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!tentativaId) return;
    // Nova tentativa: não mostra o estado (ex.: erro) da anterior até a primeira leitura.
    setRow(undefined);
    let vivo = true;
    let realtimeOk = false;
    const reler = async () => {
      const { data, error } = await supabase
        .from("cotacao_transmissao_progresso")
        .select(COLS)
        .eq("tentativa_id", tentativaId)
        .maybeSingle();
      if (vivo && !error && data) setRow(data);
    };
    void reler();

    const channel = supabase
      .channel(`transmissao-progresso-${tentativaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cotacao_transmissao_progresso",
          filter: `tentativa_id=eq.${tentativaId}`,
        },
        (payload) => {
          const nova = payload.new as Partial<TransmissaoProgressoRow>;
          if (vivo && nova.tentativa_id && nova.etapa !== undefined) {
            setRow(nova as TransmissaoProgressoRow);
          }
        },
      )
      .subscribe((status) => {
        realtimeOk = status === "SUBSCRIBED";
        if (realtimeOk) void reler();
      });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && !realtimeOk) void reler();
    }, TRANSMISSAO_POLL_MS);
    const tick = setInterval(() => setAgora(Date.now()), 5000);
    const onVis = () => {
      if (document.visibilityState === "visible") void reler();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      vivo = false;
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(channel);
    };
  }, [tentativaId]);

  return useMemo(
    () => calcularTransmissaoProgresso(tentativaId ? row : undefined, agora),
    [tentativaId, row, agora],
  );
}
