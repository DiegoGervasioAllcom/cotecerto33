import { useCallback, useEffect, useRef, useState } from "react";
import {
  avisoRecalculoGeral,
  deveLimparRecalculoUnico,
  estadoAoRecalcularUma,
  gravarRecalculoUnico,
  lerRecalculoUnico,
  mesmaSelecao,
  type RecalculoUnico,
} from "@/components/venda/novo-lead/recalculo-unico";

/** Estado (memória + sessionStorage por cotação) do último "Recalcular só esta
 * seguradora"; alimenta o aviso do recálculo geral. */
export function useRecalculoUnico(cotacaoId: string | null, seguradorasSel: string[]) {
  const [estado, setEstado] = useState<RecalculoUnico | null>(() => lerRecalculoUnico(cotacaoId));
  const vistaReduzida = useRef(false);
  const cotacaoLida = useRef<string | null>(cotacaoId);

  // cotacaoId costuma nascer depois (rascunho): relê quando ele muda.
  useEffect(() => {
    if (cotacaoLida.current === cotacaoId) return;
    cotacaoLida.current = cotacaoId;
    setEstado(lerRecalculoUnico(cotacaoId));
    vistaReduzida.current = false;
  }, [cotacaoId]);

  const limpar = useCallback(() => {
    vistaReduzida.current = false;
    setEstado(null);
    gravarRecalculoUnico(cotacaoId, null);
  }, [cotacaoId]);

  // Depois de vista reduzida, qualquer mudança de seleção pelo vendedor limpa.
  useEffect(() => {
    if (!estado) return;
    if (mesmaSelecao(seguradorasSel, [estado.seguradora])) vistaReduzida.current = true;
    else if (deveLimparRecalculoUnico(estado, seguradorasSel, vistaReduzida.current)) limpar();
  }, [estado, seguradorasSel, limpar]);

  const registrar = useCallback(
    (seguradora: string) => {
      const novo = estadoAoRecalcularUma(estado, seguradorasSel, seguradora);
      vistaReduzida.current = novo !== null;
      setEstado(novo);
      gravarRecalculoUnico(cotacaoId, novo);
    },
    [cotacaoId, estado, seguradorasSel],
  );

  return { aviso: avisoRecalculoGeral(estado, seguradorasSel), registrar, limpar };
}
