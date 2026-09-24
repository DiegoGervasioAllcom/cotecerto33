// Hook compartilhado das 5 fontes da agenda unificada (Frente 9/V12):
// retornos agendados, negócios em risco, pendência da seguradora, aprovações
// pedidas e lembretes pessoais.
// Extraído de `venda/agenda.tsx` (V12.3.1) para ser reutilizado também pelo
// cartão "O que fazer agora" do Início (`selecionarFilaHome` em
// `@/lib/agenda`) — mesma query, mesmas ações (marcar feito / abrir item).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fetchAprovacoesAgenda,
  fetchLembretesAgenda,
  fetchRetornosAgenda,
  fetchRiscoAgenda,
  fetchSeguradoraAgenda,
  montarAgenda,
  type AgendaItem,
} from "@/lib/agenda";
import { resolveExistingLeadDestination } from "@/lib/pipeline-lead-navigation";

const QK_RETORNOS = ["agenda", "retornos"] as const;
const QK_RISCO = ["agenda", "risco"] as const;
const QK_SEGURADORA = ["agenda", "seguradora"] as const;
const QK_APROVACOES = ["agenda", "aprovacoes"] as const;
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
  const riscoQuery = useQuery({
    queryKey: [...QK_RISCO, uid],
    queryFn: () => fetchRiscoAgenda(uid!),
    enabled: !!uid,
  });
  const seguradoraQuery = useQuery({
    queryKey: [...QK_SEGURADORA, uid],
    queryFn: () => fetchSeguradoraAgenda(uid!),
    enabled: !!uid,
  });
  const aprovacoesQuery = useQuery({
    queryKey: [...QK_APROVACOES, uid],
    queryFn: () => fetchAprovacoesAgenda(uid!),
    enabled: !!uid,
  });
  const lembretesQuery = useQuery({ queryKey: QK_LEMBRETES, queryFn: fetchLembretesAgenda });

  const loading =
    !uid ||
    retornosQuery.isPending ||
    riscoQuery.isPending ||
    seguradoraQuery.isPending ||
    aprovacoesQuery.isPending ||
    lembretesQuery.isPending;
  const queryErr =
    (retornosQuery.error instanceof Error ? retornosQuery.error.message : null) ??
    (riscoQuery.error instanceof Error ? riscoQuery.error.message : null) ??
    (seguradoraQuery.error instanceof Error ? seguradoraQuery.error.message : null) ??
    (aprovacoesQuery.error instanceof Error ? aprovacoesQuery.error.message : null) ??
    (lembretesQuery.error instanceof Error ? lembretesQuery.error.message : null);

  const itens = useMemo(
    () =>
      montarAgenda(
        retornosQuery.data ?? [],
        riscoQuery.data ?? [],
        seguradoraQuery.data ?? [],
        aprovacoesQuery.data ?? [],
        lembretesQuery.data ?? [],
      ),
    [
      retornosQuery.data,
      riscoQuery.data,
      seguradoraQuery.data,
      aprovacoesQuery.data,
      lembretesQuery.data,
    ],
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
    if (item.fonte === "seguradora") {
      if (item.propostaId)
        void navigate({ to: "/venda/emissao", search: { selected: item.propostaId } });
      return;
    }
    // "aprovacao": só é clicável quando existe lead de origem (VIP de carteira
    // sem lead, como no protótipo, fica sem ação — comentário no fetcher).
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
