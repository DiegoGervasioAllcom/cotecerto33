import { BANCOS_DEBITO_PORTO } from "@/components/venda/novo-lead/enumsBancosDebito";
import type { ContaDebito, ErrosContaDebito } from "@/lib/transmissao-debito";
import { CampoPagamento } from "./PagamentoCampo";

type Props = {
  valor: ContaDebito;
  erros: ErrosContaDebito;
  /** Bancos do select do portal da seguradora (padrão: os da Porto). */
  bancos?: readonly { readonly codigo: string; readonly nome: string }[];
  onChange: <K extends keyof ContaDebito>(chave: K, valor: ContaDebito[K]) => void;
};

// Campos do débito em conta (Porto). Dado financeiro sensível: só em memória.
export function PagamentoDebitoCampos({
  valor,
  erros,
  bancos = BANCOS_DEBITO_PORTO,
  onChange,
}: Props) {
  return (
    <div className="wizard-grid cols-3" data-testid="pagamento-debito">
      <CampoPagamento
        id="debito-banco"
        label="Banco"
        erro={erros.banco}
        style={{ gridColumn: "span 3" }}
      >
        <select
          id="debito-banco"
          className="input"
          autoComplete="off"
          value={valor.banco}
          aria-invalid={Boolean(erros.banco)}
          aria-describedby={erros.banco ? "debito-banco-erro" : undefined}
          onChange={(e) => onChange("banco", e.target.value)}
        >
          <option value="">Selecione</option>
          {bancos.map((b) => (
            <option key={b.codigo} value={b.codigo}>
              {b.codigo} · {b.nome}
            </option>
          ))}
        </select>
      </CampoPagamento>
      <CampoPagamento id="debito-agencia" label="Agência" erro={erros.agencia}>
        <input
          id="debito-agencia"
          className="input"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          maxLength={6}
          placeholder="Sem dígito"
          value={valor.agencia}
          aria-invalid={Boolean(erros.agencia)}
          aria-describedby={erros.agencia ? "debito-agencia-erro" : undefined}
          onChange={(e) => onChange("agencia", e.target.value.replace(/\D/g, ""))}
        />
      </CampoPagamento>
      <CampoPagamento id="debito-conta" label="Conta corrente" erro={erros.conta}>
        <input
          id="debito-conta"
          className="input"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          maxLength={11}
          placeholder="Ex.: 12345-6"
          value={valor.conta}
          aria-invalid={Boolean(erros.conta)}
          aria-describedby={erros.conta ? "debito-conta-erro" : undefined}
          onChange={(e) => onChange("conta", e.target.value.replace(/[^\dxX-]/g, ""))}
        />
      </CampoPagamento>
    </div>
  );
}
