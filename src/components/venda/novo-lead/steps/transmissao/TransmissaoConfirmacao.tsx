import type { ReactNode } from "react";
import type { Form } from "@/components/venda/novo-lead/types";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";
import { formatarDataBr, montarConfirmacaoQuiver } from "./confirmacao-quiver";

type Props = {
  f: Form;
  resultado: ResultadoCalculo;
  dados: DadosComplementaresTransmissao | null;
  fipeValor?: string;
  formaPagamento: string;
  parcelas: string;
  premio: number | undefined;
  ehCartao: boolean;
  enviando: boolean;
  erroEnvio: string | null;
  onVoltar: () => void;
  onAvancarPagamento: () => void;
  onConfirmarTransmitir: () => void;
};

function money(v: number | undefined) {
  if (v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const linha = (k: string, v: ReactNode) => (
  <tr key={k}>
    <td className="ff-k">{k}</td>
    <td className="ff-v">{v}</td>
  </tr>
);

// Recapitulação fiel à tela "Confirmação" do Quiver (Dados do veículo, Perfil,
// Coberturas), só com dados nossos. O bloco "Retorno" do portal (protocolo,
// orçamento, fator de ajuste) só existe depois do "Efetivar" e não é simulado.
export function TransmissaoConfirmacao({
  f,
  resultado,
  dados,
  fipeValor,
  formaPagamento,
  parcelas,
  premio,
  ehCartao,
  enviando,
  erroEnvio,
  onVoltar,
  onAvancarPagamento,
  onConfirmarTransmitir,
}: Props) {
  const conf = montarConfirmacaoQuiver(f, resultado, dados, { fipeValor });
  const vigencia = `${formatarDataBr(f.vigIni)} até ${formatarDataBr(f.vigFim)}`;
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>{conf.titulo}</h2>
        <div className="sub" style={{ margin: "4px 0 0" }}>
          Informações enviadas — confira antes de transmitir; depois disso a seguradora assume o
          processo.
        </div>
      </div>

      <div className="acc-sol" data-tour="transmissao-resumo" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 28, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <span className="muted small">Cotação</span>
            <br />
            <strong>{f.nome || "—"}</strong>
          </div>
          <div>
            <span className="muted small">Seguradora</span>
            <br />
            <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <SeguradoraBadge nome={resultado.seguradora} tam="xs" />
              {resultado.seguradora}
            </strong>
          </div>
          <div>
            <span className="muted small">Pagamento</span>
            <br />
            <strong>
              {formaPagamento} · {parcelas || "À vista"}
            </strong>
          </div>
          <div>
            <span className="muted small">Vigência</span>
            <br />
            <strong>{vigencia}</strong>
          </div>
          <div>
            <span className="muted small">Modalidade</span>
            <br />
            <strong>{f.modalidade || "—"}</strong>
          </div>
          <div>
            <span className="muted small">Fator de ajuste solicitado</span>
            <br />
            <strong>{f.percentualAjuste ? `${f.percentualAjuste}%` : "—"}</strong>
          </div>
        </div>
      </div>

      {conf.avisos.map((aviso) => (
        <div
          key={aviso}
          className="clt-note"
          style={{ marginBottom: 10 }}
          data-testid="aviso-confirmacao"
        >
          <svg width="15" height="15">
            <use href="#i-info" />
          </svg>
          <div>{aviso}</div>
        </div>
      ))}

      <div
        className="wizard-grid"
        data-tour="transmissao-confirmacao"
        style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}
      >
        <div>
          {conf.blocos.map((bloco) => (
            <div key={bloco.titulo}>
              <div className="acc-sec-t">{bloco.titulo}</div>
              <table className="table-pipe ff-table">
                <tbody>{bloco.linhas.map((l) => linha(l.rotulo, l.valor))}</tbody>
              </table>
            </div>
          ))}
        </div>
        <div>
          <div className="acc-sec-t">Prêmio</div>
          <table className="table-pipe ff-table">
            <tbody>
              {linha("Forma de pagamento", formaPagamento || "—")}
              {linha("Parcelas", parcelas || "À vista")}
              {linha("Prêmio", <strong>{money(premio)}</strong>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="clt-note" style={{ marginTop: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          Protocolo, orçamento e fator de ajuste do portal só aparecem depois da transmissão.
        </div>
      </div>

      {erroEnvio && (
        <div className="clt-note" style={{ marginTop: 14 }}>
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
        {ehCartao ? (
          <button
            className="btn btn-yellow"
            type="button"
            onClick={onAvancarPagamento}
            disabled={enviando}
          >
            Informar o pagamento{" "}
            <svg width="14" height="14">
              <use href="#i-chevron-right" />
            </svg>
          </button>
        ) : (
          <button
            className="btn btn-yellow"
            type="button"
            data-tour="transmissao-efetivar"
            onClick={onConfirmarTransmitir}
            disabled={enviando}
          >
            <svg width="14" height="14">
              <use href="#i-send" />
            </svg>{" "}
            {enviando ? "Transmitindo…" : "Confirmar e transmitir"}
          </button>
        )}
      </div>
    </>
  );
}
