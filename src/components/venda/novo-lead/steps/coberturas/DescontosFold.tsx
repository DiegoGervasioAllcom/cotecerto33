// Fold "Descontos e agravos" do Passo 5 — uma linha por seguradora, com
// campos específicos por seguradora (protótipo v10, função descRow).
// Não faz parte do objeto `cobertura` da API Quiver (validator/openapi não
// têm nenhum campo de desconto/agravo por seguradora) — uso interno de
// negociação com a matriz, guardado em cotacao_coberturas.descontos_agravos.
import { useState } from "react";
import { maskBRL } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  seguradoras: readonly string[];
};

export function DescontosFold({ f, up, seguradoras }: Props) {
  const [open, setOpen] = useState(false);

  function setCampo(seguradora: string, campo: string, valor: string) {
    up("descontosAgravos", {
      ...f.descontosAgravos,
      [seguradora]: { ...f.descontosAgravos[seguradora], [campo]: valor },
    });
  }
  function campo(seguradora: string, nome: string, padrao = "") {
    return f.descontosAgravos[seguradora]?.[nome] ?? padrao;
  }

  return (
    <div className={`fold${open ? " open" : ""}`}>
      <div className="fold-h" onClick={() => setOpen((v) => !v)}>
        Descontos e agravos{" "}
        <span className="lbl-soft">por seguradora — desconto, agravo e regras específicas</span>
        <svg className="chev" width="14" height="14">
          <use href="#i-chevron-down" />
        </svg>
      </div>
      <div className="fold-b">
        {seguradoras.map((s) => (
          <div key={s} className="wizard-grid cols-3" style={{ marginBottom: 10 }}>
            <div className="field-group" style={{ margin: 0 }}>
              <strong style={{ fontSize: 13 }}>{s}</strong>
            </div>
            {s === "Allianz" ? (
              <>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Desconto/Agravo</label>
                  <select
                    className="input"
                    value={campo(s, "da", "Desconto")}
                    onChange={(e) => setCampo(s, "da", e.target.value)}
                  >
                    <option>Desconto</option>
                    <option>Agravo</option>
                  </select>
                </div>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Desconto CA (%)</label>
                  <input
                    className="input"
                    value={campo(s, "descCA", "25,00")}
                    onChange={(e) => setCampo(s, "descCA", e.target.value)}
                  />
                </div>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Saldo Conta Corrente</label>
                  <input className="input" value="2.058,29" readOnly />
                </div>
              </>
            ) : s === "Aliro" ? (
              <div className="field-group" style={{ margin: 0 }}>
                <label>Agravo extra</label>
                <input
                  className="input"
                  value={campo(s, "agravoExtra", "0,00")}
                  onChange={(e) => setCampo(s, "agravoExtra", e.target.value)}
                />
              </div>
            ) : s === "Bradesco" ? (
              <div className="field-group" style={{ margin: 0 }}>
                <label>Contrato</label>
                <select
                  className="input"
                  value={campo(s, "contrato", "Sem Contrato")}
                  onChange={(e) => setCampo(s, "contrato", e.target.value)}
                >
                  <option>Sem Contrato</option>
                  <option>Contrato corporativo</option>
                  <option>Contrato afinidade</option>
                </select>
              </div>
            ) : s === "HDI" ? (
              <div className="field-group" style={{ margin: 0 }}>
                <label>Melhor data p/ pagamento (Débito em Conta)</label>
                <select
                  className="input"
                  value={campo(s, "melhorData")}
                  onChange={(e) => setCampo(s, "melhorData", e.target.value)}
                >
                  <option value="">Selecione</option>
                  <option>Dia 5</option>
                  <option>Dia 10</option>
                  <option>Dia 15</option>
                  <option>Dia 20</option>
                  <option>Dia 25</option>
                </select>
              </div>
            ) : s === "Mapfre" || s === "Yelum" ? (
              <div className="field-group" style={{ margin: 0 }}>
                <label>Código Afinidade</label>
                <select
                  className="input"
                  value={campo(s, "grafin", "Sem Grafin")}
                  onChange={(e) => setCampo(s, "grafin", e.target.value)}
                >
                  <option>Sem Grafin</option>
                  <option>Grafin Varejo</option>
                  <option>Grafin Concessionária</option>
                </select>
              </div>
            ) : s === "Suhai" ? (
              <>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Desconto/Agravo</label>
                  <select
                    className="input"
                    value={campo(s, "da", "Desconto")}
                    onChange={(e) => setCampo(s, "da", e.target.value)}
                  >
                    <option>Desconto</option>
                    <option>Agravo</option>
                  </select>
                </div>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Desconto</label>
                  <input
                    className="input"
                    value={campo(s, "desc", "0,00")}
                    onChange={(e) => setCampo(s, "desc", maskBRL(e.target.value))}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Desconto</label>
                  <input
                    className="input"
                    value={campo(s, "desc", "0,00")}
                    onChange={(e) => setCampo(s, "desc", maskBRL(e.target.value))}
                  />
                </div>
                <div className="field-group" style={{ margin: 0 }}>
                  <label>Agravo</label>
                  <input
                    className="input"
                    value={campo(s, "agravo", "0,00")}
                    onChange={(e) => setCampo(s, "agravo", maskBRL(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
