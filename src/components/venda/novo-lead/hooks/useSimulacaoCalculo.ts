import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { enviarCotacaoQuiver } from "@/lib/quiver.functions";
import type { Form } from "../types";

export type OpcaoPremio = {
  tipo?: string;
  avista?: string;
  desconto?: string;
  franquia?: string;
  parcelas?: string;
};

export type ResultadoCalculo = {
  index: number;
  seguradora: string;
  nome: string;
  produto?: string;
  opcoes: OpcaoPremio[];
  formaPagamento?: string;
  formasPagamento?: { opcoes: string[]; selecionada?: string };
  coberturasBasicas?: Record<string, string>;
  coberturasAdicionais?: Record<string, string>;
  premiosPorFormaPagamento?: { formaPagamento: string; opcoes: OpcaoPremio[] }[];
};

export function premioNumerico(opcao?: OpcaoPremio): number {
  const texto = opcao?.avista;
  if (!texto) return Infinity;
  const match = texto.match(/R\$\s*([\d.,]+)/);
  if (!match) return Infinity;
  const numero = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : Infinity;
}

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
    const cards = (data?.quiver_resultado_raw as { cards?: unknown[] } | null)?.cards ?? [];
    setResultados(
      cards.map((c, i) => {
        const card = c as Record<string, unknown>;
        return {
          index: typeof card.index === "number" ? card.index : i,
          seguradora: (card.seguradora as string) ?? "",
          nome: (card.nome as string) ?? "",
          produto: card.produto as string | undefined,
          opcoes: (card.opcoes as OpcaoPremio[]) ?? [],
          formaPagamento: card.formaPagamento as string | undefined,
          formasPagamento: card.formasPagamento as ResultadoCalculo["formasPagamento"],
          coberturasBasicas: card.coberturasBasicas as Record<string, string> | undefined,
          coberturasAdicionais: card.coberturasAdicionais as Record<string, string> | undefined,
          premiosPorFormaPagamento: card.premiosPorFormaPagamento as
            | ResultadoCalculo["premiosPorFormaPagamento"]
            | undefined,
        };
      }),
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
