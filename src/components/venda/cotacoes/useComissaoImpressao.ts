// % efetivo da corretora para o documento interno (fatia B). O servidor
// decide o acesso (`rpc_comissao_para_impressao`): NULL = sem % cadastrado,
// 42501 = fora do escopo. O front só reage.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ComissaoImpressao =
  | { estado: "carregando" }
  | { estado: "disponivel"; pct: number }
  | { estado: "sem_pct" }
  | { estado: "sem_permissao" }
  | { estado: "erro" };

export function useComissaoImpressao(cotacaoId: string | undefined, ativo: boolean) {
  const q = useQuery({
    queryKey: ["comissao-impressao", cotacaoId],
    enabled: ativo && !!cotacaoId,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<ComissaoImpressao> => {
      const { data, error } = await supabase.rpc("rpc_comissao_para_impressao", {
        p_cotacao_id: cotacaoId as string,
      });
      if (error) return error.code === "42501" ? { estado: "sem_permissao" } : { estado: "erro" };
      const pct = data as number | null;
      return pct == null ? { estado: "sem_pct" } : { estado: "disponivel", pct: Number(pct) };
    },
  });
  if (!cotacaoId) return { estado: "sem_permissao" } as ComissaoImpressao;
  if (q.isPending) return { estado: "carregando" } as ComissaoImpressao;
  return q.data ?? ({ estado: "erro" } as ComissaoImpressao);
}
