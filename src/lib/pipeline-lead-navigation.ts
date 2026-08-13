import { supabase } from "@/integrations/supabase/client";

const WIZARD_STATUSES = new Set(["novo", "contato", "qualificado", "cotacao"]);
const PROPOSAL_STATUSES = new Set(["proposta", "negociacao", "ganho"]);

export type ExistingLeadDestination =
  | { kind: "wizard"; id: string; step: number }
  | { kind: "proposals"; selected?: string }
  | { kind: "acceptance"; selected?: string }
  | { kind: "unavailable"; message: string };

/** Estados legado e atual compartilham a mesma coluna visual "Qualificando". */
export function pipelineColumnKey(status: string): string {
  return status === "qualificado" ? "contato" : status;
}

export async function resolveExistingLeadDestination({
  leadId,
  status,
  canAssume,
}: {
  leadId: string;
  status: string;
  canAssume: boolean;
}): Promise<ExistingLeadDestination> {
  if (WIZARD_STATUSES.has(status)) {
    const { data: cotacao, error } = await supabase
      .from("cotacoes")
      .select("id,step_atual")
      .eq("lead_id", leadId)
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (cotacao?.id) {
      return {
        kind: "wizard",
        id: cotacao.id,
        step: Math.max(0, Number(cotacao.step_atual ?? 0)),
      };
    }

    if (canAssume) {
      const { data: cotacaoId, error: assumirError } = await supabase.rpc("assumir_lead", {
        p_lead_id: leadId,
      });
      if (assumirError) throw assumirError;
      if (cotacaoId) return { kind: "wizard", id: cotacaoId, step: 0 };
    }

    return {
      kind: "unavailable",
      message: "Este lead ainda não possui cotação. Abra-o pelo perfil do vendedor responsável.",
    };
  }

  if (PROPOSAL_STATUSES.has(status)) {
    const { data: proposta, error } = await supabase
      .from("propostas")
      .select("id")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const selected = proposta?.id;
    return status === "ganho" ? { kind: "acceptance", selected } : { kind: "proposals", selected };
  }

  return {
    kind: "unavailable",
    message: "Este lead não possui uma tela de atendimento disponível neste estágio.",
  };
}
