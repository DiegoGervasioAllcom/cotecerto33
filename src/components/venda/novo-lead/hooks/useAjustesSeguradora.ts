import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AjusteSeguradora } from "../ajusteSeguradora.schema";

export type AjusteGuardado = {
  seguradora: string;
  franquia1: string | null;
  franquia2: string | null;
  vidros: string | null;
  carroReserva: string | null;
  /** Preenchido só depois que o envio ao robô deu certo. */
  aplicadoEm: string | null;
};

export const ajustesKey = (cotacaoId: string | null) => ["ajustes-seguradora", cotacaoId] as const;

/** Ajustes por seguradora da cotação (V12.3.7), por seguradora. A RLS escopa. */
export function useAjustesSeguradora(cotacaoId: string | null) {
  const q = useQuery({
    queryKey: ajustesKey(cotacaoId),
    enabled: !!cotacaoId,
    queryFn: async (): Promise<Record<string, AjusteGuardado>> => {
      const { data, error } = await supabase
        .from("cotacao_seguradora_ajustes")
        .select(
          "seguradora,franquia_primeira_opcao,franquia_segunda_opcao,vidros,carro_reserva,aplicado_em",
        )
        .eq("cotacao_id", cotacaoId ?? "");
      if (error) throw new Error(error.message);
      return Object.fromEntries(
        (data ?? []).map((r) => [
          r.seguradora,
          {
            seguradora: r.seguradora,
            franquia1: r.franquia_primeira_opcao,
            franquia2: r.franquia_segunda_opcao,
            vidros: r.vidros,
            carroReserva: r.carro_reserva,
            aplicadoEm: r.aplicado_em,
          },
        ]),
      );
    },
  });
  return q.data ?? {};
}

/** Erro do RPC → mensagem clara (22023 = já virou proposta; 42501 = sem acesso). */
export function mensagemErroAjuste(code: string | undefined, fallback: string): string {
  if (code === "22023")
    return "Esta cotação já virou proposta — não é mais possível ajustar as coberturas.";
  if (code === "42501") return "Você não tem permissão para ajustar esta cotação.";
  return fallback;
}

export function useSalvarAjusteSeguradora(cotacaoId: string | null) {
  const qc = useQueryClient();
  return async function salvar(
    seguradora: string,
    a: AjusteSeguradora,
  ): Promise<{ ok: true } | { ok: false; erro: string }> {
    if (!cotacaoId) return { ok: false, erro: "Salve a cotação antes de personalizar." };
    const { error } = await supabase.rpc("salvar_ajuste_seguradora", {
      p_cotacao_id: cotacaoId,
      p_seguradora: seguradora,
      // O gerador tipa os parâmetros como `string`, mas a função aceita null
      // (campo não ajustado).
      p_franquia_1: a.franquia1 as string,
      p_franquia_2: a.franquia2 as string,
      p_vidros: a.vidros as string,
      p_carro_reserva: a.carroReserva as string,
    });
    await qc.invalidateQueries({ queryKey: ajustesKey(cotacaoId) });
    if (error)
      return {
        ok: false,
        erro: mensagemErroAjuste(error.code, "Não foi possível salvar o ajuste."),
      };
    return { ok: true };
  };
}
