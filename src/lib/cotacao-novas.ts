import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * "Cotação finalizada" que o vendedor ainda não viu (V12.3.4 — aviso
 * `cotecerto_prototipo_v12.html` · `cotNovas()`/`avisoCotacao()`): status
 * `calculada` (só ela — `proposta` nunca é "nova", o vendedor já negociou)
 * com `calculo_visto_em` ainda nulo, do próprio vendedor logado. Alimenta o
 * cartão `.aviso-card` (`CotacaoFinalizadaAviso`) e o `badge novo` pulsando
 * do item de menu "Em negociação".
 */
export type CotacaoNova = {
  id: string;
  numero: number;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
  } | null;
};

export const COTACOES_NOVAS_QUERY_KEY = ["cotacoes-novas"] as const;

/**
 * O protótipo dispara o aviso no instante em que a última seguradora
 * responde (evento). Sem realtime aqui — decisão do usuário: poll de
 * 20-30s é suficiente (o vendedor não perde a janela de "preço fresco" por
 * uma diferença de segundos), sem o custo de manter um canal aberto.
 */
export const COTACOES_NOVAS_POLL_MS = 25_000;

export function fetchCotacoesNovas(uid: string) {
  return supabase
    .from("cotacoes")
    .select(
      "id,numero,atualizado_em," +
        "segurado:cotacao_segurado(nome)," +
        "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)",
    )
    .eq("responsavel_id", uid)
    .eq("status", "calculada")
    .is("calculo_visto_em", null)
    .order("atualizado_em", { ascending: false })
    .limit(20);
}

export function useCotacoesNovas(uid: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...COTACOES_NOVAS_QUERY_KEY, uid],
    enabled: enabled && !!uid,
    queryFn: async (): Promise<CotacaoNova[]> => {
      const { data, error } = await fetchCotacoesNovas(uid as string);
      if (error) throw error;
      return (data ?? []) as unknown as CotacaoNova[];
    },
    refetchInterval: COTACOES_NOVAS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/**
 * Marca UMA cotação como vista (aviso dispensado ou "Abrir cálculo" a
 * partir do cartão global) — filtra por `responsavel_id` e `status` além do
 * `id` por defesa em profundidade (a policy `cot_iud` já barra outro dono,
 * isso só evita marcar vista uma cotação que não é mais `calculada`, ex.:
 * uma corrida entre o poll e o robô da Quiver reenviando o cálculo).
 */
export async function marcarCotacaoVista(id: string, uid: string) {
  const { error } = await supabase
    .from("cotacoes")
    .update({ calculo_visto_em: new Date().toISOString() })
    .eq("id", id)
    .eq("responsavel_id", uid)
    .eq("status", "calculada")
    .is("calculo_visto_em", null);
  if (error) throw error;
}

/**
 * Marca TODAS as cotações calculadas do vendedor ainda sem
 * `calculo_visto_em` de uma vez — disparado ao abrir `/venda/em-negociacao`
 * (espelha `cotNovas().forEach(l => cotSt(l).visto=true)` do protótipo).
 */
export async function marcarCotacoesVistas(uid: string) {
  const { error } = await supabase
    .from("cotacoes")
    .update({ calculo_visto_em: new Date().toISOString() })
    .eq("responsavel_id", uid)
    .eq("status", "calculada")
    .is("calculo_visto_em", null);
  if (error) throw error;
}

/** Invalida a query de "cotações novas" (badge + aviso) após marcar vista(s). */
export function useInvalidateCotacoesNovas() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: COTACOES_NOVAS_QUERY_KEY });
}
