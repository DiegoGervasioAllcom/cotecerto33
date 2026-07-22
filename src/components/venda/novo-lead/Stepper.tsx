import { STEPS } from "@/components/venda/novo-lead/types";

type Props = {
  step: number;
  setStep: (i: number) => void;
  podeCalcular: boolean;
};

export function Stepper({ step, setStep, podeCalcular }: Props) {
  return (
    <div className="stepper">
      {STEPS.map((label, i) => (
        <span key={label} style={{ display: "contents" }}>
          {i > 0 && <div className={"line " + (i < step ? "done" : "")} />}
          <div
            className={"step " + (i < step ? "done" : i === step ? "current" : "")}
            onClick={() => setStep(i)}
            style={{ cursor: "pointer" }}
          >
            <div className="n">
              {i < step ? (
                <svg width="14" height="14">
                  <use href="#i-check" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <div className="lbl">{label}</div>
          </div>
        </span>
      ))}
      {podeCalcular && (
        <span className="ready ">
          <svg width="12" height="12">
            <use href="#i-check" />
          </svg>{" "}
          Pronto para cotar
        </span>
      )}
    </div>
  );
}
