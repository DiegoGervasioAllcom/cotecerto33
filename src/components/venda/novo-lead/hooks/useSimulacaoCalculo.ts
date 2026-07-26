import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enviarCotacaoQuiver } from "@/lib/quiver.functions";
import type { Form } from "../types";

export type ResultadoCalculo = { cia: string; premio: number; cobertura: string };

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
  persistirAntes: () => Promise<void>,
) {
  const [calculando, setCalculando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoCalculo[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  useEffect(() => {
    if (cotacaoId) void carregarResultados(cotacaoId);
  }, [cotacaoId]);

  function pararPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function carregarResultados(id: string) {
    const { data } = await supabase
      .from("cotacao_premios")
      .select("seguradora,cobertura,premio")
      .eq("cotacao_id", id);
    setResultados(
      (data ?? []).map((p) => ({
        cia: p.seguradora ?? "",
        premio: Number(p.premio),
        cobertura: p.cobertura ?? "",
      })),
    );
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

  async function simularCalculo() {
    if (!cotacaoId) {
      setErro("Salve os dados da cotação antes de calcular.");
      return;
    }
    setErro(null);
    setResultados([]);
    setCalculando(true);
    await persistirAntes();
    const { data: sess } = await supabase.auth.getSession();
    try {
      await enviarCotacaoQuiver({
        data: { cotacaoId, caller_token: sess.session?.access_token ?? "" },
      });
    } catch (e) {
      setCalculando(false);
      setErro(e instanceof Error ? e.message : "Falha ao enviar cotação para cálculo.");
      return;
    }
    iniciarPolling(cotacaoId);
  }

  const podeCalcular = !!(
    f.cpf &&
    f.nome &&
    f.marca &&
    f.modelo &&
    f.anoModelo &&
    (f.seguradorasSel?.length ?? 0) > 0
  );

  return { calculando, resultados, setResultados, erro, simularCalculo, podeCalcular };
}
