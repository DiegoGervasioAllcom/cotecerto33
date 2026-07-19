import { onlyDigits, maskCpfCnpj } from "@/lib/masks";
import { maskCel, maskFixo, maskCep } from "@/components/venda/novo-lead/masks";
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
            Nome<span className="req">*</span>
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
          <label>Nome social</label>
          <input
            className="input"
            value={f.nomeSocial}
            maxLength={150}
            onChange={(e) => up("nomeSocial", e.target.value)}
            placeholder="Opcional"
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
                className={"chip " + (f.sexo === s ? "chip-slate" : "chip-outline")}
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
        <div className="field-group">
          <label>Telefone residencial</label>
          <input
            className="input"
            value={f.telRes}
            inputMode="numeric"
            maxLength={14}
            onChange={(e) => up("telRes", maskFixo(e.target.value))}
            placeholder="(00) 0000-0000"
          />
          {erros.telRes && (
            <span className="hint" style={{ color: "var(--alert)", display: "block" }}>
              {erros.telRes}
            </span>
          )}
        </div>
        <div className="field-group full">
          <label>E-mail</label>
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
          <label>Logradouro</label>
          <input
            className="input"
            value={f.logradouro}
            maxLength={2000}
            onChange={(e) => up("logradouro", e.target.value)}
            placeholder="Preenche via CEP"
          />
        </div>
        <div className="field-group">
          <label>Bairro</label>
          <input
            className="input"
            value={f.bairro}
            maxLength={2000}
            onChange={(e) => up("bairro", e.target.value)}
            placeholder="Preenche via CEP"
          />
        </div>
        <div className="field-group">
          <label>Cidade</label>
          <input
            className="input"
            value={f.cidade}
            maxLength={150}
            onChange={(e) => up("cidade", e.target.value)}
            placeholder="Preenche via CEP"
          />
        </div>
        <div className="field-group">
          <label>UF</label>
          <input
            className="input"
            value={f.uf}
            maxLength={2}
            onChange={(e) => up("uf", e.target.value.toUpperCase())}
            placeholder="UF"
          />
        </div>
        <div className="field-group">
          <label>Autorizo o envio por SMS</label>
          <div className="row" style={{ gap: 14, paddingTop: 6 }}>
            <label>
              <input
                type="radio"
                name="sms"
                checked={f.sms === "sim"}
                onChange={() => up("sms", "sim")}
              />{" "}
              Sim
            </label>
            <label>
              <input
                type="radio"
                name="sms"
                checked={f.sms === "nao"}
                onChange={() => up("sms", "nao")}
              />{" "}
              Não
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
