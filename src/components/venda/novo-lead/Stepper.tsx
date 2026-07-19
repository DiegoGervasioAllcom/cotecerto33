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
          <div
            className={"step " + (i === step ? "current" : "")}
            onClick={() => setStep(i)}
            style={{ cursor: "pointer" }}
          >
            <div className="n">{i + 1}</div>
            <div className="lbl">{label}</div>
          </div>
          {i < STEPS.length - 1 && <div className="line " />}
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
