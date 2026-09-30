import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ajustesKey } from "./useAjustesSeguradora";
import { supabase } from "@/integrations/supabase/client";
import { enviarCotacaoQuiver } from "@/lib/quiver.functions";
import type { Form } from "../types";
import {
  parseQuiverResultado,
  parseQuiverSemRetorno,
  type ResultadoCalculo,
  type SemRetornoItem,
} from "@/components/venda/cotacoes/quiver-resultado";

export {
  premioNumerico,
  type ResultadoCalculo,
} from "@/components/venda/cotacoes/quiver-resultado";

const POLL_MS = 4000;

/**
 * Cálculo real via API da Quiver (Fase 5): envia a cotação (`enviarCotacaoQuiver`,
 * server function), depois faz polling em `cotacoes.status`/`cotacao_premios` até
 * o webhook da Quiver gravar o resultado (`calculada`) ou o erro (`erro_quiver`).
 * Não existe endpoint de "buscar resultado" na Quiver — o polling é a única forma
 * de detectar quando o webhook (assíncrono, ~1-3min) terminou.
 */
export function useSimulacaoCalculo(
  f: Form,
  cotacaoId: string | null,
  persistirAntes: (overrides?: { seguradorasSel?: string[] }) => Promise<void>,
) {
  const queryClient = useQueryClient();
  const [calculando, setCalculando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoCalculo[]>([]);
  const [semRetorno, setSemRetorno] = useState<SemRetornoItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!cotacaoId) return;
    void (async () => {
      const { data } = await supabase
        .from("cotacoes")
        .select("status,quiver_mensagem")
        .eq("id", cotacaoId)
        .maybeSingle();
      if (!data) return;
      if (data.status === "calculada") {
        await carregarResultados(cotacaoId);
      } else if (data.status === "erro_quiver") {
        setErro(data.quiver_mensagem || "A seguradora não retornou prêmios para esta cotação.");
      } else if (data.status === "enviada_quiver") {
        // reabriu a cotação enquanto o webhook da Quiver ainda não respondeu —
        // retoma o polling em vez de deixar a tela parada em "Calcular agora".
        setCalculando(true);
        iniciarPolling(cotacaoId);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotacaoId]);

  function pararPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function carregarResultados(id: string) {
    // Uma seguradora pode aparecer em vários cards (produtos distintos), então
    // lemos direto de quiver_resultado_raw.cards[] em vez do join com
    // cotacao_premios (que agrega por card, não por seguradora).
    const { data } = await supabase
      .from("cotacoes")
      .select("quiver_resultado_raw")
      .eq("id", id)
      .maybeSingle();
    setResultados(parseQuiverResultado(data?.quiver_resultado_raw));
    setSemRetorno(parseQuiverSemRetorno(data?.quiver_resultado_raw));
  }

  function iniciarPolling(id: string) {
    pararPolling();
    pollTimer.current = setInterval(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("cotacoes")
          .select("status,quiver_mensagem")
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return;
        if (data.status === "calculada") {
          pararPolling();
          await carregarResultados(id);
          setCalculando(false);
        } else if (data.status === "erro_quiver") {
          pararPolling();
          setErro(data.quiver_mensagem || "A seguradora não retornou prêmios para esta cotação.");
          setCalculando(false);
        }
      })();
    }, POLL_MS);
  }

  async function enviarECalcular(overrides?: {
    seguradorasSel?: string[];
    /** V12.3.7: recálculo de uma seguradora só — aplica o ajuste guardado dela. */
    seguradoraAjuste?: string;
  }) {
    if (!cotacaoId) {
      setErro("Salve os dados da cotação antes de calcular.");
      return;
    }
    setErro(null);
    setResultados([]);
    setSemRetorno([]);
    setCalculando(true);
    await persistirAntes(overrides ? { seguradorasSel: overrides.seguradorasSel } : undefined);
    const { data: sess } = await supabase.auth.getSession();
    try {
      await enviarCotacaoQuiver({
        data: {
          cotacaoId,
          caller_token: sess.session?.access_token ?? "",
          ...(overrides?.seguradoraAjuste ? { seguradoraAjuste: overrides.seguradoraAjuste } : {}),
        },
      });
    } catch (e) {
      setCalculando(false);
      setErro(e instanceof Error ? e.message : "Falha ao enviar cotação para cálculo.");
      return;
    }
    // o servidor marcou os ajustes como aplicados/não aplicados
    void queryClient.invalidateQueries({ queryKey: ajustesKey(cotacaoId) });
    iniciarPolling(cotacaoId);
  }

  async function simularCalculo() {
    await enviarECalcular();
  }

  /** "Recalcular esta seguradora" (SegAcoes · V12.3.6) — descarta as ofertas
   * das outras seguradoras desta cotação: o chamador já cuidou de cancelar
   * os pedidos de desconto pendentes/aguardando aceite de terceiros antes de
   * chamar isto (bloqueio quando algum não pode ser cancelado). Aqui só
   * força `seguradorasSel = [seguradora]` na persistência e reenvia. */
  async function recalcularSeguradora(seguradora: string) {
    await enviarECalcular({ seguradorasSel: [seguradora], seguradoraAjuste: seguradora });
  }

  // R.9 (revisão form vs robô Quiver, 2026-08): o gate reflete os campos que
  // o robô Playwright exige de fato — ele identifica o veículo pela placa via
  // FIPE do portal da seguradora, não usa marca/modelo/anoModelo (que
  // continuam sendo coletados na tela, só não bloqueiam mais o cálculo).
  const CAMPOS_OBRIGATORIOS_CALCULO: { campo: keyof Form; label: string }[] = [
    { campo: "cpf", label: "CPF" },
    { campo: "nome", label: "Nome completo" },
    { campo: "sexo", label: "Sexo" },
    { campo: "estadoCivil", label: "Estado civil" },
    { campo: "placa", label: "Placa" },
    { campo: "email", label: "E-mail" },
    { campo: "cep", label: "CEP" },
    { campo: "celular", label: "Telefone celular" },
    { campo: "cepPernoite", label: "CEP de pernoite" },
    { campo: "cepCirculacao", label: "CEP de circulação" },
    { campo: "kmMensal", label: "Km mensal" },
  ];

  const camposFaltantes = CAMPOS_OBRIGATORIOS_CALCULO.filter((c) => !f[c.campo]).map(
    (c) => c.label,
  );
  if ((f.seguradorasSel?.length ?? 0) === 0) camposFaltantes.push("Seguradoras selecionadas");

  const podeCalcular = camposFaltantes.length === 0;

  return {
    calculando,
    resultados,
    setResultados,
    semRetorno,
    erro,
    simularCalculo,
    recalcularSeguradora,
    podeCalcular,
    camposFaltantes,
  };
}
