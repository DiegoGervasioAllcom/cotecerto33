import { useState } from "react";
import { onlyDigits } from "@/lib/masks";
import type { Form } from "../types";

export type ResultadoCalculo = { cia: string; premio: number; cobertura: string };

/**
 * Simulação de cálculo (mock) por seguradora selecionada.
 * `simularCalculo` aceita um callback opcional `onCalculado`, disparado com os
 * resultados computados — usado por quem chama para persistir o rascunho
 * (ver useCotacaoRascunho) sem acoplar os dois hooks entre si.
 */
export function useSimulacaoCalculo(f: Form, fipeValor: string) {
  const [calculando, setCalculando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoCalculo[]>([]);

  function simularCalculo(onCalculado?: (novos: ResultadoCalculo[]) => void) {
    const alvos = (f.seguradorasSel ?? []).filter(Boolean);
    if (!alvos.length) {
      setResultados([]);
      return;
    }
    setCalculando(true);
    setResultados([]);
    setTimeout(() => {
      const base = fipeValor ? Number(onlyDigits(fipeValor)) / 100 : 60000;
      const fator =
        f.tipoCobertura === "Compreensiva" ? 0.035 : f.tipoCobertura === "RCF" ? 0.012 : 0.02;
      const novos = alvos.map((cia, i) => ({
        cia,
        premio: Math.round(base * fator * (0.85 + i * 0.07)),
        cobertura: f.tipoCobertura,
      }));
      setResultados(novos);
      setCalculando(false);
      onCalculado?.(novos);
    }, 900);
  }

  const podeCalcular = !!(
    f.cpf &&
    f.nome &&
    f.marca &&
    f.modelo &&
    f.anoModelo &&
    (f.seguradorasSel?.length ?? 0) > 0
  );

  return { calculando, resultados, setResultados, simularCalculo, podeCalcular };
}
