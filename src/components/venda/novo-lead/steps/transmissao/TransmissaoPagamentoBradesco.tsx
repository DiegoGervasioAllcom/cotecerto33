import { useState } from "react";
import {
  validarCartao,
  type CartaoTransmissao,
  type ErrosCartao,
  BANDEIRAS_BRADESCO,
} from "@/lib/transmissao-cartao";
import {
  AVISO_FORMA_NAO_SUPORTADA_BRADESCO,
  CONTA_BRADESCO_VAZIA,
  creditoEmContaAtivo,
  ehCartaoBradesco,
  ehDebitoBradesco,
  ehFormaNaoSuportadaBradesco,
  validarContaBradesco,
  type ContaBradesco,
  type ErrosContaBradesco,
  type OpcaoCreditoEmConta,
} from "@/lib/transmissao-bradesco";
import type { PagamentoTransmissao } from "@/lib/transmissao-pagamento";
import { PagamentoCartaoCampos } from "./PagamentoCartaoCampos";
import {
  PagamentoBradescoCiente,
  PagamentoBradescoContaCampos,
  PagamentoBradescoCreditoOpcao,
} from "./PagamentoBradescoCampos";

type Props = {
  seguradora: string;
  formaPagamento: string;
  enviando: boolean;
  erroEnvio: string | null;
  onVoltar: () => void;
  onEfetivar: (pagamento?: PagamentoTransmissao) => void;
};

const CARTAO_VAZIO: CartaoTransmissao = { nomeTitular: "", bandeira: "", numero: "", validade: "" };

// Passo "Pagamento" da Bradesco: débito (conta + aceite), cartão de crédito e a pergunta de crédito em conta para
// devoluções (vale para qualquer forma). DADOS SENSÍVEIS: só no estado deste componente (somem ao sair do passo), não são
// gravados nem logados e seguem direto no body do fetch ao robô.
export function TransmissaoPagamentoBradesco({
  seguradora,
  formaPagamento,
  enviando,
  erroEnvio,
  onVoltar,
  onEfetivar,
}: Props) {
  const debito = ehDebitoBradesco(seguradora, formaPagamento);
  const cartao = ehCartaoBradesco(seguradora, formaPagamento);
  const naoSuportada = ehFormaNaoSuportadaBradesco(seguradora, formaPagamento);
  const [contaDebito, setContaDebito] = useState<ContaBradesco>(CONTA_BRADESCO_VAZIA);
  const [errosDebito, setErrosDebito] = useState<ErrosContaBradesco>({});
  const [ciente, setCiente] = useState(false);
  const [erroCiente, setErroCiente] = useState<string | undefined>();
  const [dadosCartao, setDadosCartao] = useState<CartaoTransmissao>(CARTAO_VAZIO);
  const [errosCartao, setErrosCartao] = useState<ErrosCartao>({});
  const [opcaoCredito, setOpcaoCredito] = useState<OpcaoCreditoEmConta>("Não");
  const [contaCredito, setContaCredito] = useState<ContaBradesco>(CONTA_BRADESCO_VAZIA);
  const [errosCredito, setErrosCredito] = useState<ErrosContaBradesco>({});

  function focar(ids: string[]) {
    const primeiro = ids.find((id) => document.getElementById(id));
    if (primeiro) document.getElementById(primeiro)?.focus();
  }
  const idsConta = (prefixo: string, erros: ErrosContaBradesco) =>
    (["banco", "agencia", "agenciaDv", "conta"] as const)
      .filter((k) => k in erros)
      .map((k) => `${prefixo}-${k === "agenciaDv" ? "agencia-dv" : k}`);

  function efetivar() {
    if (naoSuportada) return;
    const ed = debito ? validarContaBradesco(contaDebito) : {};
    const ec = cartao ? validarCartao(dadosCartao, undefined, BANDEIRAS_BRADESCO) : {};
    const comCredito = opcaoCredito !== "Não";
    const ecr = comCredito ? validarContaBradesco(contaCredito) : {};
    const faltaCiente = debito && !ciente;
    setErrosDebito(ed);
    setErrosCartao(ec);
    setErrosCredito(ecr);
    setErroCiente(
      faltaCiente ? "Confirme que o CPF/CNPJ pertence ao titular da conta." : undefined,
    );
    if (
      Object.keys(ed).length > 0 ||
      Object.keys(ec).length > 0 ||
      Object.keys(ecr).length > 0 ||
      faltaCiente
    ) {
      return focar([
        ...idsConta("debito", ed),
        ...(["numero", "bandeira", "nomeTitular", "validade"] as const)
          .filter((k) => k in ec)
          .map((k) => (k === "nomeTitular" ? "cartao-titular" : `cartao-${k}`)),
        ...(faltaCiente ? ["bradesco-debito-ciente"] : []),
        ...idsConta("credito", ecr),
      ]);
    }
    onEfetivar({
      bradesco: {
        ...(debito ? { contaDebito, cienteTitularConta: true } : {}),
        ...(cartao ? { cartao: dadosCartao } : {}),
        creditoEmConta: { opcao: opcaoCredito, conta: contaCredito },
      },
    });
  }

  const subtitulo = debito
    ? "Débito em conta · informe a conta que será debitada."
    : cartao
      ? "Cartão de crédito · informe os dados do cartão."
      : "Confirme a autorização de crédito em conta para eventuais devoluções.";
  const temDadoFinanceiro =
    debito || cartao || creditoEmContaAtivo({ opcao: opcaoCredito, conta: contaCredito });

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Pagamento</h2>
        <div className="sub" style={{ margin: "4px 0 0" }}>
          {subtitulo}
        </div>
      </div>

      {naoSuportada && (
        <div className="clt-note" role="alert" data-testid="bradesco-forma-nao-suportada">
          <svg width="15" height="15">
            <use href="#i-info" />
          </svg>
          <div>{AVISO_FORMA_NAO_SUPORTADA_BRADESCO}</div>
        </div>
      )}
      {debito && (
        <>
          <PagamentoBradescoContaCampos
            prefixo="debito"
            valor={contaDebito}
            erros={errosDebito}
            onChange={(k, v) => {
              setContaDebito((a) => ({ ...a, [k]: v }));
              setErrosDebito((a) => ({ ...a, [k]: undefined }));
            }}
          />
          <PagamentoBradescoCiente
            ciente={ciente}
            erro={erroCiente}
            onCiente={(v) => {
              setCiente(v);
              setErroCiente(undefined);
            }}
          />
        </>
      )}
      {cartao && (
        <PagamentoCartaoCampos
          valor={dadosCartao}
          erros={errosCartao}
          bandeiras={BANDEIRAS_BRADESCO}
          onChange={(k, v) => {
            setDadosCartao((a) => ({ ...a, [k]: v }));
            setErrosCartao((a) => ({ ...a, [k]: undefined }));
          }}
        />
      )}
      {!naoSuportada && (
        <>
          <PagamentoBradescoCreditoOpcao opcao={opcaoCredito} onOpcao={setOpcaoCredito} />
          {opcaoCredito !== "Não" && (
            <PagamentoBradescoContaCampos
              prefixo="credito"
              valor={contaCredito}
              erros={errosCredito}
              onChange={(k, v) => {
                setContaCredito((a) => ({ ...a, [k]: v }));
                setErrosCredito((a) => ({ ...a, [k]: undefined }));
              }}
            />
          )}
        </>
      )}

      {temDadoFinanceiro && (
        <div className="clt-note" style={{ marginTop: 12 }}>
          <svg width="15" height="15">
            <use href="#i-lock" />
          </svg>
          <div>
            Estes dados <strong>não são gravados</strong> pelo CoteCerto: seguem direto ao robô de
            transmissão.
            {cartao && " Não pedimos o código de segurança (CVV)."}
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
          disabled={enviando || naoSuportada}
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
