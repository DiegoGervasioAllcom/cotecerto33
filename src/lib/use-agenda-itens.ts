// Hook compartilhado das 3 fontes da agenda unificada (Frente 9/V12):
// retornos agendados, negócios em risco e lembretes pessoais.
// Extraído de `venda/agenda.tsx` (V12.3.1) para ser reutilizado também pelo
// cartão "O que fazer agora" do Início (`selecionarFilaHome` em
// `@/lib/agenda`) — mesma query, mesmas ações (marcar feito / abrir item).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchLembretesAgenda,
  fetchRetornosAgenda,
  fetchRiscoAgenda,
  montarAgenda,
  type AgendaItem,
} from "@/lib/agenda";
import { resolveExistingLeadDestination } from "@/lib/pipeline-lead-navigation";

const QK_RETORNOS = ["agenda", "retornos"] as const;
const QK_RISCO = ["agenda", "risco"] as const;
const QK_LEMBRETES = ["agenda", "lembretes"] as const;

export function useAgendaItens() {
  const { session } = useAuth();
  const uid = session?.user.id ?? null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const retornosQuery = useQuery({
    queryKey: [...QK_RETORNOS, uid],
    queryFn: () => fetchRetornosAgenda(uid!),
    enabled: !!uid,
  });
  const riscoQuery = useQuery({ queryKey: QK_RISCO, queryFn: () => fetchRiscoAgenda() });
  const lembretesQuery = useQuery({ queryKey: QK_LEMBRETES, queryFn: fetchLembretesAgenda });

  const loading =
    !uid || retornosQuery.isPending || riscoQuery.isPending || lembretesQuery.isPending;
  const queryErr =
    (retornosQuery.error instanceof Error ? retornosQuery.error.message : null) ??
    (riscoQuery.error instanceof Error ? riscoQuery.error.message : null) ??
    (lembretesQuery.error instanceof Error ? lembretesQuery.error.message : null);

  const itens = useMemo(
    () => montarAgenda(retornosQuery.data ?? [], riscoQuery.data ?? [], lembretesQuery.data ?? []),
    [retornosQuery.data, riscoQuery.data, lembretesQuery.data],
  );

  function invalidarTudo() {
    void queryClient.invalidateQueries({ queryKey: QK_RETORNOS });
    void queryClient.invalidateQueries({ queryKey: QK_LEMBRETES });
  }

  async function marcarFeito(item: AgendaItem) {
    const [, rawId] = item.id.split(":");
    if (!rawId) return;
    setErr(null);
    setBusyId(item.id);
    const tabela = item.fonte === "retorno" ? "lead_agendamentos" : "lembretes";
    const { error } = await supabase.from(tabela).update({ done: true }).eq("id", rawId);
    setBusyId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    invalidarTudo();
  }

  async function abrirItem(item: AgendaItem) {
    if (abrindo) return;
    setErr(null);
    if (item.fonte === "risco") {
      if (item.cotacaoId)
        void navigate({ to: "/venda/novo-lead", search: { id: item.cotacaoId, step: 5 } });
      return;
    }
    if (!item.leadId || !item.statusPipeline) return;
    setAbrindo(true);
    try {
      const destino = await resolveExistingLeadDestination({
        leadId: item.leadId,
        status: item.statusPipeline,
        canAssume: true,
      });
      if (destino.kind === "wizard") {
        void navigate({ to: "/venda/novo-lead", search: { id: destino.id, step: destino.step } });
      } else if (destino.kind === "proposals") {
        void navigate({
          to: "/venda/em-negociacao",
          search: destino.selected ? { selected: destino.selected } : {},
        });
      } else if (destino.kind === "acceptance") {
        void navigate({
          to: "/venda/em-finalizacao",
          search: destino.selected ? { selected: destino.selected } : {},
        });
      } else {
        setErr(destino.message);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao abrir o lead.");
    } finally {
      setAbrindo(false);
    }
  }

  return {
    itens,
    loading,
    err: err ?? queryErr,
    busyId,
    abrindo,
    marcarFeito,
    abrirItem,
    invalidarTudo,
  };
}
