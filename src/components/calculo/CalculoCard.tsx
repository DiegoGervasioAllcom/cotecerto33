import simboloAmarelo from "@/assets/cc-simbolo-amarelo.png";
import simboloCinza from "@/assets/cc-simbolo-cinza.png";
import { CALCULO_ETAPAS, CALCULO_ETAPA_ROTULO } from "@/lib/calculo-etapas";
import type { CalculoProgressoView } from "@/lib/calculo-progresso";

// Passos reais do robô (login … lendo_resultados); "na_fila" não aparece na lista.
const PASSOS = CALCULO_ETAPAS.filter((e) => e !== "na_fila");

/**
 * Loader do protótipo V12 (`ccEspera`: símbolo com onda amarela, título,
 * subtítulo e lista de passos), com a etapa real do robô no lugar do tempo
 * simulado. Fica inline na tela de cálculo (sem overlay, sem modal): o
 * `.cc-load` do protótipo é `position: fixed`, então aqui o inline style só
 * devolve o container ao fluxo da página — o vendedor navega livremente
 * enquanto carrega, porque o estado vive no banco.
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
    <div
      className="cc-load"
      role="status"
      aria-live="polite"
      style={{
        position: "static",
        inset: "auto",
        zIndex: "auto",
        background: "transparent",
        backdropFilter: "none",
        padding: "28px 0 20px",
      }}
    >
      <div className="cc-sym" style={{ width: 108 }}>
        <img className="sym-c" src={simboloCinza} alt="" />
        <img className="sym-a" src={simboloAmarelo} alt="" />
      </div>
      <div className="cc-load-t">Calculando sua cotação</div>
      <div className="cc-load-s">
        {nSeguradoras === 1
          ? "Consultando 1 seguradora. A seguir você vê o preço dela."
          : nSeguradoras
            ? `Consultando ${nSeguradoras} seguradoras ao mesmo tempo. A seguir você compara os preços lado a lado.`
            : "Consultando as seguradoras ao mesmo tempo. A seguir você compara os preços lado a lado."}
      </div>
      <ul className="cc-passos">
        {PASSOS.map((etapa, i) => {
          const n = i + 1;
          const cls = n < atual ? "ok" : n === atual ? "agora" : undefined;
          return (
            <li key={etapa} className={cls}>
              <span className="cp-ic" />
              {CALCULO_ETAPA_ROTULO[etapa]}
            </li>
          );
        })}
      </ul>
      <div className="muted small" style={{ marginTop: 16, textAlign: "center" }}>
        Pode sair desta tela — o resultado chega em alguns minutos.
        {v?.semAtualizacaoHaSegundos != null && (
          <> · sem atualização do robô há {v.semAtualizacaoHaSegundos} s</>
        )}
      </div>
    </div>
  );
}
