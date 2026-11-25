import { PassosEspera } from "@/components/calculo/PassosEspera";
import { TRANSMISSAO_ETAPAS, TRANSMISSAO_ETAPA_ROTULO } from "@/lib/transmissao-etapas";
import type { TransmissaoProgressoView } from "@/lib/transmissao-progresso";

const PASSOS = TRANSMISSAO_ETAPAS.filter((e) => e !== "na_fila");

/** Tela "Transmitindo sua proposta" com os passos reais do robô. */
export function TransmissaoEspera({ v }: { v?: TransmissaoProgressoView }) {
  const atual = v?.final ? PASSOS.length + 1 : (v?.passo ?? 1);
  return (
    <PassosEspera
      titulo="Transmitindo sua proposta"
      subtitulo="O robô está enviando a proposta ao portal da seguradora. Não precisa fazer nada."
      passos={PASSOS.map((e) => TRANSMISSAO_ETAPA_ROTULO[e])}
      atual={atual}
      rodape={
        <>
          Pode sair desta tela — o resultado chega em instantes.
          {v?.semAtualizacaoHaSegundos != null && (
            <> · sem atualização do robô há {v.semAtualizacaoHaSegundos} s</>
          )}
        </>
      }
    />
  );
}
