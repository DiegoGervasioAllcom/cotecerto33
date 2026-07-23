// Fold "Condições especiais — Worksite, Affinity e grupo segurado" do
// Passo 5. No protótipo v10 os 3 checkboxes não têm nenhum binding de
// estado (puramente decorativos) — aqui ficam funcionais, guardados em
// cotacao_coberturas.condicoes_especiais (não faz parte do objeto
// `cobertura` da API Quiver).
import { useState } from "react";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
};

export function CondicoesEspeciaisFold({ f, up }: Props) {
  const [open, setOpen] = useState(false);

  function toggle(key: keyof Form["condicoesEspeciais"]) {
    up("condicoesEspeciais", { ...f.condicoesEspeciais, [key]: !f.condicoesEspeciais[key] });
  }

  return (
    <div className={`fold${open ? " open" : ""}`}>
      <div className="fold-h" onClick={() => setOpen((v) => !v)}>
        Condições especiais — Worksite, Affinity e grupo segurado{" "}
        <span className="lbl-soft">consolidadas numa visão única</span>
        <svg className="chev" width="14" height="14">
          <use href="#i-chevron-down" />
        </svg>
      </div>
      <div className="fold-b">
        <div className="wizard-grid">
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={f.condicoesEspeciais.worksite}
              onChange={() => toggle("worksite")}
            />
            <span>
              <strong>Porto / Zurich Worksite</strong> · convênio empresa
            </span>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={f.condicoesEspeciais.yelumVarejo}
              onChange={() => toggle("yelumVarejo")}
            />
            <span>
              <strong>Yelum Varejo Concessionária</strong>
            </span>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={f.condicoesEspeciais.planosPopulares}
              onChange={() => toggle("planosPopulares")}
            />
            <span>
              <strong>Suhai / Aliro / Tokio</strong> · planos populares
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
