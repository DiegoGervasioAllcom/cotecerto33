import { useState } from "react";
import type { Form } from "@/components/venda/novo-lead/types";
import type { OfertaTransmissao } from "@/components/venda/novo-lead/steps/StepCalculo";
import {
  TransmissaoDadosComplementares,
  type DadosComplementaresTransmissao,
} from "./TransmissaoDadosComplementares";
import { TransmissaoConfirmacao } from "./TransmissaoConfirmacao";
import { TransmissaoPagamento } from "./TransmissaoPagamento";
import { TransmissaoResultado, type ResultadoTransmissaoEstado } from "./TransmissaoResultado";

// "Cartão de crédito" é o único valor de forma de pagamento que exige o
// sub-passo de Pagamento (protótipo V12, `transmTemCartao`) — os fixtures de
// teste usam variações ("Cartão", "Cartão de Crédito"), daí o match por
// substring em vez de igualdade estrita.
function ehCartaoCredito(formaPagamento: string): boolean {
  return /cart/i.test(formaPagamento);
}

type Fase = "dados" | "confirmacao" | "pagamento" | "resultado";

type Props = {
  f: Form;
  oferta: OfertaTransmissao;
  enviando: boolean;
  erroEnvio: string | null;
  transmissaoEmAndamento: boolean;
  resultadoTransmissao: ResultadoTransmissaoEstado | null;
  onTransmitir: (dados: DadosComplementaresTransmissao) => void;
  onVoltarCalculo: () => void;
  onTentarNovamente: () => void;
};

export function StepTransmissao({
  f,
  oferta,
  enviando,
  erroEnvio,
  transmissaoEmAndamento,
  resultadoTransmissao,
  onTransmitir,
  onVoltarCalculo,
  onTentarNovamente,
}: Props) {
  const [fase, setFase] = useState<Fase>("dados");
  const [dadosComplementares, setDadosComplementares] =
    useState<DadosComplementaresTransmissao | null>(null);

  const ehCartao = ehCartaoCredito(oferta.formaPagamento);
  const subs: { fase: Fase; l: string }[] = ehCartao
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
      />
    );
  } else if (faseAtual === "confirmacao") {
    body = (
      <TransmissaoConfirmacao
        f={f}
        resultado={oferta.resultado}
        formaPagamento={oferta.formaPagamento}
        parcelas={oferta.parcelas}
        premio={oferta.premio}
        ehCartao={ehCartao}
        enviando={enviando}
        erroEnvio={erroEnvio}
        onVoltar={() => setFase("dados")}
        onAvancarPagamento={() => setFase("pagamento")}
        onConfirmarTransmitir={() => dadosComplementares && onTransmitir(dadosComplementares)}
      />
    );
  } else if (faseAtual === "pagamento") {
    body = (
      <TransmissaoPagamento
        enviando={enviando}
        erroEnvio={erroEnvio}
        onVoltar={() => setFase("confirmacao")}
        onEfetivar={() => dadosComplementares && onTransmitir(dadosComplementares)}
      />
    );
  } else {
    body = (
      <TransmissaoDadosComplementares
        f={f}
        resultado={oferta.resultado}
        formaPagamento={oferta.formaPagamento}
        parcelas={oferta.parcelas}
        onVoltar={onVoltarCalculo}
        onConfirmar={(dados) => {
          setDadosComplementares(dados);
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
