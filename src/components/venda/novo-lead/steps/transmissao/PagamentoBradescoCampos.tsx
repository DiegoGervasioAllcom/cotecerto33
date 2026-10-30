import {
  OPCOES_CREDITO_EM_CONTA,
  type ContaBradesco,
  type ErrosContaBradesco,
  type OpcaoCreditoEmConta,
} from "@/lib/transmissao-bradesco";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";
import { CampoPagamento } from "./PagamentoCampo";

type PropsConta = {
  /** Prefixo dos ids ("debito" | "credito"): `${prefixo}-banco`, `-agencia`, `-agencia-dv`, `-conta`. */
  prefixo: string;
  valor: ContaBradesco;
  erros: ErrosContaBradesco;
  onChange: <K extends keyof ContaBradesco>(chave: K, valor: ContaBradesco[K]) => void;
};

// Conta bancária da Bradesco (débito e crédito em conta): banco, agência, dígito da agência (opcional) e conta com dígito.
// Dado financeiro sensível: só em memória, sem autocomplete.
export function PagamentoBradescoContaCampos({ prefixo, valor, erros, onChange }: PropsConta) {
  const id = (s: string) => `${prefixo}-${s}`;
  const aria = (chave: keyof ErrosContaBradesco, idCampo: string) => ({
    "aria-invalid": Boolean(erros[chave]),
    "aria-describedby": erros[chave] ? `${idCampo}-erro` : undefined,
  });
  const comum = { autoComplete: "off", spellCheck: false, autoCorrect: "off" } as const;
  return (
    <div className="wizard-grid cols-3" data-testid={`pagamento-bradesco-${prefixo}`}>
      <CampoPagamento
        id={id("banco")}
        label="Banco"
        erro={erros.banco}
        style={{ gridColumn: "span 3" }}
      >
        <select
          id={id("banco")}
          className="input"
          autoComplete="off"
          value={valor.banco}
          {...aria("banco", id("banco"))}
          onChange={(e) => onChange("banco", e.target.value)}
        >
          <option value="">Selecione</option>
          {bancosDaSeguradora("bradesco").map((b) => (
            <option key={b.codigo} value={b.codigo}>
              {b.codigo} · {b.nome}
            </option>
          ))}
        </select>
      </CampoPagamento>
      <CampoPagamento id={id("agencia")} label="Agência" erro={erros.agencia}>
        <input
          id={id("agencia")}
          className="input"
          inputMode="numeric"
          {...comum}
          maxLength={6}
          placeholder="Sem dígito"
          value={valor.agencia}
          {...aria("agencia", id("agencia"))}
          onChange={(e) => onChange("agencia", e.target.value.replace(/\D/g, ""))}
        />
      </CampoPagamento>
      <div className="field-group">
        <label htmlFor={id("agencia-dv")}>Dígito da agência (opcional)</label>
        <input
          id={id("agencia-dv")}
          className="input"
          inputMode="numeric"
          {...comum}
          maxLength={2}
          value={valor.agenciaDv ?? ""}
          {...aria("agenciaDv", id("agencia-dv"))}
          onChange={(e) => onChange("agenciaDv", e.target.value.replace(/\D/g, ""))}
        />
        {erros.agenciaDv && (
          <span
            id={`${id("agencia-dv")}-erro`}
            role="alert"
            className="small"
            style={{ color: "var(--alert)" }}
          >
            {erros.agenciaDv}
          </span>
        )}
      </div>
      <CampoPagamento id={id("conta")} label="Conta com dígito" erro={erros.conta}>
        <input
          id={id("conta")}
          className="input"
          {...comum}
          maxLength={11}
          placeholder="Ex.: 12345-6"
          value={valor.conta}
          {...aria("conta", id("conta"))}
          onChange={(e) => onChange("conta", e.target.value.replace(/[^\dxX-]/g, ""))}
        />
      </CampoPagamento>
    </div>
  );
}

type PropsCiente = { ciente: boolean; erro?: string; onCiente: (valor: boolean) => void };

/** Aceite do débito: o CPF/CNPJ informado deve pertencer ao titular da conta. */
export function PagamentoBradescoCiente({ ciente, erro, onCiente }: PropsCiente) {
  return (
    <div className="field-group" style={{ marginTop: 12 }}>
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <input
          id="bradesco-debito-ciente"
          type="checkbox"
          checked={ciente}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? "bradesco-debito-ciente-erro" : undefined}
          onChange={(e) => onCiente(e.target.checked)}
        />
        <span>
          Estou ciente de que o CPF/CNPJ informado deve pertencer ao titular da conta.
          <span className="req">*</span>
        </span>
      </label>
      {erro && (
        <span
          id="bradesco-debito-ciente-erro"
          role="alert"
          className="small"
          style={{ color: "var(--alert)" }}
        >
          {erro}
        </span>
      )}
    </div>
  );
}

type PropsCredito = {
  opcao: OpcaoCreditoEmConta;
  onOpcao: (opcao: OpcaoCreditoEmConta) => void;
};

/** Pergunta do portal: "Autorizo crédito em minha conta para eventuais devoluções de valores". Padrão: Não. */
export function PagamentoBradescoCreditoOpcao({ opcao, onOpcao }: PropsCredito) {
  return (
    <div className="field-group" style={{ marginTop: 16 }}>
      <label htmlFor="bradesco-credito-opcao">
        Autorizo crédito em minha conta para eventuais devoluções de valores
      </label>
      <select
        id="bradesco-credito-opcao"
        className="input"
        value={opcao}
        onChange={(e) => onOpcao(e.target.value as OpcaoCreditoEmConta)}
      >
        {OPCOES_CREDITO_EM_CONTA.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
