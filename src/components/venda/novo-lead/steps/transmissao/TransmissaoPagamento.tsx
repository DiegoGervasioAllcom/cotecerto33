import { useState } from "react";
import { validarCartao, type CartaoTransmissao, type ErrosCartao } from "@/lib/transmissao-cartao";
import {
  validarContaDebito,
  type ContaDebito,
  type ErrosContaDebito,
} from "@/lib/transmissao-debito";
import {
  validarPagador,
  type ErrosPagador,
  type PagadorTransmissao,
} from "@/lib/transmissao-pagador";
import { tipoPagamentoPorto, type PagamentoTransmissao } from "@/lib/transmissao-pagamento";
import {
  tipoPagamentoTokio,
  validarCartaoTokio,
  validarDebitoTokio,
  type CartaoTokio,
  type DebitoTokio,
  type ErrosCartaoTokio,
  type ErrosDebitoTokio,
} from "@/lib/transmissao-tokio-pagamento";
import { PagamentoCartaoCampos } from "./PagamentoCartaoCampos";
import { PagamentoTokioCartaoCampos, PagamentoTokioDebitoCampos } from "./PagamentoTokioCampos";
import { PagamentoDebitoCampos } from "./PagamentoDebitoCampos";
import { PagamentoPagadorCampos } from "./PagamentoPagadorCampos";

type Props = {
  seguradora: string;
  formaPagamento: string;
  enviando: boolean;
  erroEnvio: string | null;
  onVoltar: () => void;
  onEfetivar: (pagamento?: PagamentoTransmissao) => void;
};

const CONTA_VAZIA: ContaDebito = { banco: "", agencia: "", conta: "" };
const DEBITO_TOKIO_VAZIO: DebitoTokio = {
  banco: "",
  agencia: "",
  agenciaDv: "",
  conta: "",
  titularNome: "",
  titularDocumento: "",
  parentesco: "",
  diaVencimento: "",
  primeiraParcelaDebito: "",
  ciente: false,
};
const CARTAO_TOKIO_VAZIO: CartaoTokio = {
  envio: "tela",
  relacaoProprietario: "",
  cpfResponsavelLink: "",
  diaFatura: "",
};
const CARTAO_VAZIO: CartaoTransmissao = { nomeTitular: "", bandeira: "", numero: "", validade: "" };
const PAGADOR_VAZIO: PagadorTransmissao = {
  tipoPessoa: "",
  nome: "",
  documento: "",
  email: "",
  ddd: "",
  telefone: "",
  sexo: "",
  estadoCivil: "",
  dataNascimento: "",
};

// Passo "Pagamento" ÚNICO. Na Porto mostra os campos da forma escolhida:
// Débito em Conta (banco/agência/conta), Cartão de Crédito (cartão) ou Cartão
// Porto Bank (Terceiros: cartão + pagador). DADOS SENSÍVEIS: ficam só no estado
// deste componente (somem ao sair do passo), não são gravados nem logados e
// seguem direto no body do fetch ao robô, que os digita no portal.
// Cartão de OUTRAS seguradoras continua ilustrativo (o robô só preenche a Porto).
export function TransmissaoPagamento({
  seguradora,
  formaPagamento,
  enviando,
  erroEnvio,
  onVoltar,
  onEfetivar,
}: Props) {
  const tipo = tipoPagamentoPorto(seguradora, formaPagamento);
  const tipoTokio = tipoPagamentoTokio(seguradora, formaPagamento);
  const [debitoTokio, setDebitoTokio] = useState<DebitoTokio>(DEBITO_TOKIO_VAZIO);
  const [cartaoTokio, setCartaoTokio] = useState<CartaoTokio>(CARTAO_TOKIO_VAZIO);
  const [errosDebitoTokio, setErrosDebitoTokio] = useState<ErrosDebitoTokio>({});
  const [errosCartaoTokio, setErrosCartaoTokio] = useState<ErrosCartaoTokio>({});
  const [conta, setConta] = useState<ContaDebito>(CONTA_VAZIA);
  const [cartao, setCartao] = useState<CartaoTransmissao>(CARTAO_VAZIO);
  const [pagador, setPagador] = useState<PagadorTransmissao>(PAGADOR_VAZIO);
  const [errosConta, setErrosConta] = useState<ErrosContaDebito>({});
  const [errosCartao, setErrosCartao] = useState<ErrosCartao>({});
  const [errosPagador, setErrosPagador] = useState<ErrosPagador>({});

  function upConta<K extends keyof ContaDebito>(chave: K, valor: ContaDebito[K]) {
    setConta((a) => ({ ...a, [chave]: valor }));
    setErrosConta((a) => ({ ...a, [chave]: undefined }));
  }
  function upCartao<K extends keyof CartaoTransmissao>(chave: K, valor: CartaoTransmissao[K]) {
    setCartao((a) => ({ ...a, [chave]: valor }));
    setErrosCartao((a) => ({ ...a, [chave]: undefined }));
  }
  function upPagador<K extends keyof PagadorTransmissao>(chave: K, valor: PagadorTransmissao[K]) {
    setPagador((a) => ({ ...a, [chave]: valor }));
    setErrosPagador((a) => ({ ...a, [chave]: undefined }));
  }

  function upDebitoTokio<K extends keyof DebitoTokio>(chave: K, valor: DebitoTokio[K]) {
    setDebitoTokio((a) => ({ ...a, [chave]: valor }));
    setErrosDebitoTokio((a) => ({ ...a, [chave]: undefined }));
  }
  function upCartaoTokio<K extends keyof CartaoTokio>(chave: K, valor: CartaoTokio[K]) {
    setCartaoTokio((a) => ({ ...a, [chave]: valor }));
    setErrosCartaoTokio((a) => ({ ...a, [chave]: undefined }));
  }

  // Leva o foco ao primeiro campo com erro (acessibilidade).
  function focar(ids: string[]) {
    const primeiro = ids.find((id) => document.getElementById(id));
    if (primeiro) document.getElementById(primeiro)?.focus();
  }

  function efetivar() {
    if (tipoTokio === "debito") {
      const erros = validarDebitoTokio(debitoTokio);
      if (Object.keys(erros).length > 0) {
        setErrosDebitoTokio(erros);
        const ids: Record<keyof DebitoTokio, string> = {
          banco: "tokio-debito-banco",
          agencia: "tokio-debito-agencia",
          agenciaDv: "tokio-debito-agencia-dv",
          conta: "tokio-debito-conta",
          titularNome: "tokio-debito-titular",
          titularDocumento: "tokio-debito-titular-doc",
          parentesco: "tokio-debito-parentesco",
          diaVencimento: "tokio-debito-dia",
          primeiraParcelaDebito: "tokio-debito-primeira",
          ciente: "tokio-debito-ciente",
        };
        return focar((Object.keys(erros) as (keyof DebitoTokio)[]).map((k) => ids[k]));
      }
      return onEfetivar({ tokio: { debito: debitoTokio } });
    }
    if (tipoTokio === "cartao") {
      const erros = validarCartaoTokio(cartaoTokio);
      if (Object.keys(erros).length > 0) {
        setErrosCartaoTokio(erros);
        const ids: Record<keyof CartaoTokio, string> = {
          envio: "tokio-cartao-envio",
          relacaoProprietario: "tokio-cartao-relacao",
          cpfResponsavelLink: "tokio-cartao-cpf-link",
          diaFatura: "tokio-cartao-dia",
        };
        return focar((Object.keys(erros) as (keyof CartaoTokio)[]).map((k) => ids[k]));
      }
      return onEfetivar({ tokio: { cartao: cartaoTokio } });
    }
    if (tipo === "debito") {
      const erros = validarContaDebito(conta);
      if (Object.keys(erros).length > 0) {
        setErrosConta(erros);
        return focar(
          ["banco", "agencia", "conta"].filter((k) => k in erros).map((k) => `debito-${k}`),
        );
      }
      return onEfetivar({ contaDebito: conta });
    }
    if (tipo === "cartao" || tipo === "cartao_terceiros") {
      const comPagador = tipo === "cartao_terceiros";
      const ec = validarCartao(cartao);
      const ep = comPagador ? validarPagador(pagador) : {};
      setErrosCartao(ec);
      setErrosPagador(ep);
      if (Object.keys(ec).length > 0 || Object.keys(ep).length > 0) {
        const idCartao = {
          numero: "cartao-numero",
          bandeira: "cartao-bandeira",
          nomeTitular: "cartao-titular",
          validade: "cartao-validade",
        } as const;
        const idPagador = {
          tipoPessoa: "pagador-tipo",
          nome: "pagador-nome",
          documento: "pagador-documento",
          email: "pagador-email",
          ddd: "pagador-ddd",
          telefone: "pagador-telefone",
          sexo: "pagador-sexo",
          estadoCivil: "pagador-estado-civil",
          dataNascimento: "pagador-nascimento",
        } as const;
        return focar([
          ...(Object.keys(idCartao) as (keyof typeof idCartao)[])
            .filter((k) => k in ec)
            .map((k) => idCartao[k]),
          ...(Object.keys(idPagador) as (keyof typeof idPagador)[])
            .filter((k) => k in ep)
            .map((k) => idPagador[k]),
        ]);
      }
      return onEfetivar({ cartao, ...(comPagador ? { pagador } : {}) });
    }
    onEfetivar(); // cartão de outra seguradora: nada a coletar aqui
  }

  const subtitulo =
    tipoTokio === "debito"
      ? "Débito em conta · informe o titular e a conta que será debitada."
      : tipoTokio === "cartao"
        ? "Cartão de crédito · a Tokio não pede os dados do cartão aqui; escolha como será informado."
        : tipo === "debito"
          ? "Débito em conta · informe a conta que será debitada."
          : tipo === "cartao_terceiros"
            ? "Cartão Porto Bank (Terceiros) · dados do cartão e do pagador."
            : tipo === "cartao"
              ? "Cartão de crédito · informe os dados do cartão."
              : "Cartão de crédito · dados coletados diretamente pela seguradora.";

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Pagamento</h2>
        <div className="sub" style={{ margin: "4px 0 0" }}>
          {subtitulo}
        </div>
      </div>

      {tipoTokio === "debito" && (
        <PagamentoTokioDebitoCampos
          valor={debitoTokio}
          erros={errosDebitoTokio}
          onChange={upDebitoTokio}
        />
      )}
      {tipoTokio === "cartao" && (
        <PagamentoTokioCartaoCampos
          valor={cartaoTokio}
          erros={errosCartaoTokio}
          onChange={upCartaoTokio}
        />
      )}
      {tipo === "debito" && (
        <PagamentoDebitoCampos valor={conta} erros={errosConta} onChange={upConta} />
      )}
      {(tipo === "cartao" || tipo === "cartao_terceiros") && (
        <PagamentoCartaoCampos valor={cartao} erros={errosCartao} onChange={upCartao} />
      )}
      {tipo === "cartao_terceiros" && (
        <PagamentoPagadorCampos valor={pagador} erros={errosPagador} onChange={upPagador} />
      )}
      {tipo === null && tipoTokio === null && <PagamentoIlustrativo />}

      {(tipo !== null || tipoTokio === "debito") && (
        <div className="clt-note" style={{ marginTop: 12 }}>
          <svg width="15" height="15">
            <use href="#i-lock" />
          </svg>
          <div>
            Estes dados <strong>não são gravados</strong> pelo CoteCerto: seguem direto ao robô de
            transmissão.
            {tipo !== null && tipo !== "debito" && " Não pedimos o código de segurança (CVV)."}
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

// Campos puramente ilustrativos (protótipo V12, `transmPagamento`) — nunca
// viram estado real nem são enviados a lugar nenhum. Cartão de seguradoras que
// o robô ainda não preenche: os dados vão direto para a seguradora (ambiente PCI).
function PagamentoIlustrativo() {
  return (
    <>
      <div className="wizard-grid cols-3">
        <div className="field-group full" style={{ gridColumn: "span 2" }}>
          <label>Número do cartão</label>
          <input className="input" value="•••• •••• •••• 4242" disabled />
        </div>
        <div className="field-group">
          <label>Bandeira</label>
          <input className="input" value="Visa" disabled />
        </div>
        <div className="field-group full" style={{ gridColumn: "span 2" }}>
          <label>Nome do titular</label>
          <input className="input" value="J••• S••••••" disabled />
        </div>
        <div className="field-group">
          <label>Validade</label>
          <input className="input" value="••/••" disabled />
        </div>
      </div>
      <div className="clt-note" style={{ marginTop: 12, borderColor: "var(--yellow)" }}>
        <svg width="15" height="15">
          <use href="#i-lock" />
        </svg>
        <div>
          <strong>Campos ilustrativos.</strong> Nesta seguradora os dados do cartão vão direto para
          a seguradora (ambiente PCI), sem trafegar nem ficar guardados no CoteCerto.
        </div>
      </div>
    </>
  );
}
