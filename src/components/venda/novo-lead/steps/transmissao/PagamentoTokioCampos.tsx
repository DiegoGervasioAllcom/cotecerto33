import {
  BANCOS_DEBITO_TOKIO,
  PARENTESCOS_TITULAR_TOKIO,
  RELACOES_CARTAO_TOKIO,
  type CartaoTokio,
  type DebitoTokio,
  type ErrosCartaoTokio,
  type ErrosDebitoTokio,
} from "@/lib/transmissao-tokio-pagamento";
import { CampoPagamento } from "./PagamentoCampo";

const DIAS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const semAutofill = { autoComplete: "off", spellCheck: false, autoCorrect: "off" } as const;

type PropsDebito = {
  valor: DebitoTokio;
  erros: ErrosDebitoTokio;
  onChange: <K extends keyof DebitoTokio>(chave: K, valor: DebitoTokio[K]) => void;
};

// Débito da Tokio: titular + conta. Dado financeiro/pessoal sensível: só em memória.
export function PagamentoTokioDebitoCampos({ valor, erros, onChange }: PropsDebito) {
  return (
    <div className="wizard-grid cols-3" data-testid="pagamento-tokio-debito">
      <CampoPagamento
        id="tokio-debito-banco"
        label="Banco"
        erro={erros.banco}
        style={{ gridColumn: "span 3" }}
      >
        <select
          id="tokio-debito-banco"
          className="input"
          autoComplete="off"
          value={valor.banco}
          aria-invalid={Boolean(erros.banco)}
          aria-describedby={erros.banco ? "tokio-debito-banco-erro" : undefined}
          onChange={(e) => onChange("banco", e.target.value)}
        >
          <option value="">Selecione</option>
          {BANCOS_DEBITO_TOKIO.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </CampoPagamento>
      <CampoPagamento id="tokio-debito-agencia" label="Agência" erro={erros.agencia}>
        <div className="row" style={{ gap: 8 }}>
          <input
            id="tokio-debito-agencia"
            className="input"
            inputMode="numeric"
            {...semAutofill}
            maxLength={4}
            placeholder="Sem dígito"
            value={valor.agencia}
            aria-invalid={Boolean(erros.agencia)}
            aria-describedby={erros.agencia ? "tokio-debito-agencia-erro" : undefined}
            onChange={(e) => onChange("agencia", e.target.value.replace(/\D/g, ""))}
          />
          <input
            id="tokio-debito-agencia-dv"
            className="input"
            style={{ maxWidth: 64 }}
            inputMode="numeric"
            {...semAutofill}
            maxLength={2}
            placeholder="DV"
            aria-label="Dígito da agência (opcional)"
            value={valor.agenciaDv}
            aria-invalid={Boolean(erros.agenciaDv)}
            onChange={(e) => onChange("agenciaDv", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {erros.agenciaDv && (
          <span className="small" style={{ color: "var(--alert)" }}>
            {erros.agenciaDv}
          </span>
        )}
      </CampoPagamento>
      <CampoPagamento id="tokio-debito-conta" label="Conta corrente" erro={erros.conta}>
        <input
          id="tokio-debito-conta"
          className="input"
          {...semAutofill}
          maxLength={11}
          placeholder="Ex.: 12345-6"
          value={valor.conta}
          aria-invalid={Boolean(erros.conta)}
          aria-describedby={erros.conta ? "tokio-debito-conta-erro" : undefined}
          onChange={(e) => onChange("conta", e.target.value.replace(/[^\dxX-]/g, ""))}
        />
      </CampoPagamento>
      <CampoPagamento id="tokio-debito-dia" label="Dia de vencimento" erro={erros.diaVencimento}>
        <select
          id="tokio-debito-dia"
          className="input"
          value={valor.diaVencimento}
          aria-invalid={Boolean(erros.diaVencimento)}
          aria-describedby={erros.diaVencimento ? "tokio-debito-dia-erro" : undefined}
          onChange={(e) => onChange("diaVencimento", e.target.value)}
        >
          <option value="">Selecione</option>
          {DIAS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </CampoPagamento>
      <CampoPagamento
        id="tokio-debito-titular"
        label="Titular da conta"
        erro={erros.titularNome}
        style={{ gridColumn: "span 2" }}
      >
        <input
          id="tokio-debito-titular"
          className="input"
          {...semAutofill}
          maxLength={100}
          value={valor.titularNome}
          aria-invalid={Boolean(erros.titularNome)}
          aria-describedby={erros.titularNome ? "tokio-debito-titular-erro" : undefined}
          onChange={(e) => onChange("titularNome", e.target.value)}
        />
      </CampoPagamento>
      <CampoPagamento
        id="tokio-debito-titular-doc"
        label="CPF/CNPJ do titular"
        erro={erros.titularDocumento}
      >
        <input
          id="tokio-debito-titular-doc"
          className="input"
          inputMode="numeric"
          {...semAutofill}
          maxLength={18}
          value={valor.titularDocumento}
          aria-invalid={Boolean(erros.titularDocumento)}
          aria-describedby={erros.titularDocumento ? "tokio-debito-titular-doc-erro" : undefined}
          onChange={(e) => onChange("titularDocumento", e.target.value.replace(/[^\d./-]/g, ""))}
        />
      </CampoPagamento>
      <CampoPagamento id="tokio-debito-parentesco" label="Parentesco" erro={erros.parentesco}>
        <select
          id="tokio-debito-parentesco"
          className="input"
          value={valor.parentesco}
          aria-invalid={Boolean(erros.parentesco)}
          aria-describedby={erros.parentesco ? "tokio-debito-parentesco-erro" : undefined}
          onChange={(e) => onChange("parentesco", e.target.value)}
        >
          <option value="">Selecione</option>
          {PARENTESCOS_TITULAR_TOKIO.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </CampoPagamento>
      <div className="field-group">
        <label htmlFor="tokio-debito-primeira">Primeira parcela no débito?</label>
        <select
          id="tokio-debito-primeira"
          className="input"
          value={valor.primeiraParcelaDebito}
          onChange={(e) =>
            onChange(
              "primeiraParcelaDebito",
              e.target.value as DebitoTokio["primeiraParcelaDebito"],
            )
          }
        >
          <option value="">Padrão do portal</option>
          <option>Sim</option>
          <option>Não</option>
        </select>
      </div>
      <div className="field-group" style={{ gridColumn: "span 3" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            id="tokio-debito-ciente"
            type="checkbox"
            checked={valor.ciente}
            aria-invalid={Boolean(erros.ciente)}
            aria-describedby={erros.ciente ? "tokio-debito-ciente-erro" : undefined}
            onChange={(e) => onChange("ciente", e.target.checked)}
          />
          <span>
            Estou ciente de que o CPF/CNPJ informado deve pertencer ao titular da conta indicada
            para débito.<span className="req">*</span>
          </span>
        </label>
        {erros.ciente && (
          <span
            id="tokio-debito-ciente-erro"
            role="alert"
            className="small"
            style={{ color: "var(--alert)" }}
          >
            {erros.ciente}
          </span>
        )}
      </div>
    </div>
  );
}

type PropsCartao = {
  valor: CartaoTokio;
  erros: ErrosCartaoTokio;
  onChange: <K extends keyof CartaoTokio>(chave: K, valor: CartaoTokio[K]) => void;
};

// Cartão da Tokio: a Efetivação NÃO tem número/validade — só como pagar.
export function PagamentoTokioCartaoCampos({ valor, erros, onChange }: PropsCartao) {
  return (
    <div className="wizard-grid cols-3" data-testid="pagamento-tokio-cartao">
      <CampoPagamento
        id="tokio-cartao-envio"
        label="Como o cartão será informado"
        erro={erros.envio}
      >
        <select
          id="tokio-cartao-envio"
          className="input"
          value={valor.envio}
          aria-invalid={Boolean(erros.envio)}
          aria-describedby={erros.envio ? "tokio-cartao-envio-erro" : undefined}
          onChange={(e) => onChange("envio", e.target.value as CartaoTokio["envio"])}
        >
          <option value="tela">Na tela da seguradora (agora)</option>
          <option value="link">Pelo segurado, via link de pagamento</option>
        </select>
      </CampoPagamento>
      <CampoPagamento
        id="tokio-cartao-dia"
        label="Dia de vencimento da fatura"
        erro={erros.diaFatura}
      >
        <select
          id="tokio-cartao-dia"
          className="input"
          value={valor.diaFatura}
          aria-invalid={Boolean(erros.diaFatura)}
          aria-describedby={erros.diaFatura ? "tokio-cartao-dia-erro" : undefined}
          onChange={(e) => onChange("diaFatura", e.target.value)}
        >
          <option value="">Selecione</option>
          {DIAS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </CampoPagamento>
      <div className="field-group">
        <label htmlFor="tokio-cartao-relacao">Relação do proprietário do cartão</label>
        <select
          id="tokio-cartao-relacao"
          className="input"
          value={valor.relacaoProprietario}
          onChange={(e) => onChange("relacaoProprietario", e.target.value)}
        >
          <option value="">Não informar</option>
          {RELACOES_CARTAO_TOKIO.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      {valor.envio === "link" && (
        <CampoPagamento
          id="tokio-cartao-cpf-link"
          label="CPF do responsável pelo link"
          erro={erros.cpfResponsavelLink}
        >
          <input
            id="tokio-cartao-cpf-link"
            className="input"
            inputMode="numeric"
            {...semAutofill}
            maxLength={14}
            value={valor.cpfResponsavelLink}
            aria-invalid={Boolean(erros.cpfResponsavelLink)}
            aria-describedby={erros.cpfResponsavelLink ? "tokio-cartao-cpf-link-erro" : undefined}
            onChange={(e) => onChange("cpfResponsavelLink", e.target.value.replace(/[^\d.-]/g, ""))}
          />
        </CampoPagamento>
      )}
    </div>
  );
}
