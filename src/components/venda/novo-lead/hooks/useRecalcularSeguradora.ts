import { useState } from "react";
import type { Form } from "@/components/venda/novo-lead/types";
import {
  useDescontoAdicional,
  useDescontoAdicionalDados,
} from "@/components/venda/cotacoes/useDescontoAdicional";
import type { ResultadoCalculo } from "./useSimulacaoCalculo";

/**
 * Orquestração de "Recalcular esta seguradora" (`.seg-acoes` · V12.3.6):
 * busca os dados de desconto que o wizard não buscava antes
 * (`useDescontoAdicionalDados`), monta a parte pura/modal
 * (`useDescontoAdicional`, a mesma usada por `ComparativoQuiver`) e cancela
 * os pedidos de desconto pendentes/aguardando aceite de OUTRAS seguradoras
 * antes de reenviar — bloqueando com o motivo quando algum não pode ser
 * cancelado (RPC `cancelar_desconto` só deixa o solicitante cancelar).
 * Extraído de `novo-lead.tsx` para não crescer o arquivo (regra 9).
 */
export function useRecalcularSeguradora(params: {
  cotacaoId: string | null;
  resultados: ResultadoCalculo[];
  setF: React.Dispatch<React.SetStateAction<Form>>;
  recalcularSeguradora: (seguradora: string) => Promise<void>;
}) {
  const { cotacaoId, resultados, setF, recalcularSeguradora } = params;

  const descontoDados = useDescontoAdicionalDados(cotacaoId);
  const desconto = useDescontoAdicional({
    cotacaoId: cotacaoId ?? "",
    resultados,
    premios: descontoDados.premios,
    seguradoras: descontoDados.seguradoras,
    solicitacoes: descontoDados.solicitacoes,
    onDescontoEnviado: () => void descontoDados.invalidate(),
  });
  const [erroRecalculo, setErroRecalculo] = useState<string | null>(null);

  async function onRecalcularSeguradora(resultado: ResultadoCalculo) {
    setErroRecalculo(null);
    const resultadoCancelamento = await desconto.cancelarDescontosDeOutrasSeguradoras(
      resultado.seguradora,
    );
    if (!resultadoCancelamento.ok) {
      setErroRecalculo(
        `Não foi possível recalcular: ${resultadoCancelamento.motivo} (pedido de desconto de outra seguradora).`,
      );
      return;
    }
    if (resultadoCancelamento.canceladas > 0) void descontoDados.invalidate();
    setF((prev) => ({ ...prev, seguradorasSel: [resultado.seguradora] }));
    await recalcularSeguradora(resultado.seguradora);
  }

  return {
    infoDescontoFor: desconto.infoFor,
    onAbrirDesconto: desconto.abrirModal,
    descontoModal: desconto.modal,
    erroRecalculo,
    onRecalcularSeguradora,
  };
}

export type DescontoAcoes = ReturnType<typeof useRecalcularSeguradora>;
