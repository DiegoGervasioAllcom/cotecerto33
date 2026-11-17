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
import type { Form, UsoEscolhido } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
};

export function UsoVeiculoFields({ f, up }: Props) {
  const escolher = (chave: keyof UsoEscolhido, escolhido: boolean) =>
    up("usoEscolhido", { ...f.usoEscolhido, [chave]: escolhido });
  const isParticular = f.usoEscolhido.tipoUso && f.tipoUso === "Particular";
  const isLocadoraContrato = f.usoEscolhido.tipoUso && f.tipoUso === "Locadora (Contrato)";

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
          <label>
            Finalidade de uso<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.usoEscolhido.tipoUso ? f.tipoUso : ""}
            onChange={(e) => {
              if (e.target.value) up("tipoUso", e.target.value);
              escolher("tipoUso", e.target.value !== "");
            }}
          >
            <option value="">Selecione</option>
            {TIPO_USO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        {isParticular && (
          <div className="field-group">
            <label>
              Uso comercial 2+ dias/semana<span className="req">*</span>
            </label>
            <select
              className="input"
              value={f.usoEscolhido.comercial ? f.usoComercialDoisDias : ""}
              onChange={(e) => {
                if (e.target.value) up("usoComercialDoisDias", e.target.value as "sim" | "nao");
                escolher("comercial", e.target.value !== "");
              }}
            >
              <option value="">Selecione</option>
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
          <label>
            Uso para trabalho<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.usoEscolhido.trabalho ? f.usoTrabalho : ""}
            onChange={(e) => {
              if (e.target.value) up("usoTrabalho", e.target.value);
              escolher("trabalho", e.target.value !== "");
            }}
          >
            <option value="">Selecione</option>
            {USO_TRABALHO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>
            Uso para estudo<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.usoEscolhido.estudo ? f.usoEstudo : ""}
            onChange={(e) => {
              if (e.target.value) up("usoEstudo", e.target.value);
              escolher("estudo", e.target.value !== "");
            }}
          >
            <option value="">Selecione</option>
            {USO_ESTUDO.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
