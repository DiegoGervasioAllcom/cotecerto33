import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Premio } from "@/components/venda/cotacoes/lista-helpers";
import { AGUARDANDO_CALCULO_STATUSES, EM_NEGOCIACAO_STATUSES } from "@/lib/lead-etapa";

// Assim que um prêmio é selecionado no comparativo, o trigger
// _gerar_proposta_de_premio cria/atualiza uma `propostas` (status='gerada',
// transmissao_status ainda null) e vira a cotação para status='proposta' —
// ela continua aqui até a Etapa 7 transmitir com sucesso (ela não some desta
// lista sozinha; ver nota em em-finalizacao.tsx sobre esse gap). Por isso a
// negociação de versão/prazo/aceite da proposta (G7.2) mora aqui, e não em
// Emissão & histórico (que só lista propostas já transmitidas).
export type PropostaLigada = {
  id: string;
  numero: string | null;
  seguradora: string | null;
  premio: number | null;
  valor: number | null;
  negociacao_status: string;
  prazo_resposta: string | null;
  transmissao_status: string | null;
};

/** Linha de `cotacoes` comum às duas listas de "Em negociação" (V12.3.4). */
type CotacaoBase = {
  id: string;
  numero: number;
  status: string;
  ramo: string;
  criado_em: string;
  atualizado_em: string;
  segurado: { nome: string | null } | null;
  veiculo: {
    marca_nome: string | null;
    modelo_nome: string | null;
    ano_modelo: string | null;
  } | null;
};

/** Linha da lista "Cotação finalizada" (`EM_NEGOCIACAO_STATUSES`). */
export type CotacaoFinalizadaRow = CotacaoBase & {
  calculo_visto_em: string | null;
  premios: Premio[];
  propostas: PropostaLigada[] | null;
  // Usados só pelo modal "Imprimir cotação" (Frente 3 V12 · 7a) — a lista em
  // si continua mostrando apenas `premios` (seguradora + prêmio).
  quiver_resultado_raw: unknown;
};

/** Linha da lista "Aguardando cotação" (`AGUARDANDO_CALCULO_STATUSES`). */
export type AguardandoCotacaoRow = CotacaoBase & {
  quiver_enviado_em: string | null;
  quiver_mensagem: string | null;
};

export const COTACAO_FINALIZADA_QUERY_KEY = ["em-negociacao", "finalizada"] as const;
export const AGUARDANDO_COTACAO_QUERY_KEY = ["em-negociacao", "aguardando"] as const;

/**
 * Consulta as cotações "Cotação finalizada" (status "calculada" ou
 * "proposta") do PRÓPRIO vendedor exibidas nesta tela — mesma decisão de
 * escopo de `fetchEmissaoRows`/`fetchSeguradoraAgenda`: "Em negociação" é
 * "minhas cotações", não a empresa inteira. A RLS de `cotacoes` já libera a
 * empresa toda pra quem tem esse escopo; o `.eq("responsavel_id", uid)`
 * aqui é a semântica da tela, não a segurança.
 */
export function fetchCotacaoFinalizadaRows(uid: string) {
  return supabase
    .from("cotacoes")
    .select(
      "id,numero,status,ramo,criado_em,atualizado_em,calculo_visto_em,quiver_resultado_raw," +
        "segurado:cotacao_segurado(nome)," +
        "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)," +
        "premios:cotacao_premios(seguradora,premio)," +
        "propostas(id,numero,seguradora,premio,valor,negociacao_status,prazo_resposta,transmissao_status)",
    )
    .eq("responsavel_id", uid)
    .in("status", EM_NEGOCIACAO_STATUSES)
    .order("atualizado_em", { ascending: false })
    .limit(200);
}

/**
 * Consulta as cotações "Aguardando cotação" (status "enviada_quiver" ou
 * "erro_quiver") do próprio vendedor — ainda sem preço final para oferecer
 * ao cliente.
 */
export function fetchAguardandoCotacaoRows(uid: string) {
  return supabase
    .from("cotacoes")
    .select(
      "id,numero,status,ramo,criado_em,atualizado_em,quiver_enviado_em,quiver_mensagem," +
        "segurado:cotacao_segurado(nome)," +
        "veiculo:cotacao_veiculo(marca_nome,modelo_nome,ano_modelo)",
    )
    .eq("responsavel_id", uid)
    .in("status", AGUARDANDO_CALCULO_STATUSES)
    .order("atualizado_em", { ascending: false })
    .limit(200);
}

export function useCotacaoFinalizadaRows(uid: string | null) {
  return useQuery({
    queryKey: [...COTACAO_FINALIZADA_QUERY_KEY, uid],
    enabled: Boolean(uid),
    queryFn: async (): Promise<CotacaoFinalizadaRow[]> => {
      const { data, error } = await fetchCotacaoFinalizadaRows(uid as string);
      if (error) throw error;
      return (data ?? []) as unknown as CotacaoFinalizadaRow[];
    },
  });
}

export function useAguardandoCotacaoRows(uid: string | null) {
  return useQuery({
    queryKey: [...AGUARDANDO_COTACAO_QUERY_KEY, uid],
    enabled: Boolean(uid),
    queryFn: async (): Promise<AguardandoCotacaoRow[]> => {
      const { data, error } = await fetchAguardandoCotacaoRows(uid as string);
      if (error) throw error;
      return (data ?? []) as unknown as AguardandoCotacaoRow[];
    },
  });
}
