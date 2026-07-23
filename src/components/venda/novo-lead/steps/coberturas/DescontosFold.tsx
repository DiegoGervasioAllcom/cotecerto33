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

const rowStyle = {
  display: "flex",
  alignItems: "flex-end",
  gap: 14,
  flexWrap: "wrap" as const,
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
};

function DescontoAgravoRadio({
  seguradora,
  value,
  onChange,
}: {
  seguradora: string;
  value: "Desconto" | "Agravo";
  onChange: (v: "Desconto" | "Agravo") => void;
}) {
  return (
    <div className="row" style={{ gap: 14, paddingBottom: 8 }}>
      <label>
        <input
          type="radio"
          name={`da_${seguradora}`}
          checked={value === "Desconto"}
          onChange={() => onChange("Desconto")}
        />{" "}
        Desconto
      </label>
      <label>
        <input
          type="radio"
          name={`da_${seguradora}`}
          checked={value === "Agravo"}
          onChange={() => onChange("Agravo")}
        />{" "}
        Agravo
      </label>
    </div>
  );
}

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
          <div key={s} style={rowStyle}>
            <div
              style={{
                minWidth: 130,
                fontWeight: 700,
                color: "var(--slate)",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="13" height="13">
                <use href="#i-shield" />
              </svg>
              {s}
            </div>
            {s === "Allianz" ? (
              <>
                <DescontoAgravoRadio
                  seguradora={s}
                  value={campo(s, "da", "Desconto") as "Desconto" | "Agravo"}
                  onChange={(v) => setCampo(s, "da", v)}
                />
                <div className="field-group" style={{ margin: 0, maxWidth: 150 }}>
                  <label>Desconto CA (%)</label>
                  <input
                    className="input"
                    value={campo(s, "descCA", "25,00")}
                    onChange={(e) => setCampo(s, "descCA", e.target.value)}
                  />
                </div>
                <div className="field-group" style={{ margin: 0, maxWidth: 160 }}>
                  <label>Saldo Conta Corrente</label>
                  <input
                    className="input"
                    value="2.058,29"
                    readOnly
                    style={{ background: "var(--offwhite)" }}
                  />
                </div>
              </>
            ) : s === "Aliro" ? (
              <div className="field-group" style={{ margin: 0, maxWidth: 150 }}>
                <label>Agravo extra</label>
                <input
                  className="input"
                  value={campo(s, "agravoExtra", "0,00")}
                  onChange={(e) => setCampo(s, "agravoExtra", e.target.value)}
                />
              </div>
            ) : s === "Bradesco" ? (
              <div className="field-group" style={{ margin: 0, maxWidth: 260 }}>
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
              <div className="field-group" style={{ margin: 0, maxWidth: 260 }}>
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
              <div className="field-group" style={{ margin: 0, maxWidth: 260 }}>
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
                <DescontoAgravoRadio
                  seguradora={s}
                  value={campo(s, "da", "Desconto") as "Desconto" | "Agravo"}
                  onChange={(v) => setCampo(s, "da", v)}
                />
                <div className="field-group" style={{ margin: 0, maxWidth: 150 }}>
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
                <div className="field-group" style={{ margin: 0, maxWidth: 150 }}>
                  <label>Desconto</label>
                  <input
                    className="input"
                    value={campo(s, "desc", "0,00")}
                    onChange={(e) => setCampo(s, "desc", maskBRL(e.target.value))}
                  />
                </div>
                <div className="field-group" style={{ margin: 0, maxWidth: 150 }}>
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
