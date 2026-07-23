// Seção "Uso do veículo" do Passo 3 — espelha o protótipo v10 e o contrato
// real da API de cotação (Quiver). Blocos condicionais seguem exatamente a
// lógica documentada em doc/EXTERNAL_API_GUIDE.md do projeto
// /Users/diego.gervasio/Documents/playwright.
import {
  TIPO_USO,
  USO_TRABALHO,
  USO_ESTUDO,
  UTIL_LOCADORA,
} from "@/components/venda/novo-lead/enumsQuiver";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
};

export function UsoVeiculoFields({ f, up }: Props) {
  const isParticular = f.tipoUso === "Particular";
  const isLocadoraContrato = f.tipoUso === "Locadora (Contrato)";

  return (
    <>
      <div
        className="sec-title"
        style={{ margin: "18px 0 4px", color: "var(--slate)", fontWeight: 700, fontSize: 14 }}
      >
        Uso do veículo
      </div>
      <div className="wizard-grid">
        <div className="field-group full">
          <label>Finalidade de uso</label>
          <select
            className="input"
            value={f.tipoUso}
            onChange={(e) => up("tipoUso", e.target.value)}
          >
            {TIPO_USO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        {isParticular && (
          <div className="field-group">
            <label>Uso comercial 2+ dias/semana</label>
            <select
              className="input"
              value={f.usoComercialDoisDias}
              onChange={(e) => up("usoComercialDoisDias", e.target.value as "sim" | "nao")}
            >
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
        )}

        {isLocadoraContrato && (
          <div className="field-group">
            <label>Utilização (locadora contrato)</label>
            <select
              className="input"
              value={f.utilizacaoLocadora}
              onChange={(e) => up("utilizacaoLocadora", e.target.value)}
            >
              <option value="">Selecione</option>
              {UTIL_LOCADORA.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field-group">
          <label>Uso para trabalho</label>
          <select
            className="input"
            value={f.usoTrabalho}
            onChange={(e) => up("usoTrabalho", e.target.value)}
          >
            {USO_TRABALHO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>Uso para estudo</label>
          <select
            className="input"
            value={f.usoEstudo}
            onChange={(e) => up("usoEstudo", e.target.value)}
          >
            {USO_ESTUDO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
