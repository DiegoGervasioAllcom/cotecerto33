import { useEffect, useState } from "react";
import {
  aplicarRascunho,
  baseDoForm,
  type RascunhoDadosTransmissao,
} from "@/lib/transmissao-rascunho";
import type { Form } from "@/components/venda/novo-lead/types";
import type { OfertaTransmissao } from "@/components/venda/novo-lead/steps/StepCalculo";
import {
  TransmissaoDadosComplementares,
  type DadosComplementaresTransmissao,
} from "./TransmissaoDadosComplementares";
import { TransmissaoConfirmacao } from "./TransmissaoConfirmacao";
import { TransmissaoPagamento } from "./TransmissaoPagamento";
import { ehDebitoEmContaPorto } from "@/lib/transmissao-debito";
import { ehSeguradoraBradesco } from "@/lib/transmissao-bradesco";
import { TransmissaoPagamentoBradesco } from "./TransmissaoPagamentoBradesco";
import { ehCartaoMapfre, ehDebitoMapfre } from "@/lib/transmissao-mapfre";
import { tipoPagamentoTokio } from "@/lib/transmissao-tokio-pagamento";
import { type PagamentoTransmissao } from "@/lib/transmissao-pagamento";
import { TransmissaoResultado, type ResultadoTransmissaoEstado } from "./TransmissaoResultado";

// "Cartão de crédito" é o único valor de forma de pagamento que exige o
// sub-passo de Pagamento (protótipo V12, `transmTemCartao`) — os fixtures de
// teste usam variações ("Cartão", "Cartão de Crédito"), daí o match por
// substring em vez de igualdade estrita.
function ehCartaoCredito(formaPagamento: string): boolean {
  return /cart/i.test(formaPagamento);
}

export type Fase = "dados" | "confirmacao" | "pagamento" | "resultado";

type Props = {
  f: Form;
  // Valor FIPE da tabela (estado de `useFipe`, fora do `Form`) — só exibição.
  fipeValor?: string;
  oferta: OfertaTransmissao;
  enviando: boolean;
  erroEnvio: string | null;
  transmissaoEmAndamento: boolean;
  resultadoTransmissao: ResultadoTransmissaoEstado | null;
  onTransmitir: (dados: DadosComplementaresTransmissao, pagamento?: PagamentoTransmissao) => void;
  onVoltarCalculo: () => void;
  onTentarNovamente: () => void;
  // Best-effort: só pra granularidade do Pipeline (`cotacoes.transmissao_fase`).
  // Nunca disparado para "resultado" — nesse ponto a transmissão de verdade já
  // tem sua própria linha em `cotacao_transmissoes`.
  onFaseChange?: (fase: "dados" | "confirmacao" | "pagamento") => void;
  // Reabertura de uma transmissão já iniciada (`useRetomarTransmissao`): sem
  // isso, o sub-passo local sempre nasce em "dados", mesmo quando o
  // resultado já existe (falha/transmitida) — nesses casos o wizard-card
  // ainda mostraria "Dados complementares" por 1 frame até o vendedor mexer.
  faseInicial?: Fase;
  // Dados complementares já digitados nesta cotação, guardados só em memória
  // pelo pai: trocar a forma de pagamento volta ao Cálculo e remonta este passo.
  dadosSalvos?: RascunhoDadosTransmissao | null;
  onDadosSalvos?: (rascunho: RascunhoDadosTransmissao) => void;
};

export function StepTransmissao({
  f,
  fipeValor,
  oferta,
  enviando,
  erroEnvio,
  transmissaoEmAndamento,
  resultadoTransmissao,
  onTransmitir,
  onVoltarCalculo,
  onTentarNovamente,
  onFaseChange,
  faseInicial = "dados",
  dadosSalvos = null,
  onDadosSalvos,
}: Props) {
  const [fase, setFase] = useState<Fase>(faseInicial);
  const [dadosComplementares, setDadosComplementares] =
    useState<DadosComplementaresTransmissao | null>(() =>
      dadosSalvos ? aplicarRascunho(dadosSalvos, baseDoForm(f)) : null,
    );

  useEffect(() => {
    if (fase === "resultado") return;
    onFaseChange?.(fase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  const ehCartao = ehCartaoCredito(oferta.formaPagamento);
  // Débito em conta da Porto: a Efetivação exige banco/agência/conta — passo
  // "Pagamento" próprio (dado sensível, só em memória).
  const ehDebitoPorto = ehDebitoEmContaPorto(oferta.resultado.seguradora, oferta.formaPagamento);
  // Tokio: débito (titular/conta) e cartão (como pagar) também têm passo próprio.
  const temPassoPagamento =
    ehCartao ||
    ehDebitoPorto ||
    ehSeguradoraBradesco(oferta.resultado.seguradora) || // pergunta de crédito em conta vale p/ toda forma
    ehDebitoMapfre(oferta.resultado.seguradora, oferta.formaPagamento) ||
    ehCartaoMapfre(oferta.resultado.seguradora, oferta.formaPagamento) ||
    tipoPagamentoTokio(oferta.resultado.seguradora, oferta.formaPagamento) !== null;
  const subs: { fase: Fase; l: string }[] = temPassoPagamento
    ? [
        { fase: "dados", l: "Dados complementares" },
        { fase: "confirmacao", l: "Confirmação" },
        { fase: "pagamento", l: "Pagamento" },
        { fase: "resultado", l: "Transmitida" },
      ]
    : [
        { fase: "dados", l: "Dados complementares" },
        { fase: "confirmacao", l: "Confirmação" },
        { fase: "resultado", l: "Transmitida" },
      ];
  const indices: Record<Fase, number> = Object.fromEntries(
    subs.map((s, i) => [s.fase, i]),
  ) as Record<Fase, number>;

  // Enquanto a transmissão de verdade está em andamento (resposta do robô
  // pendente via polling), a tela sempre mostra o resultado — independente
  // de qual sub-passo o vendedor estava vendo antes de confirmar.
  const faseAtual: Fase = transmissaoEmAndamento ? "resultado" : fase;
  const indiceAtual = indices[faseAtual];

  function tentarNovamente() {
    onTentarNovamente();
    setFase("dados");
  }

  // Só deixa voltar para um sub-passo já visitado (protótipo V12,
  // `transmBody`: `x.n<=T.sub`) — nunca pula pra frente, e nada de navegar
  // pelo submenu depois que a transmissão de verdade já começou.
  function irPara(fase: Fase) {
    if (transmissaoEmAndamento || fase === "resultado") return;
    if (indices[fase] > indiceAtual) return;
    setFase(fase);
  }

  const nav = (
    <div className="toggle toggle-sub" style={{ marginBottom: 16 }}>
      {subs.map((s, i) => (
        <button
          key={s.fase}
          type="button"
          className={indices[s.fase] === indiceAtual ? "on" : ""}
          disabled={indices[s.fase] > indiceAtual}
          onClick={() => irPara(s.fase)}
        >
          {i + 1}. {s.l}
        </button>
      ))}
    </div>
  );

  let body: React.ReactNode;
  if (faseAtual === "resultado") {
    body = (
      <TransmissaoResultado
        seguradora={oferta.resultado.seguradora}
        resultado={resultadoTransmissao}
        tentarNovamente={tentarNovamente}
        f={f}
      />
    );
  } else if (faseAtual === "confirmacao") {
    body = (
      <TransmissaoConfirmacao
        f={f}
        resultado={oferta.resultado}
        dados={dadosComplementares}
        fipeValor={fipeValor}
        formaPagamento={oferta.formaPagamento}
        parcelas={oferta.parcelas}
        premio={oferta.premio}
        temPassoPagamento={temPassoPagamento}
        enviando={enviando}
        erroEnvio={erroEnvio}
        onVoltar={() => setFase("dados")}
        onAvancarPagamento={() => setFase("pagamento")}
        onConfirmarTransmitir={() => dadosComplementares && onTransmitir(dadosComplementares)}
      />
    );
  } else if (faseAtual === "pagamento") {
    const PagamentoDaSeguradora = ehSeguradoraBradesco(oferta.resultado.seguradora)
      ? TransmissaoPagamentoBradesco
      : TransmissaoPagamento;
    body = (
      <PagamentoDaSeguradora
        seguradora={oferta.resultado.seguradora}
        formaPagamento={oferta.formaPagamento}
        enviando={enviando}
        erroEnvio={erroEnvio}
        onVoltar={() => setFase("confirmacao")}
        onEfetivar={(pagamento) =>
          dadosComplementares && onTransmitir(dadosComplementares, pagamento)
        }
      />
    );
  } else {
    body = (
      <TransmissaoDadosComplementares
        inicial={dadosComplementares}
        f={f}
        resultado={oferta.resultado}
        formaPagamento={oferta.formaPagamento}
        parcelas={oferta.parcelas}
        onVoltar={(dados) => {
          onDadosSalvos?.({ dados, base: baseDoForm(f) });
          onVoltarCalculo();
        }}
        onConfirmar={(dados) => {
          setDadosComplementares(dados);
          onDadosSalvos?.({ dados, base: baseDoForm(f) });
          setFase("confirmacao");
        }}
      />
    );
  }

  return (
    <>
      {nav}
      {body}
    </>
  );
}
