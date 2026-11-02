import { useState } from "react";
import {
  ehCartaoYelum,
  ehDebitoYelum,
  validarContaYelum,
  type ContaYelum,
  type ErrosContaYelum,
} from "@/lib/transmissao-yelum";
import type { PagamentoTransmissao } from "@/lib/transmissao-pagamento";
import { PagamentoYelumCartaoAviso, PagamentoYelumDebitoCampos } from "./PagamentoYelumCampos";

type Props = {
  seguradora: string;
  formaPagamento: string;
  enviando: boolean;
  erroEnvio: string | null;
  onVoltar: () => void;
  onEfetivar: (pagamento?: PagamentoTransmissao) => void;
};

const CONTA_VAZIA: ContaYelum = { banco: "", agencia: "", conta: "" };

// Passo "Pagamento" da Yelum: débito (conta com dígito + aceite) e/ou aviso do cartão (sem dados de cartão). Boleto e PIX
// não pedem nada além dos campos obrigatórios. DADOS SENSÍVEIS: só no estado deste componente (somem ao sair do passo), não
// são gravados nem logados e seguem direto no body do fetch ao robô.
export function TransmissaoPagamentoYelum({
  seguradora,
  formaPagamento,
  enviando,
  erroEnvio,
  onVoltar,
  onEfetivar,
}: Props) {
  const debito = ehDebitoYelum(seguradora, formaPagamento);
  const cartao = ehCartaoYelum(seguradora, formaPagamento);
  const [conta, setConta] = useState<ContaYelum>(CONTA_VAZIA);
  const [erros, setErros] = useState<ErrosContaYelum>({});
  const [ciente, setCiente] = useState(false);
  const [erroCiente, setErroCiente] = useState<string | undefined>();

  function efetivar() {
    if (!debito) return onEfetivar();
    const e = validarContaYelum(conta);
    const faltaCiente = !ciente;
    setErros(e);
    setErroCiente(
      faltaCiente ? "Confirme que o CPF/CNPJ pertence ao titular da conta." : undefined,
    );
    if (Object.keys(e).length > 0 || faltaCiente) {
      const ids = [
        ...(["banco", "agencia", "conta"] as const).filter((k) => k in e).map((k) => `debito-${k}`),
        ...(faltaCiente ? ["yelum-debito-ciente"] : []),
      ];
      const primeiro = ids.find((id) => document.getElementById(id));
      if (primeiro) document.getElementById(primeiro)?.focus();
      return;
    }
    onEfetivar({ yelum: { contaDebito: conta, cienteTitularConta: true } });
  }

  const subtitulo = debito
    ? "Débito em conta · informe a conta que será debitada."
    : "Cartão de crédito · a cobrança é combinada pela seguradora com o segurado.";

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Pagamento</h2>
        <div className="sub" style={{ margin: "4px 0 0" }}>
          {subtitulo}
        </div>
      </div>

      {debito && (
        <PagamentoYelumDebitoCampos
          valor={conta}
          erros={erros}
          ciente={ciente}
          erroCiente={erroCiente}
          onChange={(k, v) => {
            setConta((a) => ({ ...a, [k]: v }));
            setErros((a) => ({ ...a, [k]: undefined }));
          }}
          onCiente={(v) => {
            setCiente(v);
            setErroCiente(undefined);
          }}
        />
      )}
      {cartao && (
        <div style={{ marginTop: debito ? 12 : 0 }}>
          <PagamentoYelumCartaoAviso />
        </div>
      )}

      {debito && (
        <div className="clt-note" style={{ marginTop: 12 }}>
          <svg width="15" height="15">
            <use href="#i-lock" />
          </svg>
          <div>
            Estes dados <strong>não são gravados</strong> pelo CoteCerto: seguem direto ao robô de
            transmissão.
          </div>
        </div>
      )}

      {erroEnvio && (
        <div className="clt-note" role="alert" style={{ marginTop: 14 }}>
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
