import { maskBRL } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  erros: Record<string, string>;
};

export function StepCoberturas({ f, up, erros }: Props) {
  return (
    <>
      <h2>Coberturas</h2>
      <div className="sub">Defina o tipo de cobertura, casco, franquia e adicionais.</div>
      <div className="wizard-grid">
        <div className="field-group full">
          <label>
            Tipo de cobertura<span className="req">*</span>
          </label>
          <div className="row" style={{ gap: 8, paddingTop: 4, flexWrap: "wrap" }}>
            {["Compreensiva", "Incêndio + Roubo", "RCF"].map((t) => (
              <span
                key={t}
                className={"chip " + (f.tipoCobertura === t ? "chip-yellow" : "chip-outline")}
                style={{ cursor: "pointer" }}
                onClick={() => up("tipoCobertura", t)}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="field-group">
          <label>Casco</label>
          <select className="input" value={f.casco} onChange={(e) => up("casco", e.target.value)}>
            <option>100% Tabela FIPE</option>
            <option>95% Tabela FIPE</option>
            <option>110% Tabela FIPE</option>
            <option>Valor determinado</option>
          </select>
        </div>
        {f.casco === "Valor determinado" && (
          <div className="field-group">
            <label>Valor determinado</label>
            <input
              className="input"
              value={f.cascoValor}
              maxLength={100}
              onChange={(e) => up("cascoValor", maskBRL(e.target.value))}
              placeholder="R$ 0,00"
            />
            {erros.cascoValor && (
              <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
                {erros.cascoValor}
              </span>
            )}
          </div>
        )}
        <div className="field-group">
          <label>Franquia</label>
          <select
            className="input"
            value={f.franquia}
            onChange={(e) => up("franquia", e.target.value)}
          >
            <option>Reduzida</option>
            <option>Normal</option>
            <option>Majorada</option>
          </select>
        </div>
        <div className="field-group">
          <label>APP — Morte</label>
          <input
            className="input"
            value={f.appMorte}
            maxLength={100}
            onChange={(e) => up("appMorte", maskBRL(e.target.value))}
            placeholder="R$ 10.000,00"
          />
          {erros.appMorte && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.appMorte}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>APP — Invalidez</label>
          <input
            className="input"
            value={f.appInval}
            maxLength={100}
            onChange={(e) => up("appInval", maskBRL(e.target.value))}
            placeholder="R$ 10.000,00"
          />
          {erros.appInvalidez && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.appInvalidez}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>DMH (despesas médicas)</label>
          <input
            className="input"
            value={f.dmh}
            maxLength={100}
            onChange={(e) => up("dmh", maskBRL(e.target.value))}
            placeholder="R$ 5.000,00"
          />
          {erros.dmh && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.dmh}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>RCF — Danos materiais</label>
          <input
            className="input"
            value={f.rcfDm}
            maxLength={100}
            onChange={(e) => up("rcfDm", maskBRL(e.target.value))}
            placeholder="R$ 100.000,00"
          />
          {erros.rcfDm && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.rcfDm}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>RCF — Danos corporais</label>
          <input
            className="input"
            value={f.rcfDc}
            maxLength={100}
            onChange={(e) => up("rcfDc", maskBRL(e.target.value))}
            placeholder="R$ 100.000,00"
          />
          {erros.rcfDc && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.rcfDc}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Vidros</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="checkbox"
                checked={f.vidros}
                onChange={(e) => up("vidros", e.target.checked)}
              />{" "}
              Incluir cobertura
            </label>
          </div>
        </div>
        <div className="field-group">
          <label>Carro reserva</label>
          <select
            className="input"
            value={f.carroReserva}
            onChange={(e) => up("carroReserva", e.target.value)}
          >
            <option>Não</option>
            <option>7 dias</option>
            <option>15 dias</option>
            <option>30 dias</option>
          </select>
        </div>
        <div className="field-group">
          <label>Assistência 24h</label>
          <select
            className="input"
            value={f.assist24}
            onChange={(e) => up("assist24", e.target.value)}
          >
            <option>Básica</option>
            <option>Intermediária</option>
            <option>Premium</option>
          </select>
        </div>
      </div>
    </>
  );
}
