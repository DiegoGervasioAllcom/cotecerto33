import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Perfil } from "@/integrations/supabase/client";

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
};

/**
 * Contagens reais usadas na nav lateral e na pílula "Distribuir agora" do topbar.
 * Só dispara as queries quando fizer sentido para o perfil (nada de query
 * desnecessária pra vendedor / franquia individual).
 */
export function useNavBadges({
  isMatriz,
  grpLike,
}: {
  isMatriz: boolean;
  grpLike: boolean;
}): NavBadges {
  const [leadsPendentes, setLeadsPendentes] = useState<number | null>(null);
  const [leadMaisAntigoElapsed, setLeadMaisAntigoElapsed] = useState<string | null>(null);
  const [aprovacoesPendentes, setAprovacoesPendentes] = useState<number | null>(null);

  useEffect(() => {
    if (!isMatriz) {
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
  }, [isMatriz]);

  useEffect(() => {
    if (!isMatriz && !grpLike) {
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
  }, [isMatriz, grpLike]);

  return { leadsPendentes, aprovacoesPendentes, leadMaisAntigoElapsed };
}
