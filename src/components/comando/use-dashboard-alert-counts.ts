import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardAlertCounts(
  period: { inicio: string; fim: string } | undefined,
  now: number,
  slaSeconds: number,
) {
  const refreshMinute = Math.floor(now / 60_000);

  return useQuery({
    queryKey: ["alertas-visao-geral", period?.inicio, period?.fim, refreshMinute],
    enabled: Boolean(period),
    queryFn: async () => {
      if (!period) throw new Error("Período ainda não normalizado.");
      const slaLimit = new Date(Date.now() - slaSeconds * 1000).toISOString();
      const renewalStart = period.inicio.slice(0, 10);
      const renewalEnd = period.fim.slice(0, 10);
      const [
        semAtendimento,
        slaEstourado,
        vendasNaoPagas,
        estornos,
        renovacoes,
        franquiasAbaixoMeta,
        vendedoresAtencao,
        pendentesSeguradora,
        leadsBloqueados,
        cadastrosPendentes,
        desligamentosPendentes,
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("status_pipeline", "novo")
          .is("ultimo_atendimento_em", null)
          .or("bloqueado.is.false,bloqueado.is.null")
          .or("arquivado.is.false,arquivado.is.null"),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("status_pipeline", "novo")
          .is("ultimo_atendimento_em", null)
          .or("bloqueado.is.false,bloqueado.is.null")
          .or("arquivado.is.false,arquivado.is.null")
          .lt("criado_em", slaLimit),
        supabase
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .not("emitida_em", "is", null)
          .is("pago_em", null)
          .is("cancelada_em", null)
          .gte("emitida_em", period.inicio)
          .lt("emitida_em", period.fim),
        supabase
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .not("cancelada_em", "is", null)
          .gte("cancelada_em", period.inicio)
          .lt("cancelada_em", period.fim),
        supabase
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .is("cancelada_em", null)
          .not("vencimento", "is", null)
          .gte("vencimento", renewalStart)
          .lt("vencimento", renewalEnd),
        // V11.7.6a — pró-rata de meta por franquia; a própria RPC já escopa
        // por empresas_visiveis(auth.uid()) e valida a janela.
        supabase.rpc("franquias_abaixo_meta_visao_geral", {
          p_inicio: period.inicio,
          p_fim: period.fim,
        }),
        // V11.7.6b — snapshot de performance_status (não é derivado do
        // período: é o status vigente agora), escopado pela mesma RLS de
        // `profiles` que já filtra Cadastros Matriz/Rede. Exclui desligados,
        // mesmo critério do job de recálculo (D4).
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .in("performance_status", ["atencao", "travado"])
          .is("desligado_em", null),
        // V11.7.5/7.6c — mesma RPC/contagem que alimenta o chip "Pendente da
        // seguradora" no resumo do período (visao-geral.tsx).
        supabase.rpc("contar_pendentes_seguradora_visao_geral", {
          p_inicio: period.inicio,
          p_fim: period.fim,
        }),
        // Barra "ALERTAS" do topo (mesmos 5 badges do protótipo) — leads que a
        // Matriz travou manualmente (bloquear_lead), fora da fila normal.
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("bloqueado", true)
          .eq("arquivado", false),
        // Cadastros (Matriz + Rede) aguardando classificação — mesmo critério
        // de `fetchPendentes` (Acessos e permissões).
        supabase
          .from("empresas")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
        // Solicitações de desligamento (C7) ainda não resolvidas pela Matriz.
        supabase
          .from("desligamento_solicitacoes")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),
      ]);
      const queryError =
        semAtendimento.error ??
        slaEstourado.error ??
        vendasNaoPagas.error ??
        estornos.error ??
        renovacoes.error ??
        franquiasAbaixoMeta.error ??
        vendedoresAtencao.error ??
        pendentesSeguradora.error ??
        leadsBloqueados.error ??
        cadastrosPendentes.error ??
        desligamentosPendentes.error;
      if (queryError) throw queryError;
      return {
        semAtendimento: semAtendimento.count ?? 0,
        slaEstourado: slaEstourado.count ?? 0,
        vendasNaoPagas: vendasNaoPagas.count ?? 0,
        estornos: estornos.count ?? 0,
        renovacoes: renovacoes.count ?? 0,
        franquiasAbaixoMeta: franquiasAbaixoMeta.data ?? 0,
        vendedoresAtencao: vendedoresAtencao.count ?? 0,
        pendentesSeguradora: pendentesSeguradora.data ?? 0,
        leadsBloqueados: leadsBloqueados.count ?? 0,
        cadastrosPendentes: cadastrosPendentes.count ?? 0,
        desligamentosPendentes: desligamentosPendentes.count ?? 0,
      };
    },
  });
}
