import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DOC_REFETCH_MS,
  estadoDocumentoProposta,
  type DocumentoLinha,
} from "@/lib/proposta-documento-estado";
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
        "cotacoes(numero,ramo,responsavel_id,segurado:cotacao_segurado(nome))",
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

/**
 * Documento (PDF) de TODAS as propostas da lista numa única query (em vez de
 * uma por linha — a lista chega a 200). A RLS de `proposta_documentos` já
 * escopa; só `proposta_pdf`. Refetch leve enquanto alguma ainda "prepara".
 */
export function useDocumentosEmissao(rows: PropostaEmissaoRow[]) {
  const ids = rows.map((r) => r.id).sort();
  return useQuery({
    queryKey: ["proposta-documentos-lote", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<Record<string, NonNullable<DocumentoLinha>>> => {
      // Em blocos de 100 ids: o `.in()` com 200 uuids passa de ~7 KB na URL e
      // chega perto do limite de cabeçalho do nginx.
      const blocos: string[][] = [];
      for (let i = 0; i < ids.length; i += 100) blocos.push(ids.slice(i, i + 100));
      const respostas = await Promise.all(
        blocos.map((bloco) =>
          supabase
            .from("proposta_documentos")
            .select("proposta_id, status, tentado_em, updated_at")
            .eq("tipo", "proposta_pdf")
            .in("proposta_id", bloco),
        ),
      );
      const linhas = respostas.flatMap((r) => {
        if (r.error) throw r.error;
        return r.data ?? [];
      });
      return Object.fromEntries(linhas.map((d) => [d.proposta_id, d]));
    },
    // Mantém o mapa anterior enquanto a lista muda, para o botão não piscar.
    placeholderData: keepPreviousData,
    refetchInterval: (q) =>
      q.state.data !== undefined &&
      rows.every(
        (r) =>
          estadoDocumentoProposta(q.state.data?.[r.id] ?? null, r.transmitida_em) !== "preparando",
      )
        ? false
        : DOC_REFETCH_MS,
  });
}
