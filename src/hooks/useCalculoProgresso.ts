import { useEffect, useId, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularProgresso,
  type CalculoProgressoRow,
  type CalculoProgressoView,
} from "@/lib/calculo-progresso";

export const CALCULO_POLL_MS = 4000;

const COLS = "cotacao_id,etapa,seq,erro,iniciado_em,atualizado_em";

async function lerEstado(ids: string[]): Promise<CalculoProgressoRow[] | null> {
  const { data, error } = await supabase
    .from("cotacao_calculo_progresso")
    .select(COLS)
    .in("cotacao_id", ids);
  return error ? null : data;
}

/**
 * Progresso real do cálculo (webhook do robô → `cotacao_calculo_progresso`).
 * Lê o estado ao montar, assina Realtime e, se o canal cair, faz polling de
 * 4 s apenas com a aba visível. O tick de 5 s recalcula "sem atualização há X s".
 */
export function useCalculoProgresso(cotacaoIds: string[]): Map<string, CalculoProgressoView> {
  const instancia = useId();
  const chave = [...cotacaoIds].sort().join(",");
  const [rows, setRows] = useState<Map<string, CalculoProgressoRow>>(new Map());
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const ids = chave ? chave.split(",") : [];
    if (ids.length === 0) return;
    let vivo = true;
    let realtimeOk = false;
    const aplicar = (lista: CalculoProgressoRow[]) => {
      if (!vivo) return;
      setRows((prev) => {
        const next = new Map(prev);
        for (const r of lista) next.set(r.cotacao_id, r);
        return next;
      });
    };
    const reler = async () => {
      const lista = await lerEstado(ids);
      if (lista) aplicar(lista);
    };
    void reler();

    // Realtime aceita no máx. 100 valores no `in`; o que passar disso cai no polling (lê todos).
    const filtro = `cotacao_id=in.(${ids.slice(0, 100).join(",")})`;
    const channel = supabase
      .channel(`calculo-progresso-${instancia}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cotacao_calculo_progresso", filter: filtro },
        (payload) => {
          const nova = payload.new as Partial<CalculoProgressoRow>;
          if (nova.cotacao_id && nova.etapa !== undefined) aplicar([nova as CalculoProgressoRow]);
        },
      )
      .subscribe((status) => {
        realtimeOk = status === "SUBSCRIBED" && ids.length <= 100;
        if (realtimeOk) void reler();
      });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible" && !realtimeOk) void reler();
    }, CALCULO_POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void reler();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      vivo = false;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
      void supabase.removeChannel(channel);
    };
  }, [chave, instancia]);

  useEffect(() => {
    if (!chave) return;
    const t = setInterval(() => setAgora(Date.now()), 5000);
    return () => clearInterval(t);
  }, [chave]);

  return useMemo(() => {
    const out = new Map<string, CalculoProgressoView>();
    if (!chave) return out;
    for (const id of chave.split(",")) out.set(id, calcularProgresso(rows.get(id), id, agora));
    return out;
  }, [chave, rows, agora]);
}
