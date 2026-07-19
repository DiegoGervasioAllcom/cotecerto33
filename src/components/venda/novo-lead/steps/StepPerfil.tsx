import { maskCpfCnpj } from "@/lib/masks";
import { maskCep } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  erros: Record<string, string>;
};

export function StepPerfil({ f, up, erros }: Props) {
  return (
    <>
      <h2>Perfil do Condutor</h2>
      <div className="sub">Quem dirige o veículo na maior parte do tempo e detalhes de uso.</div>
      <div className="wizard-grid">
        <div className="field-group full">
          <label>Condutor principal é o próprio segurado?</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="radio"
                name="cond"
                checked={f.condutorMesmo === "sim"}
                onChange={() => up("condutorMesmo", "sim")}
              />{" "}
              Sim
            </label>
            <label>
              <input
                type="radio"
                name="cond"
                checked={f.condutorMesmo === "nao"}
                onChange={() => up("condutorMesmo", "nao")}
              />{" "}
              Não
            </label>
          </div>
        </div>
        {f.condutorMesmo === "nao" && (
          <>
            <div className="field-group">
              <label>CPF do condutor</label>
              <input
                className="input"
                value={f.condCpf}
                inputMode="numeric"
                maxLength={14}
                onChange={(e) => up("condCpf", maskCpfCnpj(e.target.value))}
                placeholder="000.000.000-00"
              />
              {erros.condCpf && (
                <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                  {erros.condCpf}
                </span>
              )}
            </div>
            <div className="field-group full">
              <label>Nome do condutor</label>
              <input
                className="input"
                value={f.condNome}
                maxLength={150}
                onChange={(e) => up("condNome", e.target.value)}
              />
              {erros.condNome && (
                <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                  {erros.condNome}
                </span>
              )}
            </div>
            <div className="field-group">
              <label>Nascimento</label>
              <input
                className="input"
                type="date"
                value={f.condNasc}
                onChange={(e) => up("condNasc", e.target.value)}
              />
            </div>
            <div className="field-group">
              <label>Sexo</label>
              <select
                className="input"
                value={f.condSexo}
                onChange={(e) => up("condSexo", e.target.value)}
              >
                <option value="">Selecione</option>
                <option>Masculino</option>
                <option>Feminino</option>
              </select>
            </div>
            <div className="field-group">
              <label>Estado civil</label>
              <select
                className="input"
                value={f.condEstadoCivil}
                onChange={(e) => up("condEstadoCivil", e.target.value)}
              >
                <option value="">Selecione</option>
                <option>Casado(a)</option>
                <option>Solteiro(a)</option>
                <option>Viúvo(a)</option>
                <option>Divorciado(a)</option>
                <option>União estável</option>
              </select>
            </div>
          </>
        )}
        <div className="field-group">
          <label>Profissão</label>
          <input
            className="input"
            value={f.profissao}
            maxLength={150}
            onChange={(e) => up("profissao", e.target.value)}
          />
          {erros.profissao && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.profissao}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>CEP de pernoite</label>
          <input
            className="input"
            value={f.cepPernoite}
            inputMode="numeric"
            maxLength={9}
            onChange={(e) => up("cepPernoite", maskCep(e.target.value))}
            placeholder="00000-000"
          />
          {erros.cepPernoite && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.cepPernoite}
            </span>
          )}
        </div>
        <div className="field-group full">
          <label>Garagem</label>
          <div className="row" style={{ gap: 18, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.garagemResid}
                onChange={(e) => up("garagemResid", e.target.checked)}
              />{" "}
              Residência
            </label>
            <label>
              <input
                type="checkbox"
                checked={f.garagemTrab}
                onChange={(e) => up("garagemTrab", e.target.checked)}
              />{" "}
              Trabalho
            </label>
            <label>
              <input
                type="checkbox"
                checked={f.garagemEsc}
                onChange={(e) => up("garagemEsc", e.target.checked)}
              />{" "}
              Escola/Faculdade
            </label>
          </div>
        </div>
        <div className="field-group">
          <label>Condutores entre 18-25 anos?</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="radio"
                name="j1825"
                checked={f.jovens1825 === "sim"}
                onChange={() => up("jovens1825", "sim")}
              />{" "}
              Sim
            </label>
            <label>
              <input
                type="radio"
                name="j1825"
                checked={f.jovens1825 === "nao"}
                onChange={() => up("jovens1825", "nao")}
              />{" "}
              Não
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
