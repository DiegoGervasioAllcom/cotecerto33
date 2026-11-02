import type { ContaYelum, ErrosContaYelum } from "@/lib/transmissao-yelum";
import { AVISO_CARTAO_YELUM, AVISO_CONTA_DO_SEGURADO } from "@/lib/transmissao-yelum";
import { bancosDaSeguradora } from "@/lib/transmissao-debito";
import { PagamentoDebitoCampos } from "./PagamentoDebitoCampos";

type PropsDebito = {
  valor: ContaYelum;
  erros: ErrosContaYelum;
  ciente: boolean;
  erroCiente?: string;
  onChange: <K extends keyof ContaYelum>(chave: K, valor: ContaYelum[K]) => void;
  onCiente: (valor: boolean) => void;
};

// Débito da Yelum: banco, agência e conta COM o dígito + aceite de que o CPF/CNPJ pertence ao titular. O titular é sempre o
// próprio segurado (o robô lê da tela). Sem dígito da agência. Dado sensível: só em memória.
export function PagamentoYelumDebitoCampos({
  valor,
  erros,
  ciente,
  erroCiente,
  onChange,
  onCiente,
}: PropsDebito) {
  return (
    <>
      <PagamentoDebitoCampos
        valor={valor}
        erros={erros}
        bancos={bancosDaSeguradora("yelum")}
        contaMaxLength={11}
        onChange={onChange}
      />
      <div className="clt-note" style={{ marginTop: 12 }} data-testid="yelum-conta-segurado">
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>{AVISO_CONTA_DO_SEGURADO}</div>
      </div>
      <div className="field-group" style={{ marginTop: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            id="yelum-debito-ciente"
            type="checkbox"
            checked={ciente}
            aria-invalid={Boolean(erroCiente)}
            aria-describedby={erroCiente ? "yelum-debito-ciente-erro" : undefined}
            onChange={(e) => onCiente(e.target.checked)}
          />
          <span>
            Estou ciente de que o CPF/CNPJ informado deve pertencer ao titular da conta.
            <span className="req">*</span>
          </span>
        </label>
        {erroCiente && (
          <span
            id="yelum-debito-ciente-erro"
            role="alert"
            className="small"
            style={{ color: "var(--alert)" }}
          >
            {erroCiente}
          </span>
        )}
      </div>
    </>
  );
}

// Cartão da Yelum: o portal não tem campos de cartão — a cobrança é combinada pela seguradora com o segurado.
export function PagamentoYelumCartaoAviso() {
  return (
    <div className="clt-note" data-testid="pagamento-yelum-cartao">
      <svg width="15" height="15">
        <use href="#i-info" />
      </svg>
      <div>{AVISO_CARTAO_YELUM}</div>
    </div>
  );
}
