import { onlyDigits } from "@/lib/masks";
import { maskPlaca, maskAno, maskKm, maskCep } from "@/components/venda/novo-lead/masks";
import { UsoVeiculoFields } from "@/components/venda/novo-lead/steps/veiculo/UsoVeiculoFields";
import { DadosComplementaresFold } from "@/components/venda/novo-lead/steps/veiculo/DadosComplementaresFold";
import { AcessoriosFold } from "@/components/venda/novo-lead/steps/veiculo/AcessoriosFold";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  erros: Record<string, string>;
  marcas: { codigo: string; nome: string }[];
  modelos: { codigo: number; nome: string }[];
  fipeValor: string;
};

export function StepVeiculo({ f, up, erros, marcas, modelos, fipeValor }: Props) {
  return (
    <>
      <h2>Dados do Veículo</h2>
      <div className="sub">
        Marca / Modelo via Tabela FIPE. Valor sugerido aparece automaticamente.
      </div>
      <div className="wizard-grid">
        <div className="field-group">
          <label>Placa</label>
          <input
            className="input"
            value={f.placa}
            maxLength={8}
            onChange={(e) => up("placa", maskPlaca(e.target.value))}
            placeholder="AAA-0A00"
          />
          {erros.placa && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.placa}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Chassi</label>
          <input
            className="input"
            value={f.chassi}
            maxLength={17}
            onChange={(e) => up("chassi", e.target.value.toUpperCase())}
            placeholder="17 caracteres"
          />
          {erros.chassi && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.chassi}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Renavam</label>
          <input
            className="input"
            value={f.renavam}
            inputMode="numeric"
            maxLength={11}
            onChange={(e) => up("renavam", onlyDigits(e.target.value).slice(0, 11))}
          />
        </div>
        <div className="field-group">
          <label>Zero KM</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.zeroKm}
                onChange={(e) => up("zeroKm", e.target.checked)}
              />{" "}
              Sim
            </label>
          </div>
        </div>
        <div className="field-group">
          <label>
            Marca<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.marca}
            onChange={(e) => {
              up("marca", e.target.value);
              up("modelo", "");
            }}
          >
            <option value="">Selecione</option>
            {marcas.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group full">
          <label>
            Modelo<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.modelo}
            onChange={(e) => up("modelo", e.target.value)}
            disabled={!f.marca}
          >
            <option value="">{f.marca ? "Selecione" : "Selecione a marca antes"}</option>
            {modelos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label>
            Ano modelo<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.anoModelo}
            inputMode="numeric"
            onChange={(e) => up("anoModelo", maskAno(e.target.value))}
            placeholder="2024"
          />
        </div>
        <div className="field-group">
          <label>Ano fabricação</label>
          <input
            className="input"
            value={f.anoFab}
            inputMode="numeric"
            onChange={(e) => up("anoFab", maskAno(e.target.value))}
            placeholder="2023"
          />
        </div>
        <div className="field-group">
          <label>Combustível</label>
          <select
            className="input"
            value={f.combustivel}
            onChange={(e) => up("combustivel", e.target.value)}
          >
            <option>Flex</option>
            <option>Gasolina</option>
            <option>Álcool</option>
            <option>Diesel</option>
            <option>Elétrico</option>
          </select>
        </div>
        <div className="field-group">
          <label>Cor</label>
          <input
            className="input"
            value={f.cor}
            maxLength={50}
            onChange={(e) => up("cor", e.target.value)}
          />
          {erros.cor && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.cor}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Valor FIPE</label>
          <input
            className="input"
            value={fipeValor}
            readOnly
            style={{ background: "var(--offwhite)" }}
            placeholder="Preenche via FIPE"
          />
        </div>
        <div className="field-group">
          <label>Blindado</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.blindado}
                onChange={(e) => up("blindado", e.target.checked)}
              />{" "}
              Sim
            </label>
          </div>
        </div>
        <div className="field-group">
          <label>Alienado</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.alienado}
                onChange={(e) => up("alienado", e.target.checked)}
              />{" "}
              Sim
            </label>
          </div>
        </div>
        {f.alienado && (
          <div className="field-group">
            <label>Banco / Financeira</label>
            <input
              className="input"
              value={f.banco}
              maxLength={150}
              onChange={(e) => up("banco", e.target.value)}
            />
            {erros.banco && (
              <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                {erros.banco}
              </span>
            )}
          </div>
        )}
        <div className="field-group">
          <label>Uso comercial</label>
          <select
            className="input"
            value={f.usoComercial}
            onChange={(e) => up("usoComercial", e.target.value)}
          >
            <option>Não</option>
            <option>Sim</option>
          </select>
        </div>
        <div className="field-group">
          <label>KM mensal</label>
          <input
            className="input"
            value={f.kmMensal}
            inputMode="numeric"
            onChange={(e) => up("kmMensal", maskKm(e.target.value))}
            placeholder="1.000 km"
          />
        </div>
        <div className="field-group">
          <label>CEP de circulação</label>
          <input
            className="input"
            value={f.cepCirculacao}
            inputMode="numeric"
            onChange={(e) => up("cepCirculacao", maskCep(e.target.value))}
            placeholder="00000-000"
          />
        </div>
        <div className="field-group">
          <label>Nº de passageiros</label>
          <input
            className="input"
            value={f.numPassageiros}
            inputMode="numeric"
            maxLength={2}
            onChange={(e) => up("numPassageiros", onlyDigits(e.target.value).slice(0, 2))}
          />
        </div>
      </div>

      <UsoVeiculoFields f={f} up={up} />
      <DadosComplementaresFold f={f} up={up} />
      <AcessoriosFold f={f} up={up} />
    </>
  );
}
