import { CALCULO_ETAPAS, CALCULO_ETAPA_ROTULO } from "@/lib/calculo-etapas";
import type { CalculoProgressoView } from "@/lib/calculo-progresso";
import { PassosEspera } from "./PassosEspera";

// Passos reais do robô (login … lendo_resultados); "na_fila" não aparece na lista.
const PASSOS = CALCULO_ETAPAS.filter((e) => e !== "na_fila");

/**
 * Loader "Calculando sua cotação" com a etapa real do robô no lugar do tempo
 * simulado. Inline na tela de cálculo; o estado vive no banco, então o
 * vendedor navega livremente enquanto carrega.
 */
export function CalculoEspera({
  v,
  nSeguradoras,
}: {
  v?: CalculoProgressoView;
  nSeguradoras?: number;
}) {
  // seq 0/1 → 1º passo em andamento; `final` (concluido/erro) → todos ok.
  const atual = v?.final ? PASSOS.length + 1 : (v?.passo ?? 1);
  return (
    <PassosEspera
      titulo="Calculando sua cotação"
      subtitulo={
        nSeguradoras === 1
          ? "Consultando 1 seguradora. A seguir você vê o preço dela."
          : nSeguradoras
            ? `Consultando ${nSeguradoras} seguradoras ao mesmo tempo. A seguir você compara os preços lado a lado.`
            : "Consultando as seguradoras ao mesmo tempo. A seguir você compara os preços lado a lado."
      }
      passos={PASSOS.map((e) => CALCULO_ETAPA_ROTULO[e])}
      atual={atual}
      rodape={
        <>
          Pode sair desta tela — o resultado chega em alguns minutos.
          {v?.semAtualizacaoHaSegundos != null && (
            <> · sem atualização do robô há {v.semAtualizacaoHaSegundos} s</>
          )}
        </>
      }
    />
  );
}
