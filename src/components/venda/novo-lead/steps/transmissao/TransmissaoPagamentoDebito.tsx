import { useState } from "react";
import { BANCOS_DEBITO_PORTO } from "@/components/venda/novo-lead/enumsBancosDebito";
import {
  validarContaDebito,
  type ContaDebito,
  type ErrosContaDebito,
} from "@/lib/transmissao-debito";

type Props = {
  enviando: boolean;
  erroEnvio: string | null;
  onVoltar: () => void;
  onEfetivar: (conta: ContaDebito) => void;
};

// Passo "Pagamento" do débito em conta (Porto). Dado financeiro sensível: fica
// só no estado deste componente (some ao sair do passo), não é gravado, não é
// logado e segue direto no body do fetch ao robô — o robô o digita no portal.
export function TransmissaoPagamentoDebito({ enviando, erroEnvio, onVoltar, onEfetivar }: Props) {
  const [conta, setConta] = useState<ContaDebito>({ banco: "", agencia: "", conta: "" });
  const [erros, setErros] = useState<ErrosContaDebito>({});

  function up<K extends keyof ContaDebito>(chave: K, valor: ContaDebito[K]) {
    setConta((atual) => ({ ...atual, [chave]: valor }));
    setErros((atual) => ({ ...atual, [chave]: undefined }));
  }

  function efetivar() {
    const proximos = validarContaDebito(conta);
    if (Object.keys(proximos).length > 0) {
      setErros(proximos);
      return;
    }
    onEfetivar(conta);
  }

  const erro = (chave: keyof ContaDebito) =>
    erros[chave] ? (
      <span
        id={`debito-${chave}-erro`}
        role="alert"
        className="small"
        style={{ color: "var(--alert)" }}
      >
        {erros[chave]}
      </span>
    ) : null;

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Pagamento</h2>
        <div className="sub" style={{ margin: "4px 0 0" }}>
          Débito em conta · informe a conta que será debitada.
        </div>
      </div>

      <div className="wizard-grid cols-3" data-testid="transmissao-debito">
        <div className="field-group full" style={{ gridColumn: "span 3" }}>
          <label htmlFor="debito-banco">
            Banco<span className="req">*</span>
          </label>
          <select
            id="debito-banco"
            className="input"
            autoComplete="off"
            value={conta.banco}
            aria-invalid={Boolean(erros.banco)}
            aria-describedby={erros.banco ? "debito-banco-erro" : undefined}
            onChange={(e) => up("banco", e.target.value)}
          >
            <option value="">Selecione</option>
            {BANCOS_DEBITO_PORTO.map((b) => (
              <option key={b.codigo} value={b.codigo}>
                {b.codigo} · {b.nome}
              </option>
            ))}
          </select>
          {erro("banco")}
        </div>
        <div className="field-group">
          <label htmlFor="debito-agencia">
            Agência<span className="req">*</span>
          </label>
          <input
            id="debito-agencia"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            placeholder="Sem dígito"
            value={conta.agencia}
            aria-invalid={Boolean(erros.agencia)}
            aria-describedby={erros.agencia ? "debito-agencia-erro" : undefined}
            onChange={(e) => up("agencia", e.target.value.replace(/\D/g, ""))}
          />
          {erro("agencia")}
        </div>
        <div className="field-group">
          <label htmlFor="debito-conta">
            Conta corrente<span className="req">*</span>
          </label>
          <input
            id="debito-conta"
            className="input"
            autoComplete="off"
            maxLength={11}
            placeholder="Ex.: 12345-6"
            value={conta.conta}
            aria-invalid={Boolean(erros.conta)}
            aria-describedby={erros.conta ? "debito-conta-erro" : undefined}
            onChange={(e) => up("conta", e.target.value.replace(/[^\dxX-]/g, ""))}
          />
          {erro("conta")}
        </div>
      </div>

      <div className="clt-note" style={{ marginTop: 12 }}>
        <svg width="15" height="15">
          <use href="#i-lock" />
        </svg>
        <div>
          Os dados bancários <strong>não ficam guardados</strong> no CoteCerto: seguem direto ao
          robô de transmissão e não aparecem em histórico nem em log.
        </div>
      </div>

      {erroEnvio && (
        <div className="clt-note" style={{ marginTop: 14 }}>
          {erroEnvio}
        </div>
      )}

      <div className="wizard-foot">
        <button className="btn btn-ghost" type="button" onClick={onVoltar} disabled={enviando}>
          <svg width="14" height="14">
            <use href="#i-chevron-left" />
          </svg>{" "}
          Voltar
        </button>
        <span className="spacer" />
        <button
          className="btn btn-yellow"
          type="button"
          data-tour="transmissao-efetivar"
          onClick={efetivar}
          disabled={enviando}
        >
          <svg width="14" height="14">
            <use href="#i-check" />
          </svg>{" "}
          {enviando ? "Transmitindo…" : "Efetivar proposta"}
        </button>
      </div>
    </>
  );
}
