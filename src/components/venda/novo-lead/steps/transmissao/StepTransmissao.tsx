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
  const labels = ehCartao
    ? ["Dados complementares", "Confirmação", "Pagamento", "Transmitida"]
    : ["Dados complementares", "Confirmação", "Transmitida"];
  const indices: Record<Fase, number> = ehCartao
    ? { dados: 0, confirmacao: 1, pagamento: 2, resultado: 3 }
    : { dados: 0, confirmacao: 1, pagamento: 1, resultado: 2 };

  // Enquanto a transmissão de verdade está em andamento (resposta do robô
  // pendente via polling), a tela sempre mostra o resultado — independente
  // de qual sub-passo o vendedor estava vendo antes de confirmar.
  const faseAtual: Fase = transmissaoEmAndamento ? "resultado" : fase;
  const subPassoLabel = `Passo ${indices[faseAtual] + 1} de ${labels.length} · ${labels[indices[faseAtual]]}`;

  function tentarNovamente() {
    onTentarNovamente();
    setFase("dados");
  }

  if (faseAtual === "resultado") {
    return (
      <>
        <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
          <span className="spacer" />
          <span className="chip chip-yellow">{subPassoLabel}</span>
        </div>
        <TransmissaoResultado
          seguradora={oferta.resultado.seguradora}
          resultado={resultadoTransmissao}
          tentarNovamente={tentarNovamente}
        />
      </>
    );
  }

  if (faseAtual === "confirmacao") {
    return (
      <TransmissaoConfirmacao
        f={f}
        resultado={oferta.resultado}
        formaPagamento={oferta.formaPagamento}
        parcelas={oferta.parcelas}
        premio={oferta.premio}
        subPassoLabel={subPassoLabel}
        ehCartao={ehCartao}
        enviando={enviando}
        erroEnvio={erroEnvio}
        onVoltar={() => setFase("dados")}
        onAvancarPagamento={() => setFase("pagamento")}
        onConfirmarTransmitir={() => dadosComplementares && onTransmitir(dadosComplementares)}
      />
    );
  }

  if (faseAtual === "pagamento") {
    return (
      <TransmissaoPagamento
        subPassoLabel={subPassoLabel}
        enviando={enviando}
        erroEnvio={erroEnvio}
        onVoltar={() => setFase("confirmacao")}
        onEfetivar={() => dadosComplementares && onTransmitir(dadosComplementares)}
      />
    );
  }

  return (
    <TransmissaoDadosComplementares
      f={f}
      resultado={oferta.resultado}
      formaPagamento={oferta.formaPagamento}
      parcelas={oferta.parcelas}
      subPassoLabel={subPassoLabel}
      onVoltar={onVoltarCalculo}
      onConfirmar={(dados) => {
        setDadosComplementares(dados);
        setFase("confirmacao");
      }}
    />
  );
}
