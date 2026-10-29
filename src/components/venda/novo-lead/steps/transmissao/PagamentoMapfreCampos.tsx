import type { ContaDebito, ErrosContaDebito } from "@/lib/transmissao-debito";
import { AVISO_CARTAO_MAPFRE } from "@/lib/transmissao-mapfre";
import { PagamentoDebitoCampos } from "./PagamentoDebitoCampos";

type PropsDebito = {
  valor: ContaDebito;
  erros: ErrosContaDebito;
  bancos: readonly { readonly codigo: string; readonly nome: string }[];
  ciente: boolean;
  erroCiente?: string;
  onChange: <K extends keyof ContaDebito>(chave: K, valor: ContaDebito[K]) => void;
  onCiente: (valor: boolean) => void;
};

// Débito da Mapfre: banco, agência e conta + aceite de que o CPF/CNPJ pertence ao titular da conta. Dado sensível: só em memória.
export function PagamentoMapfreDebitoCampos({
  valor,
  erros,
  bancos,
  ciente,
  erroCiente,
  onChange,
  onCiente,
}: PropsDebito) {
  return (
    <>
      <PagamentoDebitoCampos valor={valor} erros={erros} bancos={bancos} onChange={onChange} />
      <div className="field-group" style={{ marginTop: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            id="mapfre-debito-ciente"
            type="checkbox"
            checked={ciente}
            aria-invalid={Boolean(erroCiente)}
            aria-describedby={erroCiente ? "mapfre-debito-ciente-erro" : undefined}
            onChange={(e) => onCiente(e.target.checked)}
          />
          <span>
            Estou ciente de que o CPF/CNPJ informado deve pertencer ao titular da conta.
            <span className="req">*</span>
          </span>
        </label>
        {erroCiente && (
          <span
            id="mapfre-debito-ciente-erro"
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

// Cartão da Mapfre: o portal não tem campos de cartão — o segurado recebe um link depois da efetivação.
export function PagamentoMapfreCartaoAviso() {
  return (
    <div className="clt-note" data-testid="pagamento-mapfre-cartao">
      <svg width="15" height="15">
        <use href="#i-info" />
      </svg>
      <div>{AVISO_CARTAO_MAPFRE}</div>
    </div>
  );
}
