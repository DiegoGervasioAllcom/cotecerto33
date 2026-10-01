import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PropostaCompleta = {
  id: string;
  numero: string | null;
  protocolo_seguradora: string | null;
  orcamento_cia: string | null;
  apolice_numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  parcelas: number | null;
  valor_parcela: number | null;
  forma_pagamento: string | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  vigencia_aceita: string | null;
  transmitida_em: string | null;
  transmissao_status: string | null;
  cotacao_id: string | null;
  cotacoes: {
    numero: number | null;
    responsavel_id: string | null;
    // 1:1 (`cotacao_id` é PK) — o PostgREST devolve objeto, não array.
    segurado: { nome: string | null } | null;
  } | null;
};

/**
 * Busca a proposta transmitida do card "Transmitida" (`TransmissaoResultado`)
 * com os campos que a integração futura vai preencher (protocolo, orçamento
 * na cia, apólice) — hoje só `transmitida`/`falha` chegam preenchidos, o
 * resto fica "—" via `src/lib/proposta-situacao.ts`. Mesma seleção de
 * `fetchEmissaoRows` (`emissao.tsx`), sem duplicar a lógica de agrupamento.
 */
export function useProposta(propostaId: string | null) {
  return useQuery({
    queryKey: ["proposta-transmitida", propostaId],
    enabled: Boolean(propostaId),
    queryFn: async (): Promise<PropostaCompleta> => {
      const { data, error } = await supabase
        .from("propostas")
        .select(
          "id,numero,protocolo_seguradora,orcamento_cia,apolice_numero,seguradora,premio,valor," +
            "parcelas,valor_parcela,forma_pagamento,vigencia_inicio,vigencia_fim,vigencia_aceita," +
            "transmitida_em,transmissao_status,cotacao_id," +
            "cotacoes(numero,responsavel_id,segurado:cotacao_segurado(nome))",
        )
        .eq("id", propostaId as string)
        .single();
      if (error) throw error;
      return data as unknown as PropostaCompleta;
    },
  });
}
