import type { ReactNode } from "react";
import type { Form } from "@/components/venda/novo-lead/types";
import type { ResultadoCalculo } from "@/components/venda/novo-lead/hooks/useSimulacaoCalculo";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";

type Props = {
  f: Form;
  resultado: ResultadoCalculo;
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

function moneyDeTexto(raw: string) {
  if (!raw) return "—";
  const n = Number(raw);
  return Number.isFinite(n) ? money(n) : raw;
}

const linha = (k: string, v: ReactNode) => (
  <tr key={k}>
    <td className="ff-k">{k}</td>
    <td className="ff-v">{v}</td>
  </tr>
);

// A tela de Confirmação do protótipo mostra um "retorno da seguradora"
// (protocolo, orçamento) fabricado como dado de demonstração antes de
// transmitir — o sistema real só sabe isso depois do webhook do robô. Aqui
// mostramos só a recapitulação real do que será enviado + o prêmio já
// calculado, sem inventar retorno da seguradora.
export function TransmissaoConfirmacao({
  f,
  resultado,
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
  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0 }}>Confirmação</h2>
        <div className="sub" style={{ margin: "4px 0 0" }}>
          Confira antes de transmitir — depois disso a seguradora assume o processo.
        </div>
      </div>

      <div className="acc-sol" style={{ marginBottom: 16 }}>
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
            <strong>
              {f.vigIni || "—"} a {f.vigFim || "—"}
            </strong>
          </div>
          <div>
            <span className="muted small">Modalidade</span>
            <br />
            <strong>
              {f.modalidade || "—"}
              {f.percentualAjuste ? ` · ${f.percentualAjuste}% FIPE` : ""}
            </strong>
          </div>
        </div>
      </div>

      <div className="wizard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div>
          <div className="acc-sec-t">Informações que serão enviadas</div>
          <table className="table-pipe ff-table">
            <tbody>
              {linha("Modelo", [f.marca, f.modelo, f.anoModelo].filter(Boolean).join(" ") || "—")}
              {linha("Placa", f.placa || "—")}
              {linha("Uso do veículo", f.tipoUso || "—")}
              {linha("Garagem", f.tipoGaragem || "—")}
              {linha("Plano de coberturas", f.tipoCobertura || "—")}
              {linha("Danos materiais a terceiros", moneyDeTexto(f.rcfDm))}
              {linha("Danos corporais a terceiros", moneyDeTexto(f.rcfDc))}
            </tbody>
          </table>
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
