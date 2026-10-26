import { maskCep, maskKm } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";
import { Campo } from "./Campo";
import type { Up } from "./passos";

type Props = { f: Form; up: Up; erros: Record<string, string> };

/** Só o mínimo que o robô exige: km mensal e CEP de pernoite (o resto é padrão em defaults.ts). */
export function PassoUso({ f, up, erros }: Props) {
  const mesmoCep = !!f.cep && f.cepPernoite === f.cep;
  return (
    <>
      <Campo label="Km por mês" erro={erros.kmMensal}>
        <input
          className="m-input"
          inputMode="numeric"
          maxLength={20}
          value={f.kmMensal}
          onChange={(e) => up("kmMensal", maskKm(e.target.value))}
          placeholder="1.000 km"
        />
      </Campo>
      <label className="m-check">
        <input
          type="checkbox"
          checked={mesmoCep}
          onChange={(e) => up("cepPernoite", e.target.checked ? f.cep : "")}
        />
        <span>O veículo dorme no CEP residencial ({f.cep || "não informado"})</span>
      </label>
      {!mesmoCep && (
        <Campo label="CEP de pernoite" erro={erros.cepPernoite}>
          <input
            className="m-input"
            inputMode="numeric"
            maxLength={9}
            value={f.cepPernoite}
            onChange={(e) => up("cepPernoite", maskCep(e.target.value))}
            placeholder="00000-000"
          />
        </Campo>
      )}
      <div className="m-hint">
        Uso particular, condutor é o próprio segurado, garagem com portão e seguro novo. Para outros
        casos, use o desktop.
      </div>
    </>
  );
}
