import {
  BANDEIRAS_CARTAO,
  LIMITE_TITULAR_CARTAO,
  formatarNumeroCartao,
  mascararValidade,
  type BandeiraCartao,
  type CartaoTransmissao,
  type ErrosCartao,
} from "@/lib/transmissao-cartao";
import { CampoPagamento } from "./PagamentoCampo";

type Props = {
  valor: CartaoTransmissao;
  erros: ErrosCartao;
  /** Bandeiras do portal da seguradora (padrão: todas; a Allianz não tem Diners). */
  bandeiras?: readonly BandeiraCartao[];
  onChange: <K extends keyof CartaoTransmissao>(chave: K, valor: CartaoTransmissao[K]) => void;
};

// Campos do cartão de crédito (Porto). Dado financeiro sensível (PCI): só em
// memória; não pedimos o código de segurança (o portal não pede).
export function PagamentoCartaoCampos({
  valor,
  erros,
  bandeiras = BANDEIRAS_CARTAO,
  onChange,
}: Props) {
  return (
    <div className="wizard-grid cols-3" data-testid="pagamento-cartao">
      <CampoPagamento
        id="cartao-numero"
        label="Número do cartão"
        erro={erros.numero}
        style={{ gridColumn: "span 2" }}
      >
        <input
          id="cartao-numero"
          className="input"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          maxLength={19}
          placeholder="0000 0000 0000 0000"
          value={formatarNumeroCartao(valor.numero)}
          aria-invalid={Boolean(erros.numero)}
          aria-describedby={erros.numero ? "cartao-numero-erro" : undefined}
          onChange={(e) => onChange("numero", e.target.value.replace(/\D/g, "").slice(0, 16))}
        />
      </CampoPagamento>
      <CampoPagamento id="cartao-bandeira" label="Bandeira" erro={erros.bandeira}>
        <select
          id="cartao-bandeira"
          className="input"
          autoComplete="off"
          value={valor.bandeira}
          aria-invalid={Boolean(erros.bandeira)}
          aria-describedby={erros.bandeira ? "cartao-bandeira-erro" : undefined}
          onChange={(e) => onChange("bandeira", e.target.value as CartaoTransmissao["bandeira"])}
        >
          <option value="">Selecione</option>
          {bandeiras.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </CampoPagamento>
      <CampoPagamento
        id="cartao-titular"
        label={`Nome do titular (até ${LIMITE_TITULAR_CARTAO} caracteres)`}
        erro={erros.nomeTitular}
        style={{ gridColumn: "span 2" }}
      >
        <input
          id="cartao-titular"
          className="input"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          maxLength={LIMITE_TITULAR_CARTAO}
          placeholder="Como está no cartão"
          value={valor.nomeTitular}
          aria-invalid={Boolean(erros.nomeTitular)}
          aria-describedby={erros.nomeTitular ? "cartao-titular-erro" : undefined}
          onChange={(e) => onChange("nomeTitular", e.target.value)}
        />
      </CampoPagamento>
      <CampoPagamento id="cartao-validade" label="Validade" erro={erros.validade}>
        <input
          id="cartao-validade"
          className="input"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          maxLength={7}
          placeholder="MM/AAAA"
          value={valor.validade}
          aria-invalid={Boolean(erros.validade)}
          aria-describedby={erros.validade ? "cartao-validade-erro" : undefined}
          onChange={(e) => onChange("validade", mascararValidade(e.target.value))}
        />
      </CampoPagamento>
    </div>
  );
}
