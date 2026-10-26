import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cotNum } from "@/components/venda/cotacoes/lista-helpers";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/database.types";

type CotacaoStatus = Database["public"]["Enums"]["cotacao_status"];

export type CotacaoRecente = {
  id: string;
  numero: number;
  ramo: string;
  status: CotacaoStatus;
  criado_em: string;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
    placa: string | null;
  } | null;
};

export const COTACOES_RECENTES_QUERY_KEY = ["cotacoes", "recentes"] as const;

/**
 * Cotações mais recentes visíveis ao usuário. Sem filtro de perfil/dono no
 * front — quem decide o escopo é a RLS de `cotacoes`. `status` vazio = todos.
 * `busca` filtra (no cliente, sobre as `limite` linhas) por nº, segurado, modelo ou placa.
 */
export function useCotacoesRecentes(
  busca: string,
  status: readonly CotacaoStatus[] = [],
  limite = 50,
) {
  const chaveStatus = status.join(",");
  const query = useQuery({
    queryKey: [...COTACOES_RECENTES_QUERY_KEY, chaveStatus, limite],
    queryFn: async (): Promise<CotacaoRecente[]> => {
      let q = supabase
        .from("cotacoes")
        .select(
          "id,numero,ramo,status,criado_em,atualizado_em," +
            "segurado:cotacao_segurado(nome)," +
            "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo,placa)",
        )
        .order("atualizado_em", { ascending: false })
        .limit(limite);
      if (status.length > 0) q = q.in("status", [...status]);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CotacaoRecente[];
    },
  });

  const rows = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todas = query.data ?? [];
    if (!termo) return todas;
    return todas.filter((r) =>
      `${cotNum(r.numero, r.criado_em)} ${r.segurado?.nome ?? ""} ${r.veiculo?.modelo_nome ?? ""} ${r.veiculo?.placa ?? ""}`
        .toLowerCase()
        .includes(termo),
    );
  }, [query.data, busca]);

  return { ...query, rows };
}
