import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PROPOSTA_SITUACAO_STATUSES } from "@/lib/proposta-situacao";
import type { PropostaEmissaoRow } from "./types";

/**
 * Consulta as propostas do PRÓPRIO vendedor já transmitidas, com sucesso ou
 * não (`falha`) — decisão do usuário: `/venda/emissao` é "minhas propostas",
 * mesmo padrão de `fetchSeguradoraAgenda` (`src/lib/agenda.ts`), não "a
 * empresa inteira". A RLS de `propostas` já libera a empresa toda; o
 * `.eq("responsavel_id", uid)` aqui é a semântica da tela, não a segurança.
 *
 * O front fica pronto para os demais status que a integração futura vai
 * devolver (`bloqueada`/`analise`/`emitida`/`recusada`), ver
 * `src/lib/proposta-situacao.ts`.
 */
export function fetchEmissaoRows(uid: string) {
  return supabase
    .from("propostas")
    .select(
      "id,numero,protocolo_seguradora,orcamento_cia,apolice_numero,seguradora,premio,valor," +
        "parcelas,valor_parcela,transmitida_em,emitida_em," +
        "transmissao_status,transmissao_motivo,transmissao_mensagem,cotacao_id," +
        "cotacoes(numero,ramo,segurado:cotacao_segurado(nome))",
    )
    .eq("responsavel_id", uid)
    .in("transmissao_status", PROPOSTA_SITUACAO_STATUSES)
    .order("transmitida_em", { ascending: false })
    .limit(200);
}

export function useEmissaoRows(uid: string | null) {
  return useQuery({
    queryKey: ["emissao-rows", uid],
    enabled: Boolean(uid),
    queryFn: async (): Promise<PropostaEmissaoRow[]> => {
      const { data, error } = await fetchEmissaoRows(uid as string);
      if (error) throw error;
      return (data ?? []) as unknown as PropostaEmissaoRow[];
    },
  });
}
