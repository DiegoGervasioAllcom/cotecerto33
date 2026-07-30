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
      const [semAtendimento, slaEstourado, vendasNaoPagas, estornos, renovacoes] =
        await Promise.all([
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
        ]);
      const queryError =
        semAtendimento.error ??
        slaEstourado.error ??
        vendasNaoPagas.error ??
        estornos.error ??
        renovacoes.error;
      if (queryError) throw queryError;
      return {
        semAtendimento: semAtendimento.count ?? 0,
        slaEstourado: slaEstourado.count ?? 0,
        vendasNaoPagas: vendasNaoPagas.count ?? 0,
        estornos: estornos.count ?? 0,
        renovacoes: renovacoes.count ?? 0,
      };
    },
  });
}
