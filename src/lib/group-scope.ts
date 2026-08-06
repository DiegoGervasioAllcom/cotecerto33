import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Grupo de gestão ativo (espelha `activeGroup()` do protótipo V10).
 * Não é usado para segurança — o RLS (`empresas_visiveis` multinível)
 * já garante o escopo de dados. Aqui só derivamos rótulo + % de exibição.
 */
export type ActiveGroup = "MASTER" | "FRANQUEADO" | null;

export interface GroupScope {
  /** true enquanto ainda resolvemos o modelo de franquia (perfil franquia). */
  loading: boolean;
  /** Grupo de gestão ativo, ou null para vendedor/matriz. */
  group: ActiveGroup;
  /** % de exibição sobre a equipe (não é o cálculo de comissão real — isso é o G4). */
  groupPct: number;
  /** true para master e franquia Full (as 12 telas de grupo). */
  isGroupView: boolean;
  /** true quando o perfil é `franquia` e o modelo contratado é Individual (não Full). */
  isFranqIndividual: boolean;
  /**
   * true quando o perfil é `franqueado` e o modelo contratado é Full — a
   * "matrizinha" (V11 · Frente 5). Usado pelo `app-shell` para trocar a nav de
   * grupo (12 itens, igual ao Master) pelo espelho da Matriz (V11.5.2a).
   */
  isFranqFull: boolean;
}

interface ResolvedFranchiseModel {
  modeloId: string;
  isFull: boolean;
}

export function deriveFranchiseScope(input: {
  role: ReturnType<typeof useAuth>["role"];
  modeloId: string | null | undefined;
  resolvedModel: ResolvedFranchiseModel | null;
}): Pick<GroupScope, "loading" | "isFranqFull" | "isFranqIndividual"> {
  if (input.role !== "franqueado") {
    return { loading: false, isFranqFull: false, isFranqIndividual: false };
  }

  // Franquias sem modelo contratado são Individual por definição. Quando há
  // modelo, o resultado só é válido se pertencer exatamente ao modelo atual.
  // Isso torna a pendência síncrona também nas trocas de perfil/empresa.
  if (!input.modeloId) {
    return { loading: false, isFranqFull: false, isFranqIndividual: true };
  }

  if (input.resolvedModel?.modeloId !== input.modeloId) {
    return { loading: true, isFranqFull: false, isFranqIndividual: false };
  }

  return {
    loading: false,
    isFranqFull: input.resolvedModel.isFull,
    isFranqIndividual: !input.resolvedModel.isFull,
  };
}

/**
 * Detecta se a franquia do usuário é do modelo "Full" pela coluna
 * `modelos_franquia.modalidade` ('individual' | 'full'; NULL para modelos
 * CLT, tratado como 'individual' — não Full).
 */
export function useGroupScope(): GroupScope {
  const { role, empresa } = useAuth();
  const [resolvedModel, setResolvedModel] = useState<ResolvedFranchiseModel | null>(null);
  const modeloId = empresa?.modelo_id;

  useEffect(() => {
    let active = true;

    if (role !== "franqueado") {
      return;
    }

    if (!modeloId) {
      return;
    }

    supabase
      .from("modelos_franquia")
      .select("modalidade")
      .eq("id", modeloId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setResolvedModel({ modeloId, isFull: data?.modalidade === "full" });
      });

    return () => {
      active = false;
    };
  }, [role, modeloId]);

  const { loading, isFranqFull, isFranqIndividual } = deriveFranchiseScope({
    role,
    modeloId,
    resolvedModel,
  });
  // `supervisor` hoje é sempre um dos 3 cargos internos da Matriz (H1-H8:
  // Vendas/Operacional/Backoffice) — nenhum tem franquia supervisionada nem
  // comissão de grupo. O conceito antigo de "Supervisor de rede" (protótipo)
  // não existe mais em nenhuma policy RLS (ver docs/ANALISE_LACUNAS_V11.md).
  // Excluído aqui para bater com `nav-experience.ts` (`grpLike` já exclui
  // `role === "supervisor"`) — sem essa exclusão, a Visão geral e a página
  // de equipe mostravam "Franquias supervisionadas"/"Comissão do grupo" para
  // quem não supervisiona franquia nenhuma.
  const isGroupView = role === "master" || (role === "franqueado" && isFranqFull);

  let group: ActiveGroup = null;
  let groupPct = 0;
  if (role === "master") {
    group = "MASTER";
    groupPct = 20;
  } else if (role === "franqueado" && isFranqFull) {
    group = "FRANQUEADO";
    groupPct = 0;
  }

  return { loading, group, groupPct, isGroupView, isFranqIndividual, isFranqFull };
}
