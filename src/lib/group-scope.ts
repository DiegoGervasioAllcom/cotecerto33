import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Grupo de gestão ativo (espelha `activeGroup()` do protótipo V10).
 * Não é usado para segurança — o RLS (`empresas_visiveis` multinível)
 * já garante o escopo de dados. Aqui só derivamos rótulo + % de exibição.
 */
export type ActiveGroup = "MASTER" | "SUPERVISOR" | "FRANQUEADO" | null;

export interface GroupScope {
  /** true enquanto ainda resolvemos o modelo de franquia (perfil franquia). */
  loading: boolean;
  /** Grupo de gestão ativo, ou null para vendedor/matriz. */
  group: ActiveGroup;
  /** % de exibição sobre a equipe (não é o cálculo de comissão real — isso é o G4). */
  groupPct: number;
  /** true para master, supervisor e franquia Full (as 12 telas de grupo). */
  isGroupView: boolean;
  /** true quando o perfil é `franquia` e o modelo contratado é Individual (não Full). */
  isFranqIndividual: boolean;
}

/**
 * Detecta se a franquia do usuário é do modelo "Full" pelo nome do modelo
 * (`modelos_franquia.nome` contém "full", case-insensitive).
 *
 * Convenção interina usada também em G1.4/G1.5 (classificar-acesso-modal.tsx),
 * até o G2.1 introduzir uma flag explícita no schema.
 */
export function useGroupScope(): GroupScope {
  const { role, profile, empresa } = useAuth();
  const [isFranqFull, setIsFranqFull] = useState(false);
  const [loading, setLoading] = useState(role === "franqueado");

  useEffect(() => {
    let active = true;

    if (role !== "franqueado") {
      setIsFranqFull(false);
      setLoading(false);
      return;
    }

    if (!empresa?.modelo_id) {
      setIsFranqFull(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    supabase
      .from("modelos_franquia")
      .select("nome")
      .eq("id", empresa.modelo_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setIsFranqFull((data?.nome ?? "").toLowerCase().includes("full"));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role, empresa?.modelo_id]);

  const isFranqIndividual = role === "franqueado" && !isFranqFull;
  const isGroupView =
    role === "master" || role === "supervisor" || (role === "franqueado" && isFranqFull);

  let group: ActiveGroup = null;
  let groupPct = 0;
  if (role === "master") {
    group = "MASTER";
    groupPct = 20;
  } else if (role === "supervisor") {
    group = "SUPERVISOR";
    groupPct = profile?.comissao_modelo ?? 0;
  } else if (role === "franqueado" && isFranqFull) {
    group = "FRANQUEADO";
    groupPct = 0;
  }

  return { loading, group, groupPct, isGroupView, isFranqIndividual };
}
