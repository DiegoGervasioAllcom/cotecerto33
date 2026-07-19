import { STEPS } from "@/components/venda/novo-lead/types";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";

type Props = {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  resultados: ResultadoCalculo[];
  validarEtapa: (atual: number) => boolean;
  podeCalcular: boolean;
  doSimularCalculo: () => void;
};

export function WizardFooter({
  step,
  setStep,
  resultados,
  validarEtapa,
  podeCalcular,
  doSimularCalculo,
}: Props) {
  return (
    <div className="wizard-foot">
      {step === 5 ? (
        <>
          <button className="btn btn-ghost" onClick={() => setStep(4)}>
            <svg width="14" height="14">
              <use href="#i-chevron-left" />
            </svg>{" "}
            Voltar às coberturas
          </button>
          <span className="spacer" />
          <button className="btn btn-yellow pulse" disabled={resultados.length === 0}>
            <svg width="14" height="14">
              <use href="#i-check" />
            </svg>{" "}
            Gerar proposta
          </button>
        </>
      ) : (
        <>
          <button
            className="btn btn-ghost"
            disabled={step === 0}
            style={step === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <svg width="14" height="14">
              <use href="#i-chevron-left" />
            </svg>{" "}
            Voltar
          </button>
          <span className="spacer" />
          <span className="muted small">
            Passo {step + 1} de {STEPS.length}
          </span>
          {step === 4 ? (
            <button
              className="btn btn-yellow pulse"
              onClick={() => {
                if (!validarEtapa(4)) return;
                setStep(5);
                if (podeCalcular) doSimularCalculo();
              }}
            >
              <svg width="14" height="14">
                <use href="#i-bolt" />
              </svg>{" "}
              Calcular
            </button>
          ) : (
            <button
              className="btn btn-slate"
              onClick={() => {
                if (!validarEtapa(step)) return;
                setStep((s) => Math.min(STEPS.length - 1, s + 1));
              }}
            >
              Próximo{" "}
              <svg width="14" height="14">
                <use href="#i-chevron-right" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}
