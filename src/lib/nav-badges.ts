import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Perfil } from "@/integrations/supabase/client";
import { limiteRiscoISO } from "@/lib/agenda";

export const ATENDER_AGORA_QUERY_KEY = ["leads", "atender-agora"] as const;
export const AGENDA_BADGE_QUERY_KEY = ["nav-badges", "agenda"] as const;
export const EM_COTACAO_BADGE_QUERY_KEY = ["nav-badges", "em-cotacao"] as const;
export const EM_NEGOCIACAO_BADGE_QUERY_KEY = ["nav-badges", "em-negociacao"] as const;
export const EM_FINALIZACAO_BADGE_QUERY_KEY = ["nav-badges", "em-finalizacao"] as const;

export type AtenderAgoraLead = {
  id: string;
  nome: string;
  contato: string | null;
  origem: string | null;
  valor: number | null;
  criado_em: string;
  distribuido_em: string | null;
  dados: Record<string, unknown> | null;
  bloqueado: boolean | null;
};

/** Fila canônica de reação do vendedor. RLS mantém o escopo além deste filtro visual. */
export async function fetchAtenderAgoraLeads(userId: string): Promise<AtenderAgoraLead[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id,nome,contato,origem,valor,criado_em,distribuido_em,dados,bloqueado")
    .eq("responsavel_id", userId)
    .eq("status_pipeline", "novo")
    .eq("arquivado", false)
    .is("ultimo_atendimento_em", null)
    .order("distribuido_em", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data.map((lead) => ({
    ...lead,
    dados:
      typeof lead.dados === "object" && lead.dados !== null && !Array.isArray(lead.dados)
        ? (lead.dados as Record<string, unknown>)
        : null,
  }));
}

/** Contagem de leads aguardando distribuição (mesmo critério de comando/leads.tsx). */
async function countLeadsPendentes(): Promise<number> {
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .is("empresa_id", null)
    .is("responsavel_id", null)
    .is("distribuido_em", null)
    .eq("status_pipeline", "novo")
    .eq("arquivado", false);
  return count ?? 0;
}

/** `criado_em` do lead não distribuído mais antigo (para a pílula "Distribuir agora"). */
async function oldestLeadPendenteCriadoEm(): Promise<string | null> {
  const { data } = await supabase
    .from("leads")
    .select("criado_em")
    .is("empresa_id", null)
    .is("responsavel_id", null)
    .is("distribuido_em", null)
    .eq("status_pipeline", "novo")
    .eq("arquivado", false)
    .order("criado_em", { ascending: true })
    .limit(1);
  return data?.[0]?.criado_em ?? null;
}

/** Contagem de solicitações de desconto pendentes para o usuário logado decidir. */
async function countAprovacoesPendentes(role: Perfil | null): Promise<number> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id ?? null;
  let query = supabase
    .from("desconto_solicitacoes")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  if (role === "matriz") {
    query = query.is("nivel_atual", null);
  } else if (uid) {
    query = query.eq("nivel_atual", uid);
  } else {
    return 0;
  }
  const { count } = await query;
  return count ?? 0;
}

/**
 * Contagem de itens pendentes de "Minha agenda" (Frente 9 · V12): soma as 3
 * fontes reais da tela (`src/lib/agenda.ts`) — retornos agendados, negócios
 * em risco e lembretes pessoais — sem montar as linhas inteiras, só o total
 * usado no badge do menu.
 */
async function countAgendaPendente(userId: string): Promise<number> {
  const [retornos, risco, lembretes] = await Promise.all([
    supabase
      .from("lead_agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("done", false)
      .eq("criado_por", userId),
    supabase
      .from("cotacoes")
      .select("id", { count: "exact", head: true })
      .in("status", ["calculada", "proposta"])
      .lt("atualizado_em", limiteRiscoISO()),
    supabase.from("lembretes").select("id", { count: "exact", head: true }).eq("done", false),
  ]);
  return (retornos.count ?? 0) + (risco.count ?? 0) + (lembretes.count ?? 0);
}

/** Contagem de cotações em preenchimento (mesmo filtro de em-cotacao.tsx). */
async function countEmCotacaoPendente(): Promise<number> {
  const { count } = await supabase
    .from("cotacoes")
    .select("id", { count: "exact", head: true })
    .eq("status", "rascunho");
  return count ?? 0;
}

/** Contagem de cotações em negociação (mesmo filtro de em-negociacao.tsx). */
async function countEmNegociacaoPendente(): Promise<number> {
  const { count } = await supabase
    .from("cotacoes")
    .select("id", { count: "exact", head: true })
    .in("status", ["calculada", "proposta"]);
  return count ?? 0;
}

/**
 * Contagem de tentativas de transmissão em aberto (mesmo filtro de
 * em-finalizacao.tsx), deduplicadas por `cotacao_id` — uma cotação pode ter
 * várias tentativas por retransmissão após falha, só a mais recente conta.
 * A dedupe acontece em memória sobre as últimas 500 tentativas (mesmo limite
 * da tela); se algum dia existirem mais de 500 tentativas simultâneas em
 * aberto, o número pode ficar levemente subcontado — limitação aceita, igual
 * à da própria lista.
 */
async function countEmFinalizacaoPendente(): Promise<number> {
  const { data, error } = await supabase
    .from("cotacao_transmissoes")
    .select("cotacao_id")
    .in("status", ["enviada", "falha"])
    .order("criado_em", { ascending: false })
    .limit(500);
  if (error) throw error;
  const vistos = new Set<string>();
  for (const t of data ?? []) vistos.add(t.cotacao_id);
  return vistos.size;
}

/** Formata um intervalo em segundos como "Xh Ym" ou "Xm Ys". */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

type NavBadges = {
  leadsPendentes: number | null;
  aprovacoesPendentes: number | null;
  leadMaisAntigoElapsed: string | null;
  atenderAgora: AtenderAgoraLead[] | null;
  atenderAgoraErro: string | null;
  /** Badges do menu de venda (V12 · Frente 9) — só populam com `verVenda`. */
  agendaPendentes: number | null;
  emCotacaoPendentes: number | null;
  emNegociacaoPendentes: number | null;
  emFinalizacaoPendentes: number | null;
};

/**
 * Contagens reais usadas na nav lateral e na pílula "Distribuir agora" do topbar.
 * Só dispara as queries quando fizer sentido para o perfil (nada de query
 * desnecessária pra vendedor / franquia individual).
 */
export function useNavBadges({
  isMatriz,
  verLeads,
  verAprovacoes,
  verAtenderAgora,
  verVenda,
  userId,
}: {
  /**
   * Só para a contagem de aprovações: a Matriz decide o que está com
   * `nivel_atual` nulo (topo da cadeia); todos os outros aprovadores decidem o
   * que está com `nivel_atual` = eles.
   */
  isMatriz: boolean;
  /** Tem a área de Leads (V11: matriz, coordenador, operacional, backoffice, marketing). */
  verLeads: boolean;
  /** É aprovador na cadeia de desconto (tem a área de Aprovações). */
  verAprovacoes: boolean;
  /** Apenas vendedor e Franquia Individual. */
  verAtenderAgora: boolean;
  /**
   * Apenas vendedor e Franquia Individual (mesmo escopo de `verAtenderAgora`)
   * — habilita os 4 badges do menu de venda (agenda, em cotação, em
   * negociação, em finalização) criados na Frente 9 · V12.
   */
  verVenda: boolean;
  userId: string | null;
}): NavBadges {
  const [leadsPendentes, setLeadsPendentes] = useState<number | null>(null);
  const [leadMaisAntigoElapsed, setLeadMaisAntigoElapsed] = useState<string | null>(null);
  const [aprovacoesPendentes, setAprovacoesPendentes] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const atenderQuery = useQuery({
    queryKey: [...ATENDER_AGORA_QUERY_KEY, userId],
    queryFn: () => fetchAtenderAgoraLeads(userId!),
    enabled: verAtenderAgora && !!userId,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const agendaQuery = useQuery({
    queryKey: [...AGENDA_BADGE_QUERY_KEY, userId],
    queryFn: () => countAgendaPendente(userId!),
    enabled: verVenda && !!userId,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const emCotacaoQuery = useQuery({
    queryKey: EM_COTACAO_BADGE_QUERY_KEY,
    queryFn: countEmCotacaoPendente,
    enabled: verVenda,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const emNegociacaoQuery = useQuery({
    queryKey: EM_NEGOCIACAO_BADGE_QUERY_KEY,
    queryFn: countEmNegociacaoPendente,
    enabled: verVenda,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const emFinalizacaoQuery = useQuery({
    queryKey: EM_FINALIZACAO_BADGE_QUERY_KEY,
    queryFn: countEmFinalizacaoPendente,
    enabled: verVenda,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!verAtenderAgora || !userId) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ATENDER_AGORA_QUERY_KEY });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    const channel = supabase
      .channel(`nav-atender-agora-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, invalidate)
      .subscribe();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId, verAtenderAgora]);

  useEffect(() => {
    if (!verLeads) {
      setLeadsPendentes(null);
      setLeadMaisAntigoElapsed(null);
      return;
    }
    let cancelled = false;
    countLeadsPendentes().then((n) => {
      if (!cancelled) setLeadsPendentes(n);
    });
    oldestLeadPendenteCriadoEm().then((criadoEm) => {
      if (cancelled) return;
      if (!criadoEm) {
        setLeadMaisAntigoElapsed(null);
        return;
      }
      const seconds = (Date.now() - new Date(criadoEm).getTime()) / 1000;
      setLeadMaisAntigoElapsed(formatElapsed(seconds));
    });
    return () => {
      cancelled = true;
    };
  }, [verLeads]);

  useEffect(() => {
    if (!verAprovacoes) {
      setAprovacoesPendentes(null);
      return;
    }
    let cancelled = false;
    countAprovacoesPendentes(isMatriz ? "matriz" : null).then((n) => {
      if (!cancelled) setAprovacoesPendentes(n);
    });
    return () => {
      cancelled = true;
    };
  }, [isMatriz, verAprovacoes]);

  return {
    leadsPendentes,
    aprovacoesPendentes,
    leadMaisAntigoElapsed,
    atenderAgora: verAtenderAgora && userId ? (atenderQuery.data ?? null) : null,
    atenderAgoraErro: atenderQuery.error instanceof Error ? atenderQuery.error.message : null,
    agendaPendentes: verVenda && userId ? (agendaQuery.data ?? null) : null,
    emCotacaoPendentes: verVenda ? (emCotacaoQuery.data ?? null) : null,
    emNegociacaoPendentes: verVenda ? (emNegociacaoQuery.data ?? null) : null,
    emFinalizacaoPendentes: verVenda ? (emFinalizacaoQuery.data ?? null) : null,
  };
}
