import { onlyDigits, maskCpfCnpj } from "@/lib/masks";
import { maskCel, maskCep } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  erros: Record<string, string>;
  cepLoading: boolean;
  lookupCep: (cep: string) => void;
};

export function StepSegurado({ f, up, erros, cepLoading, lookupCep }: Props) {
  return (
    <>
      <h2>Dados do Segurado</h2>
      <div className="sub">
        Digite o CPF/CNPJ que o sistema busca o cadastro. Se for novo, preenche o resto manualmente.
      </div>
      <div className="wizard-grid">
        <div className="field-group">
          <label>
            CPF ou CNPJ<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.cpf}
            inputMode="numeric"
            maxLength={18}
            onChange={(e) => up("cpf", maskCpfCnpj(e.target.value))}
            placeholder="000.000.000-00"
          />
          {erros.cpf && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.cpf}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Pessoa</label>
          <select className="input" value={f.pessoa} onChange={(e) => up("pessoa", e.target.value)}>
            <option>Física</option>
            <option>Jurídica</option>
          </select>
        </div>
        <div className="field-group full">
          <label>
            Nome completo<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.nome}
            maxLength={150}
            onChange={(e) => up("nome", e.target.value)}
            placeholder="Nome completo"
          />
          {erros.nome && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.nome}
            </span>
          )}
        </div>
        <div className="field-group full">
          <label>
            Nome social<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.nomeSocial}
            maxLength={150}
            onChange={(e) => up("nomeSocial", e.target.value)}
            placeholder="Nome e sobrenome"
          />
          {erros.nomeSocial && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.nomeSocial}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>
            Data de nascimento<span className="req">*</span>
          </label>
          <input
            className="input"
            type="date"
            value={f.nasc}
            onChange={(e) => up("nasc", e.target.value)}
          />
        </div>
        <div className="field-group">
          <label>
            Sexo<span className="req">*</span>
          </label>
          <div className="row" style={{ gap: 8, paddingTop: 4 }}>
            {["Masculino", "Feminino"].map((s) => (
              <span
                key={s}
                className={"chip " + (f.sexo === s ? "chip-yellow" : "chip-outline")}
                style={{ cursor: "pointer" }}
                onClick={() => up("sexo", s)}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="field-group">
          <label>
            Estado civil<span className="req">*</span>
          </label>
          <select
            className="input"
            value={f.estadoCivil}
            onChange={(e) => up("estadoCivil", e.target.value)}
          >
            <option value="">Selecione</option>
            <option>Casado(a)</option>
            <option>Solteiro(a)</option>
            <option>Viúvo(a)</option>
            <option>Divorciado(a)</option>
            <option>Separado(a)</option>
            <option>União estável</option>
          </select>
        </div>
        <div className="field-group">
          <label>
            Telefone celular<span className="req">*</span> <span className="hint">WhatsApp</span>
          </label>
          <input
            className="input"
            value={f.celular}
            inputMode="numeric"
            maxLength={15}
            onChange={(e) => up("celular", maskCel(e.target.value))}
            placeholder="(00) 00000-0000"
          />
          {erros.celular && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.celular}
            </span>
          )}
        </div>
        <div className="field-group full">
          <label>
            E-mail<span className="req">*</span>
          </label>
          <input
            className="input"
            type="email"
            value={f.email}
            maxLength={254}
            onChange={(e) => up("email", e.target.value)}
            placeholder="cliente@email.com"
          />
          {erros.email && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.email}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>
            CEP residencial<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.cep}
            inputMode="numeric"
            maxLength={9}
            onChange={(e) => {
              const v = maskCep(e.target.value);
              up("cep", v);
              if (onlyDigits(v).length === 8) lookupCep(v);
            }}
            onBlur={() => lookupCep(f.cep)}
            placeholder="00000-000"
          />
          {cepLoading && <span className="hint">Buscando CEP…</span>}
          {erros.cep && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.cep}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>
            Número<span className="req">*</span>
          </label>
          <input
            className="input"
            value={f.numero}
            maxLength={20}
            onChange={(e) => up("numero", e.target.value)}
            placeholder="Nº"
          />
          {erros.numero && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.numero}
            </span>
          )}
        </div>
        <div className="field-group">
          <label>Cidade / UF</label>
          <input
            className="input"
            value={f.cidade ? `${f.cidade} / ${f.uf}` : ""}
            readOnly
            style={{ background: "var(--offwhite)" }}
            placeholder="Preenche via CEP"
          />
        </div>
      </div>
    </>
  );
}
