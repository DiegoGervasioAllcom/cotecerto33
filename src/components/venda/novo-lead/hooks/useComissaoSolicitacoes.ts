import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { ajustesKey, type AjusteGuardado } from "./useAjustesSeguradora";

export type ComissaoSolicitacao = {
  id: string;
  seguradora: string;
  comissaoPct: number;
  status: "pendente" | "aprovada" | "recusada" | "cancelada";
  motivoRecusa: string | null;
  criadoEm: string;
};

export const comissaoSolKey = (cotacaoId: string | null) =>
  ["comissao-solicitacoes", cotacaoId] as const;

const POLL_MS = 8000;

/**
 * Última solicitação de comissão abaixo de 20% por seguradora (chave canônica).
 * Faz polling leve enquanto houver pendente ou aprovada ainda sem cálculo
 * disparado; também refaz ao voltar o foco da janela. A RLS escopa.
 */
export function useComissaoSolicitacoes(
  cotacaoId: string | null,
  ajustes: Record<string, AjusteGuardado>,
) {
  const q = useQuery({
    queryKey: comissaoSolKey(cotacaoId),
    enabled: !!cotacaoId,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const lista = query.state.data ?? {};
      const ativo = Object.entries(lista).some(
        ([k, s]) =>
          s.status === "pendente" || (s.status === "aprovada" && ajustes[k]?.aplicadoEm == null),
      );
      return ativo ? POLL_MS : false;
    },
    queryFn: async (): Promise<Record<string, ComissaoSolicitacao>> => {
      const { data, error } = await supabase
        .from("comissao_solicitacoes")
        .select("id,seguradora,comissao_pct,status,motivo_recusa,criado_em")
        .eq("cotacao_id", cotacaoId ?? "")
        .order("criado_em", { ascending: true });
      if (error) throw new Error(error.message);
      const out: Record<string, ComissaoSolicitacao> = {};
      for (const r of data ?? []) {
        // ordem crescente: a última sobrescreve; canceladas não aparecem
        if (r.status === "cancelada") continue;
        out[nomeCanonicoSeguradora(r.seguradora)] = {
          id: r.id,
          seguradora: r.seguradora,
          comissaoPct: Number(r.comissao_pct),
          status: r.status as ComissaoSolicitacao["status"],
          motivoRecusa: r.motivo_recusa,
          criadoEm: r.criado_em,
        };
      }
      return out;
    },
  });
  return q.data ?? {};
}

/** Pede aprovação (RPC) para comissão abaixo de 20%. */
export function useSolicitarComissaoBaixa(cotacaoId: string | null) {
  const qc = useQueryClient();
  return async function solicitar(
    seguradora: string,
    pct: number,
  ): Promise<{ ok: true } | { ok: false; erro: string }> {
    if (!cotacaoId) return { ok: false, erro: "Salve a cotação antes de solicitar." };
    const { error } = await supabase.rpc("solicitar_comissao_baixa", {
      p_cotacao_id: cotacaoId,
      p_seguradora: nomeCanonicoSeguradora(seguradora),
      p_comissao_pct: pct,
    });
    await qc.invalidateQueries({ queryKey: comissaoSolKey(cotacaoId) });
    if (error) return { ok: false, erro: "Não foi possível solicitar a aprovação da comissão." };
    return { ok: true };
  };
}

export function useCancelarComissaoBaixa(cotacaoId: string | null) {
  const qc = useQueryClient();
  return async function cancelar(id: string): Promise<boolean> {
    const { error } = await supabase.rpc("cancelar_comissao_baixa", { p_id: id });
    await qc.invalidateQueries({ queryKey: comissaoSolKey(cotacaoId) });
    return !error;
  };
}

/**
 * O aprovador dispara o recálculo no servidor; o vendedor percebe pelo ajuste
 * (`aplicado_em` deixa de ser nulo) e só então retoma o acompanhamento do
 * resultado — sem precisar clicar em nada.
 */
export function useRetomarAoCalcularAprovada(
  cotacaoId: string | null,
  ajustes: Record<string, AjusteGuardado>,
  solicitacoes: Record<string, ComissaoSolicitacao>,
  retomar: () => void,
) {
  const qc = useQueryClient();
  const visto = useRef<Record<string, string | null>>({});
  useEffect(() => {
    for (const [k, s] of Object.entries(solicitacoes)) {
      if (s.status !== "aprovada") continue;
      const atual = ajustes[k]?.aplicadoEm ?? null;
      const antes = visto.current[k];
      visto.current[k] = atual;
      if (antes === null && atual !== null) {
        void qc.invalidateQueries({ queryKey: ajustesKey(cotacaoId) });
        retomar();
      }
    }
  }, [ajustes, solicitacoes, cotacaoId, qc, retomar]);
}
